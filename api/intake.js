/*
 * /precheck 접수 수신 · 저장 · 확인메일
 *
 * ⚠️ 경계 (반드시 지킬 것)
 *   이 폴더(main_web_page)는 접수·저장·알림만 담당합니다.
 *   LLM 호출·상태 판정·계약서 파싱·서류 대조 로직을 여기에 두지 않습니다.
 *   측정과 대조는 뒷단(trops_a)에서, 처리는 사람이 손으로 합니다.
 *   이 파일이 하는 일은 "접수됐다"를 기록하고 알리는 것까지입니다.
 *
 * POST /api/intake
 *   body: { email, consentTerms, consentTraining, path,
 *           docType: 'nda',                                  선택 · 서류 종류 (기본 'nda')
 *           files:   [{ name, type, size, data(base64) }],   필수 · 바이어가 보낸 서류
 *           ownForm:  { name, type, size, data(base64) },    선택 · 이용자의 자사 NDA 서식
 *           targetCountry: 'AE',                             선택 · 거래 상대국(ISO 2자리)
 *           hsCode:        '09011100' }                      선택 · HS 8단위
 *
 *   docType 은 흐름 md §5 「확장 구조」의 문서유형 파라미터입니다. 지금 받는 값은
 *   'nda' 하나뿐이고(DOC_TYPES), 값을 안 보내면 'nda' 로 봅니다. **모르는 값은 400** 입니다 —
 *   조용히 눕히지 않는 이유는 parseDocType 주석에 있습니다.
 *   ⚠️ 서류 종류를 늘릴 때 DOC_TYPES · precheck-schema.sql 의 check · precheck.html 의
 *      <option disabled> 세 곳을 함께 고쳐야 합니다.
 *
 *   기준 우선순위(PRD-62 §3-3): 자사 서식이 오면 그것이 1순위 기준입니다.
 *   오지 않으면 뒷단이 공개 표준 서식을 2순위 대체 기준으로 씁니다.
 *   여기서는 어느 기준을 쓸지 기록만 합니다 — 대조도 판정도 하지 않습니다.
 *
 *   targetCountry·hsCode 는 NDA 대조와 무관한 부속 항목입니다. 둘 다 있으면
 *   접수 확인 화면과 확인메일에 해당국 협정 세율을 함께 보여 줍니다.
 *   ⚠️ 선택으로 유지하십시오 — NDA 를 보내려는 사람에게 HS 코드를 요구하면
 *   부속 항목 하나 때문에 접수 자체를 잃습니다.
 *
 *   path='free' (기본) — 선착 20건 무상 실증
 *     슬롯을 원자적으로 점유하고 바로 접수 확정(status='received') · 확인메일 발송
 *     → 201 { ok:true, path:'free', token, slotNo, remaining }
 *     → 409 { error:'slots-exhausted' }   20건 소진
 *
 *   path='paid' — 런칭가 99,000원 건별 결제
 *     슬롯을 쓰지 않습니다. 결제 전이므로 status='awaiting_payment' 로만 남기고
 *     확인메일도 보내지 않습니다 — 접수 확정은 api/payment-confirm.js 가 합니다.
 *     → 201 { ok:true, path:'paid', token, orderId, amount, orderName }
 *
 *   → 400 { error:'invalid input', field }
 *   → 503 { error:'not-configured' }    카운터/저장소 미설정 (fail-safe closed)
 *
 * GET /api/intake?r=<token>          Magic Link 조회
 *   → 200 { ok:true, status, stage, docType, docTypeLabel, receivedAt, fileCount,
 *           slotNo, deleteAfter, erasedAt, routeNotice }
 *   → 404 { error:'not-found' }
 *
 *   stage 는 화면의 3단계 진행 라벨(1 접수됨 · 2 검토중 · 3 전달완료)이고 결제 전·취소된
 *   건에서는 null 입니다 〔S7 · 흐름 md §5-1 10번〕. 2단계의 근거는 status 가 아니라
 *   판정층 precheck_nda_run 의 **행 존재 여부**입니다 — 근거는 progressStage 주석에 있습니다.
 *
 *   routeNotice 는 「지금 확인할 수 있는 범위 밖」인 건에만 문자열이고, 그 밖에는
 *   전부 null 입니다 〔M-2 · api/_intake-route.js〕. 정본은 판정층 trops_a 이고
 *   여기서는 읽어서 문면으로 옮기기만 합니다. route 코드 자체는 내보내지 않습니다.
 *
 * 같은 토큰으로 자료를 즉시 지우는 경로는 api/erasure.js 입니다(환불규정 05).
 *
 * 확인메일에 PDF 를 첨부하지 않습니다.
 *   회수·정정이 불가능하고, 30일 삭제 정책이 적용되지 않으며, 열람을 측정할 수 없습니다.
 *   메일에는 Magic Link 만 담습니다.
 *
 * 필요한 Vercel 환경변수:
 *   INTAKE_SUPABASE_URL                  (앞단 전용 신규 프로젝트)
 *   INTAKE_SUPABASE_SERVICE_ROLE_KEY     (서버에서만 사용)
 *   RESEND_API_KEY                       (기존 재사용)
 *   PRECHECK_ORIGIN                      (선택 · Magic Link 기준 주소. 기본 https://trops.kr)
 *
 * 스키마는 저장소 루트 precheck-schema.sql 을 Supabase SQL Editor 에 실행하십시오.
 */

