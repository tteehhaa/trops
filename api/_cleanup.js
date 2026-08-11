/*
 * /precheck 30일 경과분 정리 배치 — 본체.
 *
 * ⚠️ 경계 (반드시 지킬 것)
 *   이 폴더(main_web_page)는 접수·결제·삭제 처리만 담당합니다.
 *   LLM 호출·상태 판정 코드를 두지 않습니다. 이 배치가 하는 판단은
 *   "보관 기한이 지났는가" 하나뿐입니다.
 *
 * ── 왜 api/ 에 있는가 ───────────────────────────────────────────────────────
 *   진입점이 둘입니다:
 *     api/cron/cleanup-expired.js   정기 실행 (Vercel Cron · 매일)
 *     scripts/cleanup-expired.js    미리보기 · 수동 복구 (CLI)
 *
 *   둘이 같은 코드를 봐야 합니다. 복제하면 한쪽만 고쳐지고 다른 쪽이 조용히 옛
 *   방식으로 남습니다 — api/_supabase.js 가 removeObjects 를 공유하는 것과 같은 이유입니다.
 *
 *   api/ 에 둔 것은 이 저장소의 관례입니다(공유 코드는 api/_*.js · 밑줄로 시작하므로
 *   Vercel 이 엔드포인트로 만들지 않습니다). scripts/ 에 두고 라우트가 ../../scripts/ 를
 *   부르게 하면, 함수 번들이 scripts/ 업로드에 의존하게 됩니다 —
 *   .vercelignore 가 scripts/ 를 남겨 둔 이유는 buildCommand 하나뿐이어야 합니다.
 *
 * ── 무엇을 지우는가 ─────────────────────────────────────────────────────────
 *   delete_after < now() 인 intake 행 **전부** — 상태를 가리지 않습니다.
 *
 *   상태로 걸러내지 않는 것이 핵심입니다. "접수일로부터 30일 후 삭제" 는
 *   결제를 마치지 않고 떠난 건(status='awaiting_payment')에도 똑같이 적용해야 하는
 *   약속입니다. 그 건들은 확인메일도 가지 않았고 아무도 다시 보지 않으므로,
 *   전용 정리 경로가 없으면 파일이 조용히 계속 남습니다.
 *
 *   순서: Storage 파일 → 행. 반대로 하면 파일 경로가 행에만 있으므로
 *   행을 먼저 지운 순간 어떤 파일을 지워야 하는지 알 수 없게 됩니다.
 *
 *   필요한 환경변수 (api/_supabase.js 와 같습니다):
 *     INTAKE_SUPABASE_URL
 *     INTAKE_SUPABASE_SECRET_KEY (또는 구 이름 INTAKE_SUPABASE_SERVICE_ROLE_KEY)
 *
 * ── 고아 파일 (cleanupOrphans) ──────────────────────────────────────────────
 *   행 없이 남은 Storage 폴더를 지웁니다. 업로드 중간에 실패한 접수는
 *   행이 만들어지지 않으므로(api/intake.js 는 그때 502 로 끝냅니다)
 *   올라간 파일만 남습니다. 30일이 지난 것만 지웁니다.
 *   행 목록 조회가 실패하면 한 건도 지우지 않고 건너뜁니다 —
 *   목록을 못 읽은 상태에서 "행이 없다" 고 판단하면 살아 있는 접수를 지웁니다.
 */

'use strict';

const { safeText, storageKey, removeObjects, listObjects } = require('./_supabase.js');

const BUCKET = 'intake';
const RETENTION_DAYS = 30;   // api/_notify.js 의 RETENTION_DAYS 와 같은 값입니다.
const PAGE = 500;            // 한 번에 읽어올 행 수
const DELETE_CHUNK = 100;    // 한 번에 지울 행 수 (URL 길이 때문에 나눕니다)
const LIST_PAGE = 1000;      // Storage 목록 한 페이지

