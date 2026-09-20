/**
 * no-secrets.test.js — 「랜딩은 비밀값이 필요 없다」를 불변식으로 세운다 〔신설 2026-09-20〕
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * 🔴 **왜 생겼나 — 아무도 안 읽는 비밀값 넷이 프로덕션에 살아 있었다** (2026-09-20 실측)
 * ══════════════════════════════════════════════════════════════════════════════
 * `vercel env ls production` 에 넷이 있었고 **하나도 읽는 코드가 없었다**:
 *   · `UAE_LOG_SUPABASE_SECRET_KEY` — 이름은 「UAE 로그」인데 **앱 본체 DB**(`bdlq…`)를
 *     가리켰다. `sb_secret_` 꼴이라 RLS 를 우회하고, 실제로 앱 표를 **읽고 지우는 것까지**
 *     됐다. 「읽는 코드가 없으니 무해하다」가 아니었다.
 *   · `PRESTEP_INGEST_SECRET` — `api/prestep.js` 가 읽었다. 그 프록시는 부르던 화면
 *     (`check.html` · `a962bf9` 에서 삭제)이 없어진 뒤로도 **공개 엔드포인트로 살아 있었다.**
 *   · `RESEND_API_KEY`(메일 보내던 `api/leads.js` 는 2026-09-09 에 걷힘) · `CRON_SECRET`
 *     (`vercel.json` 에 `crons` 0건).
 *
 * 🔴 **셋 다 「기능을 걷을 때 비밀값을 같이 안 걷은 것」이다.** 기능은 눈에 보여서 걷히고
 *    env 는 안 보여서 남는다. 그 비대칭을 사람의 기억에 맡기지 않으려고 이 파일을 둔다.
 *
 * ⚠️ 이 검사는 **값을 읽지 않는다.** 비밀값을 검사 파일이 만지기 시작하면 그 자체가 새 유출
 *    경로다. 여기서 재는 것은 「배포되는 코드가 비밀값을 «필요로» 하는가」다.
 *
 * ⛔ 이 검사를 지우지 마십시오. 서버 코드를 새로 둬야 한다면 아래 ①의 목록을 늘리면서
 *    «왜 필요한지»를 그 자리에 적으십시오 — 그때 검토가 일어나는 것이 이 파일의 목적입니다.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const exists = (f) => fs.existsSync(path.join(ROOT, f));

/* ══ ① 서버 엔드포인트가 0개다 ═══════════════════════════════════════════ */

/**
 * 🔴 **`api/` 에 파일을 두면 그 순간 공개 엔드포인트가 된다.** Vercel 이 소스 루트에서
 *    직접 함수로 잡는다(`outputDirectory: dist` 와 무관 — `scripts/build-static.js` 의
 *    NOT_DEPLOYED 주석이 같은 말을 적는다). 아무나 부를 수 있고, 그 함수가 읽는 env 는
 *    프로덕션에 비밀값을 하나 더 세운다는 뜻이다.
 * ⚠️ 서버 함수가 정말 필요해지면 이 목록에 이름과 **사유**를 적으십시오.
 */
const ALLOWED_FUNCTIONS = [];

test('🔴 trops.kr 에 서버 엔드포인트가 없다 — 하나라도 서면 비밀값이 따라온다', () => {
  const dir = path.join(ROOT, 'api');
  const found = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => /\.(js|mjs|cjs|ts)$/.test(f))
    : [];
  for (const f of found) {
    assert.ok(
      ALLOWED_FUNCTIONS.includes(f),
      'api/' + f + ' 이 공개 엔드포인트로 섭니다 — 필요하면 ALLOWED_FUNCTIONS 에 사유와 함께 올리십시오'
    );
  }
});

/* ══ ② 배포되는 코드가 env 를 읽지 않는다 ════════════════════════════════ */