const crypto = require('crypto');
const { readConfig, safeText } = require('./_supabase.js');
const { PRICE, ORDER_NAME, makeOrderId } = require('./_payment.js');
const { buildMagicLink, sendIntakeMails, RETENTION_DAYS } = require('./_notify.js');
const { agreementFor, normalizeHsCode } = require('./_agreements.js');
const { rejectIfChargeBlocked } = require('./_precheck-charge-gate.js');
const ROUTE = require('./_intake-route.js');
// 진행상태 2단계(검토중)의 근거. 판정층 표를 **select 만** 합니다 〔S7〕.
const OUTCOME = require('./_nda-outcome.js');

const STORAGE_BUCKET = 'intake';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOKEN_RE = /^[A-Za-z0-9_-]{22,64}$/;

const MAX_EMAIL_LEN = 254;
const MAX_FILES = 5;
const MAX_FILE_BYTES = 10 * 1024 * 1024;   // 파일 1개당 10MB
const MAX_TOTAL_BYTES = 20 * 1024 * 1024;  // 합계 20MB
const MAX_NAME_LEN = 180;

// 바이어가 보내오는 서류의 실제 형식만 받습니다.
const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx', 'hwp', 'hwpx', 'txt', 'rtf', 'png', 'jpg', 'jpeg'];
const MIME_BY_EXTENSION = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  hwp: 'application/x-hwp',
  hwpx: 'application/hwp+zip',
  txt: 'text/plain',
  rtf: 'application/rtf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
};

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') return handleReceipt(req, res);
  if (req.method === 'POST') return handleIntake(req, res);

  res.status(405).json({ error: 'method not allowed' });
};

/* ──────────────────────────────────────────────────────────────
 * 접수
 * ────────────────────────────────────────────────────────────── */

