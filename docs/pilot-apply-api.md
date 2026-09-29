# 시범 참여 신청 API — 랜딩(trops.kr) 연결 정보

*작성 2026-09-29 · self15 27 · 🔄 **새 계약 = self15 28**(같은 날 · 랜딩 시범 신청 화면 확정). 받는 쪽 = 이 앱(`app/api/pilot-apply/route.ts`) · 보내는 쪽 = 랜딩(`main_web_page` · 그쪽 세션이 폼을 만든다).*
*값(키)은 이 문서의 표가 정본이다 — 화면 라벨은 다듬어도 된다. 어휘 정본 = `lib/pilot/vocab.ts` · 검사 정본 = `lib/pilot/validate.ts` · 순번·소개 문장 = `lib/pilot/referral.ts`.*
*⚠️ 아래 «요청 예»·«응답 예»는 검사(`tests/pilot/landing-contract.test.ts`)가 실제 검사 함수로 돌려 본다 — 고치면 검사도 함께 본다.*

## 0. 켜기 전 조건(순서 지킴)

1. **처리방침 갱신이 먼저다(랜딩 세션 몫)** — 신청은 담당자 이름·이메일·전화와 **«요청하신 업무»(자유 글)**를 **본체 DB(서울)** 에 적는다. `privacy.html` 에 목적(시범 참여 선정·초대·회사 장부 미리 채움 · 가입 뒤 첫 화면에 요청 업무 채움 · 소개 수 집계) · 항목(아래 칸 — 요청하신 업무 포함) · 보관 기간(**신청일부터 1년(365일) 뒤 삭제 · 가입하면 회원 정보로 옮겨져 회원 보관 기준 · 동의를 철회하면 즉시 삭제** — self15 29 · 앱이 그대로 집행한다) · 파일(PI·CI·필증 한 장, 비공개 저장 · 신청과 함께 지운다) · 요청 빈도 제한용 IP 해시(이틀) · **접수 메일이 신청 이메일로 간다**(테스트 모드와 무관)를 적는다. 앱은 시행일 게이트(`mayWriteToMainDb("landing")`)도 함께 지난다.
   - ⚠️ «요청하신 업무»는 A-1 데이터 항목이 아니라 동의 기록의 범위 코드(`data_scopes`)에 실리지 않는다 — **동의 문구가 그 항목을 글로 적어야 한다.**
2. 동의 문구의 판 이름을 정해 `notice_version` 으로 보낸다(예: `pilot-apply-2026-10-01`) — 문구를 고치면 판 이름도 바꾼다.
3. 앱 스위치 `SELF15_PILOT_APPLY_ENABLED` 는 **Preview(prd-v2-pdca)에서만 켜져 있다.** 운영은 대표가 켠다(`prod-env-plan.md` ②단계). 꺼져 있으면 **503 `closed`** — 랜딩은 그때 기존 경로(문의 메일)로 안내한다.
4. **운영에서 이 새 계약을 쓰려면 운영 DB 에 `0153`·`0154` 가 먼저다**(대표 · `scripts/prod/apply-migrations.sh` · main 병합 «전»). 0153 없이 새 코드가 올라가면 신청 저장이 실패하고(503 · «받았습니다»로 말하지 않는다) 운영자 목록이 «불러오지 못했다»를 적는다.

## 1. 주소·형식

| | 값 |
|---|---|
| 주소 | `POST https://app.trops.kr/api/pilot-apply`(Preview 시험: 그 배포 주소 + 같은 경로) |
| 허용 출처 | 운영: `https://trops.kr` · `https://www.trops.kr`(정확 일치) · **Preview 만** 환경변수 `PILOT_APPLY_ALLOWED_ORIGINS`(쉼표 · 정확한 오리진 — 예 `https://main-web-page-git-pilot-form-tteehhaa.vercel.app`)를 더한다. 그 밖·없음은 **403 `origin`** |
| 본문 | `Content-Type: application/json` · 32KB 이하 · 서류 바이트는 **싣지 않는다**(2단계로 따로 올린다) |
| 쿠키 | 주고받지 않는다(`credentials` 기본값 그대로) |
| 미리 요청 | `OPTIONS` → 204 + `Access-Control-Allow-Origin` |