/**
 * 🔴 **`middleware.js` 까지 본다.** 엣지 미들웨어도 Vercel 이 소스 루트에서 집어가고,
 *    거기서 `process.env` 를 읽으면 그 값은 프로덕션에 등록돼야 한다 — `api/` 가 비어도
 *    비밀값이 다시 생기는 두 번째 길이다.
 * ⚠️ `scripts/`·`test/` 는 대상이 아니다. 그쪽은 빌드·검사용이고 배포되지 않는다.
 */
test('🔴 배포되는 코드가 `process.env` 를 읽지 않는다 — 읽으면 비밀값이 다시 생긴다', () => {
  const STATIC = require('../scripts/build-static.js').STATIC;
  const targets = ['middleware.js', ...STATIC.html.map((p) => p.file)];
  for (const dir of STATIC.dirs) {
    const abs = path.join(ROOT, dir);
    if (!fs.existsSync(abs)) continue;
    for (const f of fs.readdirSync(abs)) {
      if (/\.(js|mjs)$/.test(f)) targets.push(path.join(dir, f));
    }
  }
  /* 목록이 비면 아래가 한 바퀴도 안 돌면서 초록이다 — 가장 나쁜 실패 형태라 하한을 센다. */
  assert.ok(targets.length >= 9, '배포 대상이 ' + targets.length + '개뿐입니다 — 분류표를 읽지 못했습니까?');

  for (const f of targets) {
    assert.ok(!read(f).includes('process.env'), f + ' 이 env 를 읽습니다');
  }
});

/* ══ ③ 비밀값 파일이 저장소에 들어오지 않는다 ════════════════════════════ */

test('🔴 `.env*` 가 추적되지 않는다 — 한 번 커밋되면 이력에서 못 지운다', () => {
  const tracked = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n')
    .filter((f) => /(^|\/)\.env/.test(f));
  assert.deepStrictEqual(tracked, [], '비밀값 파일이 커밋돼 있습니다: ' + tracked.join(', '));
  assert.ok(read('.gitignore').includes('.env*'), '.gitignore 가 .env* 를 덮지 않습니다');
});

/*
 * ⚠️ **손으로 치워 둔 사본이 가장 오래 남는다** 〔2026-09-20 실측〕 —
 *    `.env.local.bak-2026-08-09T18-14-29` 이 **살아 있는** `RESEND_API_KEY` 와
 *    service_role JWT 를 현재 파일과 **해시가 같은 채로** 들고 있었다. `.gitignore` 가
 *    `.env*` 를 덮으니 커밋은 안 됐지만, 그래서 **아무도 안 보는 자리에 남아 있었다.**
 *    ⛔ 백업이 필요하면 저장소 밖에 두십시오. 이 저장소는 「미추적 임시 사본은 등재하지 않고
 *       지운다」를 이미 규칙으로 두고 있습니다(`scripts/build-static.js` 머리주석).
 */
test('⚠️ 저장소 안에 `.env` 사본이 굴러다니지 않는다', () => {
  const strays = fs.readdirSync(ROOT).filter((f) => /^\.env\..*(bak|backup|copy|old|~|\d{4}-\d{2}-\d{2})/i.test(f));
  assert.deepStrictEqual(strays, [], '비밀값 사본이 남아 있습니다: ' + strays.join(', '));
});

/* ══ ④ 걷어낸 기능이 되살아나지 않았다 ═══════════════════════════════════ */

test('🔴 사전 확인 프록시가 되살아나지 않았다 — 부르는 화면이 없다', () => {
  /*
   * `api/prestep.js` 는 `check.html`(a962bf9 에서 삭제)이 문항마다 두드리던 자리다.
   * 화면이 사라진 뒤로도 살아 있었고, 상류(`app.trops.kr/api/prestep`)는 404 였다 —
   * 즉 **아무 일도 안 하면서 인증 비밀값만 들고 있는 공개 통로**였다.
   * ⛔ 되살리려면 부르는 화면을 «먼저» 세우십시오. 순서가 뒤집히면 또 고아가 된다.
   */
  assert.ok(!exists('api/prestep.js'), '고아 프록시가 되살아났습니다');
  assert.ok(!exists('check.html'), 'check.html 이 돌아왔습니다 — 프록시 축을 다시 보십시오');
});