async function handleIntake(req, res) {
  const body = parseBody(req.body);

  const email = typeof body.email === 'string' ? body.email.trim() : '';
  if (!email || email.length > MAX_EMAIL_LEN || !EMAIL_RE.test(email)) {
    res.status(400).json({ error: 'invalid input', field: 'email' });
    return;
  }

  // 동의 1 은 필수입니다. 없으면 접수 자체가 성립하지 않습니다.
  if (body.consentTerms !== true) {
    res.status(400).json({ error: 'invalid input', field: 'consentTerms' });
    return;
  }
  const consentTraining = body.consentTraining === true;

  // 무상 실증(free)과 건별 결제(paid)는 접수 시점이 다릅니다.
  // free 는 여기서 접수가 끝나고, paid 는 결제 승인까지 가야 끝납니다.
  const path = body.path === 'paid' ? 'paid' : 'free';

  // 서류 종류 〔흐름 md §5 확장 구조 · 2026-08-13〕.
  // ⛔ 틀린 값을 조용히 'nda' 로 눕히지 않습니다 — 아래 parseDocType 주석 참조.
  const parsedDocType = parseDocType(body.docType);
  if (!parsedDocType.ok) {
    res.status(400).json({ error: 'invalid input', field: 'docType', detail: parsedDocType.error });
    return;
  }
  const docType = parsedDocType.docType;

  /*
   * 브라우저가 신고한 기계적 사실 〔M-1 → M-3 · 2026-08-11〕.
   *
   * ⚠️ 여기서 **파일을 열지 않습니다.** 텍스트 레이어 유무는 브라우저가 PDF 구조를
   *    보고 정해 보내온 값이고, 이 파일은 그 값을 **과금 차단 사유로 옮길 뿐**입니다.
   *    (경계: 판정·파싱은 trops_a. 이 저장소는 접수·저장·알림·결제 처리만.)
   *
   * 형식이 아니면 조용히 버립니다 — 없는 것과 같게 취급합니다. 400 으로 막지 않는
   * 이유는, 이 값이 **접수의 요건이 아니라 과금을 줄이는 쪽으로만 쓰이는 값**이라
   * 형식이 틀렸다고 접수 자체를 잃을 이유가 없기 때문입니다.
   */
  const declaration = readDeclaration(body.detection);

  // 🔴 과금 게이트 — 유료 경로는 여기서 먼저 막습니다 〔R-2 · api/_precheck-charge-gate.js〕.
  //
  // 파일 업로드·주문 생성보다 **앞**입니다. 뒤에 두면 막히는 건인데도 파일이 저장되고
  // 주문번호가 발급되어, 결제창을 열지도 못할 주문이 awaiting_payment 로 쌓입니다.
  //
  // 무상 건은 지나갑니다 — 막는 것은 「유상 개시」이지 「제품 제공」이 아닙니다.
  // 실증 20건은 0원이라 이 게이트에 걸리지 않고, 변호사 확인을 기다리는 동안에도
  // 계속 굴러가야 합니다(그 20건이 확인에 필요한 실측의 출처입니다).
  //
  // 🔴 두 번째 축이 여기 들어옵니다 〔M-3〕 — 「불가」로 신고된 건은 유상 경로로
  //    들어가지 않습니다. **무상 건은 신고값과 무관하게 그대로 접수됩니다.**
  //    글자를 읽을 수 없는 파일이라고 접수를 거절하지 않습니다 — 막는 것은 돈입니다.
  if (path === 'paid' && rejectIfChargeBlocked(res, 'api/intake.js', declaration)) return;

  const parsed = parseFiles(body.files);
  if (!parsed.ok) {
    res.status(400).json({ error: 'invalid input', field: 'files', detail: parsed.error });
    return;
  }
  const files = parsed.files;

  // 자사 서식은 선택입니다. 없으면 ownForm 이 null 로 남고, 뒷단이 공개 표준 서식을 씁니다.
  // 합계 용량은 바이어 서류와 같은 20MB 한도를 함께 씁니다 — 선택 항목이라고
  // 한도를 늘려 주면 요청 본문만 커집니다.
  const parsedOwnForm = parseOwnForm(body.ownForm, parsed.totalBytes);
  if (!parsedOwnForm.ok) {
    res.status(400).json({ error: 'invalid input', field: 'ownForm', detail: parsedOwnForm.error });
    return;
  }
  const ownForm = parsedOwnForm.file;

  // 거래 정보는 선택입니다. 비워 보내는 것이 정상이고 더 흔합니다.
  // 다만 "보냈는데 형식이 틀린" 경우는 조용히 버리지 않고 알려 줍니다 —
  // 조용히 버리면 이용자는 세율이 나올 줄 알고 기다립니다.
  const parsedTrade = parseTradeInfo(body);
  if (!parsedTrade.ok) {
    res.status(400).json({ error: 'invalid input', field: parsedTrade.field, detail: parsedTrade.error });
    return;
  }
  const trade = parsedTrade.trade;

  const config = readConfig();
  if (!config.ok) {
    console.error('intake config error: ' + config.error);
    res.status(503).json({ error: 'not-configured' });
    return;
  }

  const intakeId = crypto.randomUUID();
  const token = crypto.randomBytes(24).toString('base64url');
  const receivedAt = new Date();
  const deleteAfter = new Date(receivedAt.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000);

  // 1) free 만 슬롯을 점유합니다. 유료 건은 한도와 무관하게 언제든 받습니다.
  //    점유를 업로드·저장보다 앞에 두어야 동시 접수가 20건을 넘기지 않습니다.
  let claim = null;
  if (path === 'free') {
    try {
      claim = await claimSlot(config);
    } catch (err) {
      console.error('intake claim_slot failed:', err && err.message ? err.message : err);
      res.status(502).json({ error: 'claim failed' });
      return;
    }
    if (claim.exhausted) {
      res.status(409).json({ error: 'slots-exhausted', limit: claim.limit, remaining: 0 });
      return;
    }
  }

  const orderId = path === 'paid' ? makeOrderId() : null;

  // 점유 이후 어느 단계에서 실패하든 슬롯을 반드시 돌려놓습니다.
  // 돌려놓지 않으면 아무도 쓰지 않은 슬롯이 소진된 것으로 남습니다.
  try {
    const uploaded = await uploadFiles(config, intakeId, files);

    // 자사 서식도 file_paths 에 넣습니다. 삭제 경로(api/erasure.js ·
    // scripts/cleanup-expired.js)가 file_paths 만 훑으므로, own_form_path 에만
    // 두면 30일 삭제와 즉시 삭제가 이 파일을 지나칩니다.
    const ownFormPath = ownForm ? await uploadOwnForm(config, intakeId, ownForm) : null;
    const allPaths = ownFormPath ? uploaded.concat([ownFormPath]) : uploaded;

    await insertIntake(config, {
      id: intakeId,
      email: email,
      file_paths: allPaths,
      file_count: allPaths.length,
      own_form_path: ownFormPath,
      // 서류 종류 〔흐름 md §5〕. 지금은 늘 'nda' 이지만 **값으로 남깁니다** —
      // 하드코딩이 아니라 파라미터라는 것이 이 컬럼의 존재 이유입니다.
      doc_type: docType,
      // 선택 항목이라 대부분 null 입니다. 둘 다 있을 때만 세율을 함께 보여 줍니다.
      target_country: trade.country,
      hs_code: trade.hsCode,
      consent_terms: true,
      consent_training: consentTraining,
      consent_at: receivedAt.toISOString(),
      slot_no: claim ? claim.slotNo : null,
      access_token: token,
      // 유료 건은 결제가 끝나야 접수입니다. 그 전에는 처리 대기열에 올리지 않습니다.
      status: path === 'paid' ? 'awaiting_payment' : 'received',
      received_at: receivedAt.toISOString(),
      delete_after: deleteAfter.toISOString(),
      intake_path: path,
      order_id: orderId,
      // 금액은 서버 상수만 씁니다. 클라이언트가 보낸 금액은 쓰지 않습니다.
      amount: path === 'paid' ? PRICE : 0,
      payment_status: path === 'paid' ? 'pending' : 'none',
    });
  } catch (err) {
    console.error('intake store failed:', err && err.message ? err.message : err);
    if (claim) await releaseSlot(config);
    res.status(502).json({ error: 'store failed' });
    return;
  }

  // 2) 유료 건은 여기서 멈춥니다.
  //    확인메일은 결제가 승인된 뒤 api/payment-confirm.js 가 보냅니다 —
  //    결제 전에 "접수되었습니다" 를 보내면 결제를 그만둔 사람에게도 가버립니다.
  if (path === 'paid') {
    res.status(201).json({
      ok: true,
      path: 'paid',
      token: token,
      orderId: orderId,
      amount: PRICE,
      orderName: ORDER_NAME,
    });
    return;
  }

  // 3) 무상 건 알림. 여기서부터는 실패해도 접수를 취소하지 않습니다 —
  //    레코드는 이미 남았고, 메일은 사람이 다시 보낼 수 있습니다.
  const mail = await sendIntakeMails({
    email: email,
    magicLink: buildMagicLink(token),
    fileCount: files.length + (ownForm ? 1 : 0),
    fileNames: files.map((f) => f.name),
    // 운영자가 무엇과 대조해야 하는지 메일 본문에서 바로 보이도록 넘깁니다.
    ownFormName: ownForm ? ownForm.name : null,
    // 서류 종류 표기 〔흐름 md §5〕. 서류가 늘면 운영자가 메일 한 줄로 구분해야 합니다.
    docTypeLabel: docTypeLabel(docType),
    // 둘 다 있을 때만 확인메일에 협정 세율 항목이 붙습니다(api/_notify.js).
    targetCountry: trade.country,
    hsCode: trade.hsCode,
    slotNo: claim.slotNo,
    consentTraining: consentTraining,
    receivedAt: receivedAt,
    intakeId: intakeId,
    storageBucket: STORAGE_BUCKET,
    path: 'free',
    amount: 0,
  });

  res.status(201).json({
    ok: true,
    path: 'free',
    token: token,
    slotNo: claim.slotNo,
    remaining: claim.remaining,
    mailed: mail.confirmationSent,
  });
}

