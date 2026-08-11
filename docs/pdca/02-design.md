# DESIGN — A-1 / A-3 (2026-08-11)

스코프 인 두 항목만 설계합니다. B-1·B-3 은 코드 설계 없음(계획 §2 참조).

**지어내지 않은 것**: 통신판매업신고번호 값 · 최종 법무 확정 문구.
전자는 `site.config.json` 의 `"신청 중"` 한 값으로 남기고, 후자는 방침 페이지 상단
DRAFT 배너로 분리합니다. 둘 다 확정되면 고칠 자리가 **각각 한 곳**입니다.

---

## A-1 — 사업자정보 단일소스화

### 왜 토큰 치환인가

이 저장소에는 템플릿 엔진이 없습니다. `scripts/build-static.js` 가 유일한 빌드 단계이고
하는 일은 주석 제거 하나입니다. 선택지는 셋이었습니다.

| 안 | 문제 |
|---|---|
| 런타임 JS 주입 | 법정 고지를 JS 로 그립니다. JS 실패 시 고지가 사라지고, 「소스 보기」에도 안 남습니다. **탈락** |
| 소스에 값 유지 + 빌드가 드리프트만 검사 | 여전히 6곳을 고쳐야 합니다. "값 하나만 바꾸면"이 성립 안 함. **탈락** |
| **빌드 시 토큰 치환** | 소스에 값이 한 벌만 존재. 산출물은 지금과 글자 단위로 동일 |

### 구조

```
site.config.json  (루트 · 배포 안 됨)
        │
        ▼
scripts/build-static.js  ── 치환 ──▶  dist/*.html
        │
        └── 미해결 토큰이 남으면 빌드 실패
```

`site.config.json`:

```json
{ "biz": {
    "ko": { "companyName": "주식회사 테오네", "ceo": "범하나",
            "registrationNo": "625-81-04032", "ecommerceNo": "신청 중",
            "address": "서울특별시 강남구 봉은사로 524, B층 269-11호(삼성동)",
            "phone": "010-2605-5238" },
    "en": { "companyName": "THÉONÉ Co., Ltd.", "ceo": "Hana Beom",
            "registrationNo": "625-81-04032", "ecommerceNo": "Applied for",
            "address": "B269-11, 524 Bongeunsa-ro, Gangnam-gu, Seoul, Republic of Korea",
            "phone": "+82 10-2605-5238" } } }
```

**결정 1 — 파일 위치는 `data/` 가 아니라 루트입니다.**
`data/` 는 `STATIC.dirs` 에 있어 통째로 배포됩니다(`/data/...` 로 공개). 이 파일은
정적 자산이 아니라 **빌드 입력**이므로 `package.json` 과 같은 급입니다.
루트에 두고 `NOT_DEPLOYED` 에 등재합니다.

**결정 2 — 토큰 문법은 `{{biz.키}}`, 로케일은 파일이 정합니다.**
6개 HTML 어디에도 `{{` 가 없음을 확인했습니다(충돌 없음). 토큰에 로케일을 넣지 않는
이유: 같은 푸터 블록이 두 언어에서 **구조가 같고 값만 다르기** 때문입니다. 로케일을
토큰에 박으면 en 파일에 ko 토큰을 붙여넣는 실수가 조용히 통과합니다.
파일→로케일 대응은 `STATIC.html` 이 명시합니다:

```js
html: [
  { file: 'index.html',      locale: 'ko' },
  { file: 'en.html',         locale: 'en' },
  { file: 'nda.html',        locale: 'ko' },
  ...
]
```

**결정 3 — 치환은 검증 *앞*에 놓습니다.**
`build-static.js` 와 `test/build-static.test.js` 는 「화면에 보이는 문구가 한 글자도
바뀌지 않는다」를 소스와 산출물을 직접 비교해 지킵니다. 치환을 넣으면 이 비교가
당연히 깨집니다. 그래서 비교 기준을 **치환된 소스(resolved)** 로 옮깁니다:

