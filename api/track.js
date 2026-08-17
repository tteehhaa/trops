/*
 * 페이지 조회·버튼 클릭 익명 집계 수신처 (assets/track.js 가 부른다).
 *
 * body: { kind: 'pageview'|'click', path: string, label?: string }
 *
 * 🔴 개인 식별자를 받지도, 적지도 않는다 — IP·User-Agent·쿠키·visitor id 를 어디에도
 *    남기지 않는다(precheck-schema.sql §0-M 머리주석과 같은 판단).
 *
 * ⚠️ 저장 실패가 페이지 동작에 영향을 주면 안 된다 — 이 요청은 `sendBeacon`/`keepalive`
 *    fetch 로 나가고 응답을 아무도 기다리지 않는다. 그래서 여기서 던지지 않고 항상 202 로
 *    답한다(입력이 아예 형식을 벗어난 경우만 400).
 */

const { readConfig, safeText } = require('./_supabase.js');

const MAX_PATH_LEN = 300;
const MAX_LABEL_LEN = 100;

function isNonEmptyString(v, maxLen) {
  return typeof v === 'string' && v.trim().length > 0 && v.length <= maxLen;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  const { kind, path: eventPath, label } = req.body || {};

  if (kind !== 'pageview' && kind !== 'click') {
    res.status(400).json({ error: 'invalid input', field: 'kind' });
    return;
  }
  if (!isNonEmptyString(eventPath, MAX_PATH_LEN)) {
    res.status(400).json({ error: 'invalid input', field: 'path' });
    return;
  }
  if (kind === 'click' && !isNonEmptyString(label, MAX_LABEL_LEN)) {
    res.status(400).json({ error: 'invalid input', field: 'label' });
    return;
  }

  const config = readConfig();
  if (!config.ok) {
    // 집계 저장소가 아직 미설정이어도 요청 자체는 성공으로 접는다 — 아무도 응답을 안 본다.
    console.error('page_events store skipped: ' + config.error);
    res.status(202).json({ ok: true });
    return;
  }

  try {
    const row = { kind, path: eventPath.trim(), label: kind === 'click' ? label.trim() : null };
    const response = await fetch(config.restUrl + '/page_events', {
      method: 'POST',
      headers: Object.assign({}, config.headers, { Prefer: 'return=minimal' }),
      body: JSON.stringify(row),
    });
    if (!response.ok) {
      console.error('page_events store failed: ' + response.status + ' ' + (await safeText(response)));
    }
  } catch (err) {
    console.error('page_events store exception', err);
  }

  res.status(202).json({ ok: true });
};