/* ──────────────────────────────────────────────────────────────
 * Magic Link 조회
 * ────────────────────────────────────────────────────────────── */

async function handleReceipt(req, res) {
  const token = readToken(req);
  if (!TOKEN_RE.test(token)) {
    res.status(400).json({ error: 'invalid token' });
    return;
  }

  const config = readConfig();
  if (!config.ok) {
    console.error('intake config error: ' + config.error);
    res.status(503).json({ error: 'not-configured' });
    return;
  }

  try {
    // id 는 내보내지 않습니다 — precheck_intake_route 를 서버에서 짚기 위해서만 읽습니다.
    const select = 'id,status,received_at,file_count,slot_no,delete_after,intake_path,amount,payment_status,paid_at,' +
      'erasure_requested_at,own_form_path,target_country,hs_code,delivered_at,doc_type';
    const response = await fetch(
      config.restUrl + '/intake?access_token=eq.' + encodeURIComponent(token) + '&select=' + select,
      { headers: config.headers }
    );

    if (!response.ok) {
      console.error('intake receipt supabase error: HTTP ' + response.status +
        ' | 응답: ' + (await safeText(response)).slice(0, 300));
      res.status(502).json({ error: 'lookup failed' });
      return;
    }

    const rows = await response.json();
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) {
      res.status(404).json({ error: 'not-found' });
      return;
    }

    /*
     * 처리 가능 여부 〔M-2 · 2026-08-11〕.
     *
     * ⚠️ 접수 직후에는 아직 없습니다. trops_a cron 이 1일 1회 채우므로,
     *    이 화면을 **다시 방문했을 때** 비로소 붙습니다(재착수 결정 ④).
     *    ⛔ 「확인 중」을 두지 않습니다 — 없으면 이 절은 아무 값도 만들지 않고,
     *       화면도 아무것도 그리지 않습니다. 안 정해진 것을 상태로 보여 주면
     *       접수 직후 화면마다 「무언가 진행 중」이라는 인상만 남습니다.
     *
     * 못 읽어도 조회는 그대로 200 입니다. 이 값은 접수 확인의 부속 정보이고,
     * 표 하나(그것도 다른 저장소 소관) 때문에 접수 내용 전체를 잃게 하지 않습니다.
     */
    const route = await ROUTE.readLatestRoute(config, row.id);
    if (!route.available) {
      console.error('intake receipt route lookup skipped: ' + route.error);
    }
    const routeNotice = route.available && route.row
      ? ROUTE.noticeFor(route.row.route, route.row.reason)
      : null;

    /*
     * 진행상태 3단계 〔S7 · 흐름 md §5-1 10번 · 2026-08-13〕.
     *
     * 🔴 **2단계(검토중)의 근거를 `status` 에서 읽지 않습니다.**
     *    `status='in_progress'` 는 접수만 되고 **사람이 아직 손을 대지 않은 건에도**
     *    붙습니다(precheck.html statusLabel 주석이 남긴 실측). 그것으로 「검토중」을
     *    말하면 아무도 안 보고 있는데 보고 있다고 말하는 것이 됩니다.
     *
     *    대신 판정층 trops_a 의 `precheck_nda_run` **행 존재 여부**를 봅니다. 그 행은
     *    NDA 대조 엔진이 실제로 돈 뒤에만 생기므로(api/_nda-outcome.js 머리주석),
     *    있으면 「검토 단계에 들어갔다」가 사실입니다.
     *
     * ⚠️ 경계: 여기서도 **select 만** 합니다. outcome_kind 값 자체는 내보내지 않습니다 —
     *    「실패」·「지원 안 됨」을 이용자 화면의 단계로 번역하는 것은 이 저장소 일이
     *    아니고, 그 건은 자동 환불 배치가 따로 처리합니다(api/_nda-outcome-refund.js).
     * ⚠️ 표를 못 읽어도 200 입니다. 단계가 하나 낮게 보일 뿐이고, 표 하나 때문에
     *    접수 내용 전체를 잃게 하지 않습니다(위 route 처리와 같은 원칙).
     */
    const outcome = await OUTCOME.readOutcome(config, row.id);
    if (!outcome.available) {
      console.error('intake receipt nda-run lookup skipped: ' + outcome.error);
    }
    const stage = progressStage(row.status, outcome.available && Boolean(outcome.row));

    res.status(200).json({
      ok: true,
      status: row.status,
      // 3단계 진행 라벨용. null 이면 화면이 트래커를 아예 그리지 않습니다.
      stage: stage,
      // 서류 종류 〔흐름 md §5〕. 옛 행에는 컬럼이 없을 수 있어 'nda' 로 폴백합니다.
      docType: row.doc_type || 'nda',
      docTypeLabel: docTypeLabel(row.doc_type || 'nda'),
      receivedAt: row.received_at,
      fileCount: row.file_count,
      // 자사 서식을 받았는지만 알려 줍니다(1순위 기준). 저장소 경로는 내보내지 않습니다.
      ownForm: row.own_form_path != null,
      // 접수 때 골라 넣으신 거래 정보. 화면은 둘 다 있을 때만 세율 섹션을 그립니다.
      targetCountry: row.target_country || null,
      hsCode: row.hs_code || null,
      slotNo: row.slot_no,
      deleteAfter: row.delete_after,
      path: row.intake_path,
      amount: row.amount,
      paymentStatus: row.payment_status,
      paidAt: row.paid_at,
      // 요약 자료 링크를 보낸 시각. 환불규정 §02 의 기준선이라 화면에도 밝힙니다 —
      // 이용자가 자기 건이 전액 환불 구간인지 직접 확인할 수 있어야 합니다.
      deliveredAt: row.delivered_at,
      // 자료 즉시 삭제(환불규정 05)를 이미 요청한 건인지. 화면은 이 값으로
      // 삭제 요청 항목을 감추고 "삭제 완료" 를 표시합니다.
      erasedAt: row.erasure_requested_at,
      // 「범위 밖」인 건에만 문장이 들어갑니다. 그 밖에는 언제나 null 입니다 —
      // 진행 가능한 건은 아무 문면도 갖지 않습니다(C2 · api/_intake-route.js).
      routeNotice: routeNotice,
    });
  } catch (err) {
    console.error('intake receipt request failed:', err && err.message ? err.message : err);
    res.status(502).json({ error: 'lookup failed' });
  }
}