```
읽기 → 치환(resolved) → minify(after)
                 └── tagSequence/visibleText 를 resolved 와 after 로 비교
```

이러면 원래 보장(주석 제거가 문구를 바꾸지 않는다)은 그대로고, 치환은 그 앞 단계로
분리됩니다. 치환이 문구를 바꾸는지는 **별도 테스트**가 지킵니다.

**결정 4 — 미해결 토큰은 빌드 실패입니다.**
오타(`{{biz.ecommerceNumber}}`)가 나면 `{{...}}` 가 화면에 그대로 찍힙니다.
루트 미분류 항목을 빌드 실패로 다루는 이 저장소의 기존 태도와 같습니다 —
조용히 나가는 것보다 깨지는 편이 낫습니다.

### 치환 대상

| 파일 | 위치 | 개수 |
|---|---|---|
| index · nda · precheck · refund · uae | `.footer-biz` 값 6 + `.footer-legal` 법인명 2 | 각 8 |
| en | `.footer-biz` 값 6 + `.footer-legal` 법인명 2 | 8 |

법인명 반복까지 포함하는 이유는 `en.html:1306` 주석이 그 사고를 이미 경고하고
있어서입니다 — "이 값은 en.html 안에서 세 군데 더 나옵니다. 한 곳만 고치면 같은
화면에서 법인명이 두 가지로 보입니다."

### 테스트 (`test/site-config.test.js`)

1. 소스 6개에 하드코딩된 사업자정보 값이 **남아 있지 않다** (토큰만 있다)
2. `ecommerceNo` 를 임시값으로 바꿔 빌드하면 **6개 산출물 전부** 그 값으로 바뀐다
3. 미해결 토큰이 있으면 빌드가 실패한다
4. 치환 전후로 산출물의 사업자정보 블록이 원래 문구와 같다 (기준선 회귀)

---

## A-3 — 개인정보처리방침 + 동의 체크박스

### 페이지 경로

**결정 5 — `privacy.html` / `en-privacy.html` (평면), `en/privacy.html` 아님.**
세 가지 이유입니다.
1. `STATIC.html` 과 루트 미분류 가드가 **평면 파일 목록**을 전제로 짜여 있습니다.
   하위 폴더를 넣으려면 `en/` 을 `STATIC.dirs` 에 넣어야 하는데, `dirs` 는 주석 제거
   없이 통째 복사라 **주석이 그대로 배포됩니다** — 이 저장소가 가장 경계하는 사고입니다.
2. `cleanUrls: true` 에서 `en.html`(→`/en`)과 디렉터리 `en/` 이 공존하면 `/en` 해석이
   호스팅 규칙에 의존합니다. 법정 고지 페이지를 그 위에 올리지 않습니다.
3. 영문 랜딩이 이미 `en.html` 이라 형제 파일이 기존 관례와 맞습니다.

### 페이지 내용 — 사실만

DRAFT 배너(상단 고정, 두 언어):
> 이 문서는 **초안입니다. 법무 검토를 마치지 않았습니다.**
> 확정본으로 교체되기 전까지는 현재 운영 중인 처리 방식을 사실대로 적어 둔 것으로만
> 봐 주십시오. (영문: This is a **draft, pending legal review.**)

기재하는 사실은 코드에서 확인한 것뿐입니다:

| 수집 지점 | 항목 | 근거 | 보관 |
|---|---|---|---|
| §10 사전등록 | 이름, 이메일, 회사명(선택), 동의값 | `api/leads.js` | **DB 저장 없음** — 담당자 메일 + 신청자 확인메일 발송이 전부 |
| /precheck 접수 | 이메일, 업로드 서류, 자사 서식(선택), 거래상대국·HS(선택), 동의 2종·동의시각, 결제정보(유료) | `api/intake.js` · `precheck-schema.sql:160-250` | 접수 30일 후 삭제(`delete_after`). 이용자 요청 시 즉시 삭제(`api/erasure.js`) |
| /uae 세율 조회 | HS 8단위·국가·결과 구분 — **개인정보 없음. IP·UA·식별자 저장 안 함** | `api/lookup-log.js:1-40` | 해당 없음 |