- `PILOT_APPLY_ALLOWED_ORIGINS` 는 `VERCEL_ENV=preview` 일 때만 읽힌다(운영·로컬에서는 값이 있어도 0). 받는 모양 = `https://호스트[:포트]` · `http://localhost[:포트]` · `http://127.0.0.1[:포트]` — 와일드카드(`*.vercel.app`) · 경로 · 끝 `/` 는 버린다. 넣은 뒤에는 **Preview 를 다시 배포**해야 읽힌다.

## 2. 1단계 — 신청(`action` 없음 또는 `"apply"`)

### 2-1 칸(요청 키 · 필수 여부)

**필수(다섯 + 봇 방지 두 칸)**

| 키 | 형식 · 선택지(키 → 화면 라벨) |
|---|---|
| `company_name` | 1~120자 |
| `email` | 이메일 모양 · 254자 — **초대 메일이 가는 주소 · 가입할 때 같은 주소로 로그인해야 한다** |
| `industry` | `machinery` 기계·부품 · `electronics` 전기·전자 · `cosmetics` 화장품·생활용품 · `food` 식품 · `chemicals` 화학·소재 · `other` 기타 |
| `region` | `capital` 서울·경기·인천 · `chungcheong` 충청 · `jeolla` 전라 · `gyeongsang` 경상 · `gangwon_jeju` 강원·제주 |
| `consents.collection` | `true` 여야 한다(개인정보 수집·이용) |
| `notice_version` | 1~80자 — 동의 문구의 판 |
| `website` | (봇 방지 · 숨은 칸) **빈 문자열** — 사람 눈에 안 보이는 입력칸으로 두고 그대로 보낸다 |
| `elapsed_ms` | (봇 방지 · 시간 덫) 폼을 연 뒤 보낼 때까지 밀리초(3000 이상) |

**선택(초대 뒤 가입·첫 설정에서 받는다 — 비워 보내도 된다)**

| 키 | 형식 · 선택지 |
|---|---|
| `requested_work` | **요청하신 업무** · 자유 글 **500자**(줄바꿈 그대로 · 앞뒤 공백·제어 문자는 걷는다) — 가입 뒤 홈 «오늘 확인» 첫 줄과 AI 업무 요청 입력창에 **그대로** 채운다 |
| `registration_no` | 사업자등록번호 · 숫자 10자리(하이픈·공백 허용) · 적으면 마지막 검증 숫자 확인 · 국세청 상태 조회(폐업이면 거절) — **안 적으면 초대 가입 화면이 받는다** |
| `contact_name` | 담당자 이름 · 80자(없으면 메일 인사가 «{회사명} 담당자님») |
| `phone` | 3~40자 · 숫자와 `+ - ( )` 공백 |
| `job_title` | 60자 |
| `referral_code` | 소개 코드(**다른 신청자에게 받은 코드** — 아래 2-6) · 영문 대문자·숫자·하이픈 4~32자(소문자로 보내도 대문자로 받는다) |
| `main_items` | 배열 최대 5 · 줄마다 `{ "name": "…", "hs": "8708" }` — 둘 중 하나 이상 · `name` 120자 · `hs` 숫자 4~6자리(점·하이픈 허용) |
| `export_countries` | ISO-2 배열 최대 10(예 `["VN","AE"]`) · 앱의 나라 목록(`lib/constants/countries.ts`) 안 |
| `monthly_export_band` | `none` 아직 없음 · `under_1` 월 1건 미만 · `1_3` 월 1~3건 · `4_10` 월 4~10건 · `over_10` 월 10건 넘음 |
| `buyer_count_band` | `none` 아직 없음 · `1_2` 1~2곳 · `3_5` 3~5곳 · `6_10` 6~10곳 · `over_10` 10곳 넘음 |
| `main_payment_term` | `tt_advance` 송금 · 선적 전 전액(T/T) · `tt_mixed` 송금 · 선금 일부 + 선적 뒤 잔금(T/T) · `tt_deferred` 송금 · 선적 뒤 전액(T/T) · `lc_sight` 신용장 · 서류 제시 즉시(L/C at sight) · `lc_usance` 신용장 · 기한부(L/C usance) · `dp` 추심 · 서류 인도와 동시 지급(D/P) · `da` 추심 · 인수 뒤 기한 지급(D/A) · `oa` 외상 · 선적 뒤 기한 송금(O/A) · `unknown` 정하지 않음·모름 |
| `main_incoterm` | `EXW` `FCA` `FAS` `FOB` `CFR` `CIF` `CPT` `CIP` `DAP` `DPU` `DDP` · `unknown` |
| `transport_modes` | 배열 · `sea` 해상 · `air` 항공 · `courier` 특송 · `land` 육상 |
| `insurance_state` | `insured` 가입 중 · `uninsured` 가입 안 함 · `unknown` 잘 모름 |
| `overdue_experience` | `none` 없음 · `delayed` 늦게 받은 적 있음 · `unpaid` 아직 못 받은 돈 있음 · `unknown` 잘 모름 |
| `forwarder_name` · `tax_accountant_name` | 각 120자(메모) |
| `pain_points` | 배열 최대 8 · `documents` 서류 작성 · `freight` 운송 견적·예약 · `payment` 대금 회수·미수 관리 · `insurance` 무역보험 · `customs` 통관·HS 코드 · `buyer` 바이어 확인 · `support` 지원사업 찾기 · `other` 기타 |
| `acquisition` | 객체 · `utm_source` `utm_medium` `utm_campaign` `utm_term` `utm_content` `ref` `landing_path` 각 200자(원문 그대로) |
| `consents.anonymous_stats` | `true`/`false` — 익명 통계 활용 동의(없으면 false) |
| `document` | 파일 **정보만**: `{ "kind": "pi"|"ci"|"export_declaration"|"other", "name": "PI-001.pdf", "size": 123456, "type": "application/pdf"|"image/jpeg"|"image/png" }` · 10MB 이하 |