function readToken(req) {
  if (req.query && typeof req.query.r === 'string') return req.query.r.trim();
  try {
    const url = new URL(req.url, 'http://localhost');
    return (url.searchParams.get('r') || '').trim();
  } catch (e) {
    return '';
  }
}

/* ──────────────────────────────────────────────────────────────
 * 슬롯
 * ────────────────────────────────────────────────────────────── */

// claim_slot() 은 단일 UPDATE 안에서 한도를 확인하고 증가시킵니다.
// 두 요청이 동시에 들어와도 행 잠금 때문에 순서가 갈리므로 20건을 넘지 않습니다.
async function claimSlot(config) {
  const response = await fetch(config.restUrl + '/rpc/claim_slot', {
    method: 'POST',
    headers: config.headers,
    body: '{}',
  });

  if (!response.ok) {
    throw new Error('HTTP ' + response.status + ' | ' + (await safeText(response)).slice(0, 300) +
      ' | 함수가 없으면 precheck-schema.sql 을 먼저 실행하십시오.');
  }

  const rows = await response.json();
  const row = Array.isArray(rows) ? rows[0] : rows;

  // 한도에 도달하면 claimed=false 로 돌아옵니다.
  // slots 행 자체가 없어도 여기로 옵니다 — 카운터를 못 세면 접수를 닫는 쪽이 맞습니다.
  if (!row || row.claimed !== true) {
    const limit = row && row.slot_limit != null ? Number(row.slot_limit) : null;
    return { exhausted: true, limit: limit };
  }

  const used = Number(row.used);
  const limit = Number(row.slot_limit);
  return { exhausted: false, slotNo: used, limit: limit, remaining: Math.max(0, limit - used) };
}