처리 위탁: Resend(메일 발송) · Supabase(저장) · Vercel(호스팅). 셋 다 코드에서 확인됩니다.
**적지 않는 것**: 개인정보보호책임자 성명·직위, 국외이전 상세, 분쟁조정 절차 안내 —
확인된 사실이 아니라서 DRAFT 잔여 항목으로 명시만 합니다.

### §10 폼 동의 체크박스

**결정 6 — 2종으로 나눕니다(필수 1 · 선택 1).**
사전등록 폼의 목적 자체가 「출시 알림 발송」이므로 개인정보 수집·이용 동의(필수)와
광고성 정보 수신 동의(선택)는 법적으로 다른 동의입니다. 하나로 묶으면 선택 동의를
필수에 끼워 파는 형태가 됩니다.

**결정 7 — 필드명은 `consentPrivacy` / `consentMarketing`.**
지시문 예시는 `consentRequired`/`consentOptional` 이었지만, 이 저장소의 기존 관례가
`consentTerms`/`consentTraining`(무엇에 대한 동의인지)이라 의미명으로 맞춥니다.
`Required/Optional` 은 동의의 **성격**이지 대상이 아니라서, 나중에 필수 동의가 하나 더
생기면 이름이 무너집니다.

**마크업** — `precheck.html:693-717` 패턴을 그대로 가져옵니다(`.consents`/`.consent`/
`.consent-head`/`.consent-tag`/`.consent-body`). 필수 표시는 `*` 뱃지 + `required` 속성,
「필수」라는 낱말은 쓰지 않습니다(정본 §8 금지어 · precheck 주석과 같은 규칙).
동의 문구 안에서 방침 페이지로 링크합니다.

**클라이언트 검증** — 기존 `if (!name || !email)` 다음에 필수 동의 검사를 추가하고,
미체크면 메시지 출력 후 `return` (fetch 미발생).

**서버 검증** (`api/leads.js`) — 기존 입력 검증 블록에 `consentPrivacy !== true → 400`
을 추가합니다. `api/intake.js:113` 과 같은 형태로 맞춥니다:

```js
if (body.consentPrivacy !== true) {
  res.status(400).json({ error: 'invalid input', field: 'consentPrivacy' });
  return;
}
```

담당자 메일 본문에 동의 2종의 값과 수신 시각을 함께 적습니다 —
**저장소가 없으므로 이 메일이 유일한 동의 기록**입니다. 이 사실을 코드 주석에 남깁니다.

**결정 8 — Supabase 변경 없음.** `/api/leads` 는 Resend 만 씁니다. 동의 기록을 DB 로
옮기는 것은 별개 결정(테이블 신설·RLS·삭제 정책이 따라옴)이라 이번 범위 밖입니다.

### 푸터 링크

6개 파일 `.footer-links` 에 방침 링크 추가 — 국문 5개는 `/privacy`「개인정보처리방침」,
`en.html` 은 `/en-privacy`「Privacy Policy」. `en.html:1299` 주석(“Privacy Policy 는 아직
페이지가 없어 링크를 걸지 못합니다”)과 `en.html:1241` 주석(“동의 체크는 법무 트랙
미결”)을 현재 상태로 갱신합니다.

### 테스트 (`test/leads-consent.test.js`)

1. `consentPrivacy` 없음 → 400 `field: 'consentPrivacy'` (Resend 호출 이전 단계라
   네트워크가 뜨지 않습니다)
2. `consentPrivacy: 'true'`(문자열) → 400 — `=== true` 엄격 비교 확인
3. 이름·이메일 누락은 종전대로 400
4. `GET` → 405 (회귀)