- 목록 밖 값·틀린 모양은 **조용히 버리지 않고** 오류로 돌려준다(아래 `fields`). ⛔ 옛 업종 값(`manufacturing`·`trade`·`service`)은 받지 않는다. ⚠️ 옛 지역 형식(`KR-11`~`KR-50` 광역 코드)은 받아서 아래 대응표로 묶는다(새 폼은 묶음 키를 보낸다).

### 2-2 신청의 정체(갱신 규칙)
- **사업자번호를 적었으면 번호가 정체다** — 같은 번호 + **처음 신청한 이메일**로 다시 보내면 갱신(`result: "updated"`).
- **번호를 안 적었으면 «번호 없는 신청» 가운데 같은 이메일이 정체다** — 같은 이메일로 다시 보내면 그 신청을 고친다. 번호를 붙여 다시 보내면 **그 신청에 번호를 채운다**(새 줄이 생기지 않는다).
- 같은 이메일로 **다른 사업자번호**를 보내면 새 신청이다(대행·여러 회사). 여러 회사를 번호 없이 신청하면 같은 줄을 고치게 되므로 **회사마다 번호를 적어 달라**고 안내한다.
- ⚠️ 한 가지 예외 — 번호 없이 낸 신청이 **이미 초대된 뒤** 같은 이메일로 번호를 붙여 다시 내면 새 신청이 아니라 그 신청을 고치려는 것으로 보아 **409 `not_updatable`** 이다(초대한 뒤에는 바꾸지 않는다 · 번호는 초대 메일의 링크로 가입할 때 적는다).
- 같은 번호인데 **이메일이 처음과 다르거나**, 이미 **초대 메일을 보냈거나**, 이미 **가입**한 신청이면 아무것도 바꾸지 않고 **409 `not_updatable`**(까닭을 갈라 말하지 않는다).
- 운영 상태·메모는 갱신이 건드리지 않는다.

### 2-3 요청 예(필수 + 요청하신 업무)