async function releaseSlot(config) {
  try {
    const response = await fetch(config.restUrl + '/rpc/release_slot', {
      method: 'POST',
      headers: config.headers,
      body: '{}',
    });
    if (!response.ok) {
      // 여기서 실패하면 슬롯 하나가 잠긴 채 남습니다. 사람이 되돌릴 수 있도록 크게 남깁니다.
      console.error('intake release_slot failed: HTTP ' + response.status +
        ' | 응답: ' + (await safeText(response)).slice(0, 300) +
        ' | slots.used 를 수동으로 1 줄여야 합니다.');
    }
  } catch (err) {
    console.error('intake release_slot exception:', err && err.message ? err.message : err,
      '| slots.used 를 수동으로 1 줄여야 합니다.');
  }
}

/* ──────────────────────────────────────────────────────────────
 * 파일
 * ────────────────────────────────────────────────────────────── */

function parseFiles(raw) {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, error: 'no-files' };
  }
  if (raw.length > MAX_FILES) {
    return { ok: false, error: 'too-many-files' };
  }

  const files = [];
  let total = 0;

  for (let i = 0; i < raw.length; i += 1) {
    const parsed = parseOneFile(raw[i]);
    if (!parsed.ok) return parsed;

    total += parsed.file.buffer.length;
    if (total > MAX_TOTAL_BYTES) {
      return { ok: false, error: 'total-too-large' };
    }

    files.push(parsed.file);
  }

  return { ok: true, files: files, totalBytes: total };
}

// 자사 서식은 1개만 받습니다. 없으면 file 이 null 이고, 그 자체가 정상입니다 —
// 뒷단은 null 을 보고 공개 표준 서식을 대체 기준으로 씁니다.
// 검사는 바이어 서류와 똑같이 합니다. 선택 항목이라고 느슨하게 두면
// 확장자·용량 한도를 우회하는 경로가 하나 더 생깁니다.
function parseOwnForm(raw, bytesSoFar) {
  if (raw == null || raw === '') {
    return { ok: true, file: null };
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'bad-own-form' };
  }

  const parsed = parseOneFile(raw);
  if (!parsed.ok) return parsed;

  if ((bytesSoFar || 0) + parsed.file.buffer.length > MAX_TOTAL_BYTES) {
    return { ok: false, error: 'total-too-large' };
  }

  return { ok: true, file: parsed.file };
}

/* ──────────────────────────────────────────────────────────────
 * 진행상태 3단계 〔S7 · 흐름 md §5-1 10번 · 2026-08-13〕
 * ────────────────────────────────────────────────────────────── */

/**
 * 화면에 그릴 단계 번호. 1 접수됨 · 2 검토중 · 3 전달완료.
 *
 * `null` 이면 **트래커를 그리지 않습니다.** 결제 전(awaiting_payment)과 취소된 건은
 * 3단계 서사 위에 있지 않고, 그 상태는 이미 「접수 상태」·「결제 상태」 줄이 말합니다.
 * 없는 진행을 진행처럼 그리지 않는 것이 이 저장소의 기존 처리(빈 세율 섹션·
 * routeNotice 「확인 중」 없음)와 같은 원칙입니다.
 *
 * ⚠️ `in_progress` 를 2단계로 올리지 마십시오. 그 상태는 사람이 손대지 않은 건에도
 *    붙습니다 — 2단계의 근거는 오직 대조 실행 증적(hasRun)입니다.
 * ⚠️ 3단계는 `status='delivered'` 로만 옵니다. 대조가 끝난 것과 **자료를 보낸 것**은
 *    다릅니다(운영자 검수가 사이에 있습니다). 검수 전에 「전달완료」를 그리면
 *    환불규정 §02 의 전달 시점을 화면이 먼저 앞질러 말하게 됩니다.
 *
 * @param {string} status  intake.status
 * @param {boolean} hasRun precheck_nda_run 에 이 건의 행이 있는가
 * @returns {1|2|3|null}
 */
function progressStage(status, hasRun) {
  if (status === 'delivered') return 3;
  if (status !== 'received' && status !== 'in_progress') return null;
  return hasRun ? 2 : 1;
}

/* ──────────────────────────────────────────────────────────────
 * 서류 종류 〔흐름 md §5 확장 구조 · 2026-08-13〕
 * ────────────────────────────────────────────────────────────── */

