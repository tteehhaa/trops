/*
 * 협정 세율 조회에 쓰는 국가·협정 목록과 양허표 읽기.
 *
 * ⚠️ 경계: 여기서 하는 일은 "표에 적힌 값을 그대로 꺼내오기" 까지입니다.
 *    품목분류·원산지·납부세액을 판정하지 않습니다. 세율을 계산하지도 않습니다 —
 *    연도별 단계 인하 계산은 /uae 한 곳에만 둡니다. 두 곳에서 계산하면
 *    언젠가 두 화면이 서로 다른 "현재 세율" 을 말하게 됩니다.
 *    그래서 접수 확인 화면과 확인메일은 양허표에 문자 그대로 적힌 값
 *    (기준세율 · 양허유형 · 무관세 도달일)만 보여 주고, 나머지는 /uae 로 보냅니다.
 *
 * 파일명이 밑줄로 시작하므로 Vercel 은 이 파일을 엔드포인트로 만들지 않습니다.
 * api/intake.js(접수 검사·저장)와 api/_notify.js(확인메일)가 함께 씁니다.
 *
 * ⚠️ AGREEMENTS 의 국가 목록은 precheck.html 의 국가 선택 상자와 같아야 합니다.
 *    나라를 늘리실 때는 이 파일 · precheck.html 두 곳을 함께 고치십시오.
 *    (한 곳만 고치면 화면에는 뜨는데 서버가 400 으로 거절하거나 그 반대가 됩니다.)
 */

const HS8_RE = /^[0-9]{8}$/;

// 지금 서비스 중인 협정만 둡니다. 협정문 확인이 끝나지 않은 나라를 미리 넣지 마십시오 —
// 선택할 수 있는데 결과가 비어 있는 것이 아무것도 없는 것보다 나쁩니다.
const AGREEMENTS = {
  AE: {
    code: 'AE',
    name: '아랍에미리트',
    agreement: '한-UAE CEPA',
    tariffAnnex: '부속서 2-가-2',
    // 연도별 세율·원산지 결정기준(PSR)까지 보여 주는 본 화면.
    lookupPath: '/uae',
  },
};

function agreementFor(code) {
  if (typeof code !== 'string') return null;
  return AGREEMENTS[code.trim().toUpperCase()] || null;
}

/**
 * 이용자가 적어 넣은 HS 코드를 8자리 숫자로 정규화합니다.
 * "0901.11-1000" 처럼 구분기호가 섞여 들어오므로 숫자만 남깁니다.
 * 8자리가 아니면 null 입니다 — 10단위(HSK)를 8자리로 잘라 쓰지 않습니다.
 * 자르는 순간 이용자가 묻지 않은 품목의 세율을 보여 주게 됩니다.
 */
function normalizeHsCode(raw) {
  if (typeof raw !== 'string') return null;
  const digits = raw.replace(/[^0-9]/g, '');
  return HS8_RE.test(digits) ? digits : null;
}

function lookupUrl(origin, countryCode, hs8) {
  const agreement = agreementFor(countryCode);
  if (!agreement || !HS8_RE.test(hs8)) return null;
  return String(origin || '').replace(/\/+$/, '') +
    agreement.lookupPath + '?hs=' + encodeURIComponent(hs8);
}

/**
 * 양허표에서 HS 8단위 한 줄을 찾아옵니다.
 *
 * 정적 파일(data/tariff/NN.json)을 HTTP 로 읽습니다. 함수 번들에 1.9MB 의
 * 양허표를 끌고 들어가지 않기 위해서입니다. 이 파일들은 이미 같은 도메인에서
 * 공개로 서비스되고 있고(/uae 가 브라우저에서 같은 경로를 읽습니다),
 * 개인정보가 아니므로 밖으로 나가는 요청이 아닙니다.
 *
 * ⚠️ "표에 없는 코드" 와 "표를 못 읽음" 을 구분해서 돌려줍니다.
 *    섞으면 잠깐 장애가 났을 때 이용자에게 "그런 코드는 없습니다" 라고
 *    말하게 되고, 이용자는 멀쩡한 HS 코드를 의심하게 됩니다.
 *    류 파일 자체가 404 인 것은 장애가 아닙니다 — 97개 류만 존재하며,
 *    없는 류(제77류 등)는 양허표에 아예 없는 것입니다.
 *
 * 예외를 던지지 않습니다. 이 조회는 접수의 부속 항목이라,
 * 못 읽었다고 접수나 확인메일을 막지 않습니다.
 *
 * @returns {Promise<{ok: boolean, record: object|null}>}
 *   ok:false            표를 못 읽음 (통신 실패·5xx·형식 오류)
 *   ok:true, record:null  표에 없는 코드
 */
async function fetchTariffRecord(origin, countryCode, hs8) {
  if (!agreementFor(countryCode) || !HS8_RE.test(hs8)) return { ok: false, record: null };

  const base = String(origin || '').replace(/\/+$/, '');
  const url = base + '/data/tariff/' + hs8.slice(0, 2) + '.json';

  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    // 없는 류 = 양허표에 없는 코드. 장애가 아닙니다.
    if (response.status === 404) return { ok: true, record: null };
    if (!response.ok) {
      console.error('tariff fetch HTTP ' + response.status + ' | ' + url);
      return { ok: false, record: null };
    }
    const rows = await response.json();
    if (!Array.isArray(rows)) return { ok: false, record: null };
    return { ok: true, record: rows.find((row) => row && row.hs8 === hs8) || null };
  } catch (err) {
    console.error('tariff fetch failed:', err && err.message ? err.message : err, '|', url);
    return { ok: false, record: null };
  }
}

/**
 * 면책 4문장. /uae 의 FIXED_DISCLAIMER 와 글자 그대로 같아야 합니다.
 * 세율을 보여 주는 자리에는 어디든 이 4문장이 함께 갑니다 —
 * 문장을 줄이거나 바꿔 쓰지 마십시오.
 */
function tariffDisclaimer(countryCode) {
  const agreement = agreementFor(countryCode);
  return [
    '이 결과는 ' + (agreement ? agreement.agreement : '협정') + ' 부속서의 양허 내용을 표시한 것입니다.',
    '실제 납부 세액과 다를 수 있습니다.',
    '원산지 결정기준은 품목별로 다르며 원문 확인이 필요합니다.',
    'TROPS는 품목분류·원산지를 판정하지 않습니다.',
  ];
}

module.exports = {
  AGREEMENTS: AGREEMENTS,
  HS8_RE: HS8_RE,
  agreementFor: agreementFor,
  normalizeHsCode: normalizeHsCode,
  lookupUrl: lookupUrl,
  fetchTariffRecord: fetchTariffRecord,
  tariffDisclaimer: tariffDisclaimer,
};