/* ──────────────────────────────────────────────────────────────
 * 순수 함수 — 테스트가 여기를 봅니다
 * ────────────────────────────────────────────────────────────── */

/** 지울 행 목록에서 행 id · Storage 키 · 상태별 건수를 뽑습니다. */
function summarize(rows, bucket) {
  const ids = [];
  const keys = [];
  const byStatus = {};

  for (const row of rows || []) {
    if (!row || !row.id) continue;
    ids.push(row.id);
    const status = row.status || 'unknown';
    byStatus[status] = (byStatus[status] || 0) + 1;
    for (const path of row.file_paths || []) {
      const key = storageKey(path, bucket);
      if (key) keys.push(key);
    }
  }

  return { ids: ids, keys: keys, byStatus: byStatus, count: ids.length };
}

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/**
 * 고아 폴더가 지울 대상인지.
 *
 * 폴더 안 파일 중 가장 최근 것을 기준으로 봅니다.
 * 가장 오래된 것을 기준으로 하면 나중에 올라온 파일이 함께 지워집니다.
 */
function isOrphanExpired(objects, now, retentionDays) {
  if (!objects || objects.length === 0) return false;

  let newest = -Infinity;
  for (const obj of objects) {
    const t = Date.parse(obj && (obj.created_at || obj.updated_at) || '');
    if (Number.isNaN(t)) return false;   // 시각을 못 읽으면 지우지 않습니다.
    if (t > newest) newest = t;
  }

  return now - newest >= retentionDays * 24 * 60 * 60 * 1000;
}

/* ──────────────────────────────────────────────────────────────
 * Supabase 접근
 * ────────────────────────────────────────────────────────────── */

async function fetchExpired(config, nowIso, limit) {
  const select = 'id,status,file_paths,received_at,delete_after,erasure_requested_at';
  const url = config.restUrl + '/intake' +
    '?delete_after=lt.' + encodeURIComponent(nowIso) +
    '&select=' + select +
    '&order=delete_after.asc' +
    '&limit=' + limit;

  const response = await fetch(url, { headers: config.headers });
  if (!response.ok) {
    throw new Error('expired select HTTP ' + response.status +
      ' | ' + (await safeText(response)).slice(0, 300));
  }

  const rows = await response.json();
  return Array.isArray(rows) ? rows : [];
}