/**
 * 지금 대조할 수 있는 서류 종류. **여기가 정본입니다.**
 *
 * 늘릴 때 함께 고쳐야 하는 세 곳:
 *   ① 이 배열
 *   ② precheck-schema.sql 의 intake_doc_type_allowed check
 *   ③ precheck.html 의 <option disabled> 에서 disabled 제거
 * 셋 중 하나만 고치면 화면·서버·DB 가 서로 다른 목록을 말합니다.
 */
const DOC_TYPES = ['nda'];

/** 화면·메일에 쓰는 표기. 코드값을 그대로 보여 주지 않습니다. */
const DOC_TYPE_LABEL = {
  nda: '비밀유지계약서(NDA)',
};

/**
 * 서류 종류를 아는 값만 통과시킵니다.
 *
 * 🔴 **틀린 값은 400 입니다.** 이 저장소의 다른 allowlist(readDeclaration ·
 *    _intake-route ROUTES · _nda-outcome OUTCOMES)는 모르는 값을 조용히 버리지만,
 *    이것만은 막습니다. 그 셋은 「있으면 더 잘하는 부속 정보」인데 서류 종류는
 *    **무엇과 대조할지를 정하는 값**입니다. 조용히 'nda' 로 눕히면 계약서를 보낸
 *    사람의 서류가 NDA 기준으로 대조되고, 화면·메일·DB 어디에도 어긋난 흔적이
 *    남지 않습니다. 그 침묵이 여기서 가장 나쁜 결과입니다.
 *
 * 값이 **아예 없으면** 'nda' 입니다 — 선택 상자가 없던 시절의 캐시된 화면과
 * 기존 자동화가 그대로 접수될 수 있어야 합니다(precheck.html 도 같은 폴백).
 */
function parseDocType(raw) {
  if (raw == null || raw === '') return { ok: true, docType: 'nda' };
  if (typeof raw !== 'string') return { ok: false, error: 'bad-doc-type' };
  const value = raw.trim().toLowerCase();
  if (DOC_TYPES.indexOf(value) === -1) return { ok: false, error: 'unsupported-doc-type' };
  return { ok: true, docType: value };
}

/** 코드값 → 표기. 모르는 값이 들어오면 코드값을 그대로 돌려줍니다(지어내지 않습니다). */
function docTypeLabel(value) {
  return DOC_TYPE_LABEL[value] || String(value || 'nda');
}

/* ──────────────────────────────────────────────────────────────
 * 거래 정보 (선택)
 * ────────────────────────────────────────────────────────────── */

// 거래 상대국·HS 코드는 접수 성립과 무관합니다. 비어 있으면 둘 다 null 이고,
// 그 상태가 정상입니다 — 화면과 메일은 세율 섹션을 아예 그리지 않습니다.
//
// 한쪽만 채워 보내는 것도 오류가 아닙니다. 조회는 못 하지만, 어느 나라로
// 나가는 건인지는 운영자에게 쓸모가 있으므로 받은 대로 남깁니다.
//
// ⚠️ 형식이 틀린 값은 조용히 버리지 않습니다. 버리면 이용자는 세율이 나올 줄
//    알고 기다리다가 아무것도 없는 화면을 보게 됩니다.
function parseTradeInfo(body) {
  const rawCountry = body.targetCountry;
  const rawHs = body.hsCode;

  let country = null;
  if (rawCountry != null && rawCountry !== '') {
    if (typeof rawCountry !== 'string') {
      return { ok: false, field: 'targetCountry', error: 'bad-country' };
    }
    const agreement = agreementFor(rawCountry);
    if (!agreement) {
      // 화면의 선택 상자에 없는 나라입니다. 협정문 확인이 끝난 나라만 받습니다.
      return { ok: false, field: 'targetCountry', error: 'unsupported-country' };
    }
    country = agreement.code;
  }

  let hsCode = null;
  if (rawHs != null && rawHs !== '') {
    if (typeof rawHs !== 'string') {
      return { ok: false, field: 'hsCode', error: 'bad-hs-code' };
    }
    hsCode = normalizeHsCode(rawHs);
    if (!hsCode) {
      return { ok: false, field: 'hsCode', error: 'not-8-digits' };
    }
  }

  return { ok: true, trade: { country: country, hsCode: hsCode } };
}

/* ──────────────────────────────────────────────────────────────
 * 브라우저 신고값 〔M-1 → M-3〕
 * ────────────────────────────────────────────────────────────── */

/**
 * 접수 본문의 detection 을 아는 값만 남기고 걸러냅니다.
 *
 * ⚠️ **아는 값만 통과**시킵니다. 모르는 문자열이 지나가면 나중에 사유 코드를
 *    늘렸을 때 옛 브라우저가 보낸 오타가 조용히 차단 사유가 됩니다.
 *
 * ⛔ 여기서 값을 **만들지 않습니다.** 없으면 없는 것으로 둡니다 —
 *    서버가 추정하기 시작하면 그것이 판정이 되고, 판정은 이 저장소 일이 아닙니다.
 */
const TEXT_LAYER_STATES = ['present', 'absent', 'unknown'];

function readDeclaration(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const state = raw.pdfTextLayer;
  if (typeof state !== 'string' || TEXT_LAYER_STATES.indexOf(state) === -1) return null;
  return { pdfTextLayer: state };
}