```json
{
  "company_name": "예시산업", "email": "export@example.com", "industry": "machinery", "region": "gyeongsang",
  "requested_work": "베트남 바이어에게 보낼 견적서(PI)를 처음 만들어 보고 싶습니다.\n지난달 주문 메일을 붙여 드릴게요.",
  "consents": { "collection": true }, "notice_version": "pilot-apply-2026-10-01",
  "website": "", "elapsed_ms": 42000
}
```

### 2-4 요청 예(소개 코드 · 선택 칸 일부 · 서류)

```json
{
  "company_name": "예시식품", "email": "trade@example.com", "industry": "food", "region": "jeolla",
  "registration_no": "123-45-67891", "contact_name": "김담당", "phone": "010-0000-0000", "job_title": "수출 담당",
  "referral_code": "TR-7KQ2XM",
  "main_items": [{ "name": "김치", "hs": "200599" }], "export_countries": ["VN", "AE"],
  "monthly_export_band": "1_3", "main_payment_term": "tt_deferred", "main_incoterm": "FOB", "transport_modes": ["sea"],
  "insurance_state": "uninsured", "overdue_experience": "delayed", "pain_points": ["documents", "payment"],
  "acquisition": { "utm_source": "naver", "ref": "blog" },
  "consents": { "collection": true, "anonymous_stats": true }, "notice_version": "pilot-apply-2026-10-01",
  "document": { "kind": "pi", "name": "PI-001.pdf", "size": 123456, "type": "application/pdf" },
  "website": "", "elapsed_ms": 42000
}
```

### 2-5 성공 응답 `201`

```json
{
  "ok": true,
  "application_id": "8f2c1d7e-5b4a-4c3e-9f10-2a6b8c9d0e1f",
  "result": "created",
  "business_check": { "result": "not_provided", "status": null },
  "queue": { "position": 12, "basis": "아직 초대하지 않은 신청 가운데 받은 순서입니다 — 초대 순서는 담당자가 정합니다." },
  "referral": { "code": "TR-3NV8QD", "note": "소개해 주시면 먼저 연락드립니다." },
  "quick_check": {
    "title": "이 조건에서 먼저 챙길 것 3가지",
    "basis": "수출 사전점검 실행표(15줄) 가운데 적어 주신 조건에서 «확인 필요»인 줄을 골랐습니다 — 판정이 아니라 먼저 볼 순서 안내입니다.",
    "items": [],
    "more": { "label": "수출 사전점검 전체 보기", "path": "/export-precheck/new?from=pilot_apply" }
  },
  "upload": null,
  "upload_unavailable": false
}
```
- `business_check.result`: `not_provided`(번호를 안 적음 — 가입 화면이 받는다) · `confirmed`(계속사업자) · `suspended`(휴업 — 받는다) · `unavailable`(조회를 못 했다 — 받는다).
- `queue.position` = **지금 대기 중인 신청**(초대 전 · 가입 전 · 상태 «신청»·«연락함») 가운데 이 신청이 몇 번째로 받았는가(보류한 신청은 세지 않는다 · 다시 보내도 처음 받은 날 기준). 초대 순서의 약속이 아니다 — `basis` 문장을 함께 보여 준다.
- `referral.code` = **이 신청자 전용 소개 코드**(`TR-` + 6자 · 신청마다 하나 · 다시 보내도 같다). 랜딩 문구는 `note` 그대로 **«소개해 주시면 먼저 연락드립니다»**로 맞춘다 — ⛔ «순번이 올라갑니다»·«우선 초대» 같은 약속은 쓰지 않는다(순번을 자동으로 바꾸지 않는다 · 초대는 담당자가 정한다). 공유 링크는 랜딩이 만든다(예: `https://trops.kr/pilot?ref=TR-3NV8QD` → 폼이 `referral_code` 로 실어 보낸다).
- `quick_check` 은 AI 를 부르지 않는다(기존 사전점검 규칙 · 27 그대로 · 위 예의 `items` 는 줄였다 — 실제로는 3줄) · `more.path` 앞에 앱 주소를 붙여 링크로 쓴다.
- `upload` 는 `document` 를 보냈을 때만 있다. `upload_unavailable: true` 면 서류 주소를 만들지 못한 것 — «서류는 초대 뒤 앱에서 올려 주세요»로 안내한다.
- 접수 메일(대기 순번 · 소개 코드 · 1분 진단 요약)은 **신청 이메일로 간다 — 앱의 메일 테스트 모드와 무관하다**(🔄 self15 29 · 대표 지시 · 초대 메일·바이어·포워더 메일은 그대로 테스트 모드를 지난다). 받을 수 없는 예약 주소(`example.com`·`.test` …)로는 보내지 않는다. 메일 결과는 응답에 싣지 않으므로 **랜딩 화면이 응답의 `queue`·`referral`·`quick_check` 를 바로 보여 주는 것이 정본**이다.