async function deleteRows(config, ids) {
  const list = ids.map((id) => '"' + String(id).replace(/"/g, '') + '"').join(',');
  const response = await fetch(
    config.restUrl + '/intake?id=in.(' + encodeURIComponent(list) + ')',
    {
      method: 'DELETE',
      headers: Object.assign({}, config.headers, { Prefer: 'return=minimal' }),
    }
  );

  if (!response.ok) {
    throw new Error('row delete HTTP ' + response.status +
      ' | ' + (await safeText(response)).slice(0, 300));
  }
}

async function fetchAllIntakeIds(config) {
  const ids = new Set();
  let offset = 0;

  // 페이지를 끝까지 넘깁니다. 중간에 멈추면 남은 id 를 "없다" 고 오판합니다.
  for (;;) {
    const response = await fetch(
      config.restUrl + '/intake?select=id&order=id.asc&limit=' + PAGE + '&offset=' + offset,
      { headers: config.headers }
    );
    if (!response.ok) {
      throw new Error('id select HTTP ' + response.status +
        ' | ' + (await safeText(response)).slice(0, 300));
    }
    const rows = await response.json();
    if (!Array.isArray(rows) || rows.length === 0) break;
    for (const row of rows) if (row && row.id) ids.add(row.id);
    if (rows.length < PAGE) break;
    offset += PAGE;
  }

  return ids;
}

/* ──────────────────────────────────────────────────────────────
 * 배치
 * ────────────────────────────────────────────────────────────── */

async function cleanupExpired(config, options) {
  const apply = options.apply === true;
  const log = options.log || (() => {});
  const nowIso = new Date(options.now).toISOString();

  const rows = await fetchExpired(config, nowIso, options.limit || PAGE);
  const plan = summarize(rows, BUCKET);

  if (plan.count === 0) {
    log('기한이 지난 접수가 없습니다.');
    return { rows: 0, files: 0, byStatus: {}, applied: apply };
  }

  const statusLine = Object.keys(plan.byStatus).sort()
    .map((s) => s + ' ' + plan.byStatus[s] + '건').join(' · ');
  log('기한 경과 ' + plan.count + '건 (' + statusLine + ') · 파일 ' + plan.keys.length + '개');

  if (!apply) {
    log('미리보기입니다. 실제로 지우려면 --apply 를 붙이십시오.');
    return { rows: plan.count, files: plan.keys.length, byStatus: plan.byStatus, applied: false };
  }

  // 1) 파일 먼저. 실패하면 행을 남겨 둡니다 — 다음 실행이 같은 행을 다시 집습니다.
  let filesDeleted = 0;
  for (const part of chunk(plan.keys, DELETE_CHUNK)) {
    const result = await removeObjects(config, BUCKET, part);
    filesDeleted += result.deleted;
  }
  log('파일 ' + filesDeleted + '개를 지웠습니다.');

  // 2) 행.
  for (const part of chunk(plan.ids, DELETE_CHUNK)) {
    await deleteRows(config, part);
  }
  log('접수 ' + plan.count + '건을 지웠습니다.');

  return { rows: plan.count, files: filesDeleted, byStatus: plan.byStatus, applied: true };
}

async function cleanupOrphans(config, options) {
  const apply = options.apply === true;
  const log = options.log || (() => {});

  // 살아 있는 행 목록을 먼저 확보합니다. 여기서 실패하면 한 건도 건드리지 않습니다.
  const liveIds = await fetchAllIntakeIds(config);

  const entries = await listObjects(config, BUCKET, '', LIST_PAGE, 0);
  // 버킷 루트에서 접수 폴더는 id 가 없는 항목(=폴더)으로 옵니다.
  const folders = entries
    .filter((e) => e && e.name && !e.id)
    .map((e) => e.name)
    .filter((name) => !liveIds.has(name));

  if (folders.length === 0) {
    log('고아 폴더가 없습니다.');
    return { folders: 0, files: 0, applied: apply };
  }

  let folderCount = 0;
  let fileCount = 0;

  for (const folder of folders) {
    // 폴더 안에서는 파일(id 가 있는 항목)만 셉니다. 시각이 없는 항목이 섞이면
    // isOrphanExpired 가 판단을 포기하고 폴더 전체를 건너뜁니다.
    const objects = (await listObjects(config, BUCKET, folder, LIST_PAGE, 0))
      .filter((o) => o && o.name && o.id);
    if (!isOrphanExpired(objects, options.now, RETENTION_DAYS)) continue;

    const keys = objects.map((o) => folder + '/' + o.name);
    folderCount += 1;
    fileCount += keys.length;

    if (!apply) continue;
    for (const part of chunk(keys, DELETE_CHUNK)) {
      await removeObjects(config, BUCKET, part);
    }
  }

  log((apply ? '고아 폴더 ' : '고아 폴더(미리보기) ') + folderCount + '개 · 파일 ' + fileCount + '개');
  return { folders: folderCount, files: fileCount, applied: apply };
}

module.exports = {
  BUCKET: BUCKET,
  RETENTION_DAYS: RETENTION_DAYS,
  PAGE: PAGE,
  DELETE_CHUNK: DELETE_CHUNK,
  LIST_PAGE: LIST_PAGE,
  summarize: summarize,
  chunk: chunk,
  isOrphanExpired: isOrphanExpired,
  cleanupExpired: cleanupExpired,
  cleanupOrphans: cleanupOrphans,
};