/* ──────────────────────────────────────────────────────────────
 * 파일 (이어서)
 * ────────────────────────────────────────────────────────────── */

function parseOneFile(item) {
  const raw = item || {};
  const rawName = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (!rawName || rawName.length > MAX_NAME_LEN) {
    return { ok: false, error: 'bad-name' };
  }

  const ext = rawName.split('.').pop().toLowerCase();
  if (ALLOWED_EXTENSIONS.indexOf(ext) === -1) {
    return { ok: false, error: 'unsupported-type' };
  }

  const data = typeof raw.data === 'string' ? raw.data : '';
  // 클라이언트가 data:...;base64, 접두사를 붙여 보낼 수 있습니다.
  const base64 = data.indexOf(',') !== -1 && data.slice(0, 5) === 'data:'
    ? data.slice(data.indexOf(',') + 1)
    : data;
  if (!base64) {
    return { ok: false, error: 'empty-file' };
  }

  let buffer;
  try {
    buffer = Buffer.from(base64, 'base64');
  } catch (e) {
    return { ok: false, error: 'bad-encoding' };
  }
  if (buffer.length === 0) {
    return { ok: false, error: 'empty-file' };
  }
  if (buffer.length > MAX_FILE_BYTES) {
    return { ok: false, error: 'file-too-large' };
  }

  return {
    ok: true,
    file: {
      name: rawName,
      safeName: safeFileName(rawName, ext),
      mime: MIME_BY_EXTENSION[ext] || 'application/octet-stream',
      buffer: buffer,
    },
  };
}

// 저장소 경로에는 원래 파일명을 쓰지 않습니다.
// 한글·공백·슬래시가 섞인 이름은 경로를 깨뜨리고, 원본 이름은 DB 가 아니라 메일로 전달합니다.
function safeFileName(name, ext) {
  const base = name.slice(0, name.length - ext.length - 1)
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return (base || 'file') + '.' + ext;
}

async function uploadFiles(config, intakeId, files) {
  const paths = [];

  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    const path = intakeId + '/' + String(i + 1).padStart(2, '0') + '-' + file.safeName;
    paths.push(await uploadOne(config, path, file));
  }

  return paths;
}

// 자사 서식은 이름으로 구분되게 올립니다. 운영자가 저장소만 보고도
// 어느 파일이 대조 기준인지 알아야 하기 때문입니다.
async function uploadOwnForm(config, intakeId, file) {
  return uploadOne(config, intakeId + '/own-form-' + file.safeName, file);
}

async function uploadOne(config, path, file) {
  const response = await fetch(
    config.storageUrl + '/object/' + STORAGE_BUCKET + '/' + encodeURI(path),
    {
      method: 'POST',
      headers: {
        apikey: config.key,
        Authorization: 'Bearer ' + config.key,
        'Content-Type': file.mime,
        'x-upsert': 'false',
      },
      body: file.buffer,
    }
  );

  if (!response.ok) {
    throw new Error('storage upload HTTP ' + response.status +
      ' | ' + (await safeText(response)).slice(0, 300) +
      ' | 버킷("' + STORAGE_BUCKET + '")이 없으면 precheck-schema.sql 을 먼저 실행하십시오.');
  }

  return STORAGE_BUCKET + '/' + path;
}

/* ──────────────────────────────────────────────────────────────
 * 저장
 * ────────────────────────────────────────────────────────────── */

async function insertIntake(config, row) {
  const response = await fetch(config.restUrl + '/intake', {
    method: 'POST',
    headers: Object.assign({}, config.headers, { Prefer: 'return=minimal' }),
    body: JSON.stringify(row),
  });

  if (!response.ok) {
    throw new Error('intake insert HTTP ' + response.status +
      ' | ' + (await safeText(response)).slice(0, 300) +
      ' | 테이블이 없으면 precheck-schema.sql 을 먼저 실행하십시오.');
  }
}

/* ──────────────────────────────────────────────────────────────
 * 공용
 * ────────────────────────────────────────────────────────────── */

function parseBody(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch (e) { return {}; }
}

/*
 * 순수 함수만 테스트용으로 내놓습니다 (2026-08-13).
 *
 * ⚠️ `module.exports` 자체는 **핸들러여야 합니다** — Vercel 이 이 파일의 기본 내보내기를
 *    엔드포인트로 씁니다. 그래서 객체로 감싸지 않고 함수에 속성을 붙입니다. 이 순서를
 *    뒤집어 `module.exports = { handler, … }` 로 만들면 /api/intake 가 조용히 죽습니다.
 * 여기 붙는 것은 I/O 가 없는 판정 함수만입니다. 저장·업로드 함수를 내놓지 마십시오 —
 * 테스트가 실제 Storage 를 건드리게 됩니다.
 */
module.exports.parseDocType = parseDocType;
module.exports.docTypeLabel = docTypeLabel;
module.exports.progressStage = progressStage;
module.exports.DOC_TYPES = DOC_TYPES;