### 2-6 소개는 이렇게 센다
- 받은 `referral_code` 가 **다른 신청자의 소개 코드**이고, 그 신청이 **먼저 받은** 신청이며, **이메일이 다르고 두 사업자번호가 같지 않을 때만** 소개로 센다(자기 코드 · 나중에 받은 신청의 코드 · 같은 사람은 세지 않는다).
- 한 신청은 **한 번만** 소개로 센다(처음 정해진 소개한 신청이 바뀌지 않는다). 소개한 신청의 **«소개 수»**가 운영자 «시범 신청» 목록에 서고 정렬(«소개 수(참고용)»)에 쓰인다 — **운영자 참고용**이며 순번·초대를 자동으로 바꾸지 않는다.
- 파트너 소개 코드(포워더·세무사 등 `referral_channel`)는 27 그대로 가입 때 첫 설정의 «소개»로 옮긴다. 신청자 코드와 겹치지 않게 만든다.

### 2-7 대응표(새 선택지 → 기존 칸)
| 지역(새) | 기존 광역(17) | 적합도 «지방» | 첫 설정 «소재지» |
|---|---|---|---|
| 서울·경기·인천 | 서울 · 경기 · 인천 | 아니다 | 비움(가입 뒤 첫 설정에서 고른다) |
| 충청 | 대전 · 세종 · 충북 · 충남 | 그렇다 | 비움 |
| 전라 | 광주 · 전북 · 전남 | 그렇다 | 비움 |
| 경상 | 부산 · 대구 · 울산 · 경북 · 경남 | 그렇다 | 비움 |
| 강원·제주 | 강원 · 제주 | 그렇다 | 비움 |

| 업종(새) | 기존 업종(제조·무역·서비스) · 첫 설정 «업종» | 적합도 칩 |
|---|---|---|
| 기계·부품 · 전기·전자 · 화장품·생활용품 · 식품 · 화학·소재 | 옮기지 않는다(만드는지 파는지 모른다 · 첫 설정에서 고른다) | «제조 품목 업종 +2» |
| 기타 | 옮기지 않는다 | «제조 품목 업종 0» |

## 3. 2단계 — 서류 올리기(서류가 있을 때만 · 27 그대로)

1. 1단계 응답의 `upload.url` 로 **파일을 그대로** 올린다(15분 안):
```js
await fetch(upload.url, { method: "PUT", headers: upload.headers, body: file });   // file = <input type=file> 의 File
```
2. 올린 뒤 알린다(같은 주소 · JSON): `{ "action": "confirm_document", "application_id": "…", "receipt": "<upload.receipt>" }` → `200 { "ok": true, "document": "attached" }`. 서버가 파일을 다시 본다(10MB · 첫 바이트가 PDF/JPG/PNG) · 틀리면 지우고 400 `upload_bad_file`.
- **신청 단계에서는 AI 로 읽지 않는다** — 가입한 뒤 화주가 동의해야 읽는다.

## 4. 오류 형식

```json
{ "ok": false, "error": { "code": "invalid", "message": "적은 내용을 확인해 주세요.",
  "fields": [ { "field": "industry", "code": "not_in_list", "message": "업종은 기계·부품 · 전기·전자 · 화장품·생활용품 · 식품 · 화학·소재 · 기타 가운데 하나입니다." } ] } }
```

| HTTP | `code` | 뜻 · 랜딩이 할 일 |
|---|---|---|
| 503 | `closed` · `not_effective` | 신청을 받지 않는 중(스위치 꺼짐 · 처리방침 시행일 전) → 기존 문의 경로 안내 |
| 403 | `origin` | 허용 출처가 아니다(Preview 시험이면 `PILOT_APPLY_ALLOWED_ORIGINS` 에 그 주소를 더하고 다시 배포) |
| 413 | `too_large` | 본문 32KB 초과 |
| 400 | `bad_body` · `bot` | 본문을 못 읽음 · 숨은 칸/시간 덫(«잠시 뒤 다시 보내 주세요») |
| 400 | `invalid` + `fields[]` | 칸별 오류 — `field` = 요청 키(배열은 `main_items[0].hs` 모양) · `code` = `required`·`bad_format`·`too_long`·`not_in_list`·`too_many`·`consent_required`·`too_large` · `message` 를 그 칸 아래에 그대로 쓴다 |
| 400 | `business_closed` + `fields[]` | 적은 사업자번호가 국세청 조회에서 폐업 |
| 409 | `not_updatable` | 이 신청을 바꿀 수 없다(같은 번호인데 처음과 다른 이메일 · 초대한 뒤 · 이미 가입 — 번호 없이 낸 신청도 초대 뒤·가입 뒤는 같다) → `message` 를 그대로 |
| 429 | `rate_limited` + `retry_after`(초) | 요청 빈도 제한(같은 곳에서 시간당 5 · 하루 20 · 같은 신청(번호 · 없으면 이메일) 하루 10) |
| 503 | `unavailable` · `save` | 저장 못 함 → 잠시 뒤 다시 |
| 400 | `upload_invalid` · `upload_expired` · `upload_missing` · `upload_bad_file` | 2단계 확인 실패 |

## 5. 그 뒤(앱 쪽 · 참고)
- 운영자 화면 «시범 신청»(`/admin/pilot-applications`)에서 목록·적합도(참고용)·**소개 수(참고용)**·요청하신 업무·상태·메모를 보고 «초대하기» → 신청 이메일로 초대 메일(링크 14일).
- 신청자가 그 링크로 **같은 이메일**로 가입한다 — **사업자번호를 안 적은 신청이면 그 화면이 사업자등록번호를 받는다**(검증 숫자 · 국세청 폐업 거절 · 🔄 0154: **다른 신청이 이미 적은 번호이고 그 번호의 회사 장부가 아직 없으면 만들지 않는다** — «이 사업자등록번호로는 지금 회사 장부를 만들 수 없습니다» · 이미 회사 장부가 있으면 종전대로 참여 요청). 회사 장부가 신청 값으로 미리 채워진다(품목 · 기본 거래 조건 · 포워더·세무사 메모 · 동의 기록 — 소재지·업종은 첫 설정에서 고른다).
- 가입하면 홈 «오늘 확인» **첫 줄**이 «신청 때 요청하신 업무 — …»이고, 같은 글이 **AI 업무 요청 입력창에 채워져** 있다(보내기는 화주가 누른다). 처음 보낸 요청이 받아지면 그 줄이 사라진다.

## 6. 보관·철회(🔄 self15 29 · 0154)
- **신청일(`created_at`)부터 1년(365일)** 이 지나고 **가입하지 않은** 신청은 매일 배치(`/api/cron/l1-retention` · 신규 cron 0)가 지운다 — 올린 서류(비공개 저장소) **먼저**, 신청 기록·동의·사건 나중. 다시 보내도(갱신) 기한은 처음 받은 날 기준이다.
- **가입한 신청은 대상 밖**이다 — 신청 값은 회사 장부(회사 정보 · 품목 · 기본 거래 조건 · 동의 기록)로 옮겨져 회원 정보의 보관 기준을 따른다.
- **동의를 철회하면 즉시 지운다** — 창구는 `contact@theo-ne.com`이고 운영자가 «시범 신청» 화면의 «신청 지우기(철회)»(확인 칸 필수)로 지운다(가입 여부 무관 · 가입한 신청이면 회사 장부·동의 기록은 남고 «시범 신청에서 가져옴» 표시만 사라진다).
- 요청 빈도 기록(IP·번호 해시)은 이틀 뒤 지운다(같은 배치).
