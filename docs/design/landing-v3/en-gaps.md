# 영문 랜딩(`en.html`) — v3 국문과 어긋나 문제가 되는 곳

*작성 2026-09-30 · 이번 배포에서는 `en.html` 을 바꾸지 않습니다(대표 지시). v3 국문 배포 «뒤»의 상태 기준.*

## 🔴 사실이 서로 부딪히는 곳 (먼저 고칠 것)

| # | 영문(`/en`) | 국문 v3(`/`) | 왜 문제인가 |
|---|---|---|---|
| 1 | 3단계 중 「Export receivables management」가 **준비 중** · 「Notify me when … launches」 메일 버튼 | 제품 탭 「장부」 · 「기한」, 대금까지 타임라인, 히어로 앱 화면(받을 돈 · 대금 확인)을 **지금 쓰는 기능**으로 보여 줌 | 같은 회사가 같은 기능을 한 언어에서는 «준비 중», 다른 언어에서는 «있음»이라고 말합니다 |
| 2 | FAQ 「What is TROPS?」 — 수출 거래를 **세 단계**(진단 · 준비 패키지 · 대금 관리 준비 중)로 다루는 소프트웨어 | FAQ 「TROPS는 어떤 서비스인가요?」 — **수출 업무 전용 AI**(거래 등록 · 서류 초안 · 기한 관리 · 보험 서류 맡기기) | FAQ 는 LLM 이 통째로 인용하는 자리입니다 — 두 언어의 JSON-LD `FAQPage` 가 다른 서비스를 설명합니다 |
| 3 | 제목·설명·OG: 「Trade Insurance Paperwork and Export Receivables Management」 | 「TROPS — 수출 업무를 위한 AI」 | hreflang 으로 서로를 번역본이라 선언한 두 장이 다른 제품을 말합니다(검색 결과가 언어마다 다른 회사처럼 보입니다) |

## ⚠️ 흐름이 끊기는 곳

| # | 내용 | 영향 |
|---|---|---|
| 4 | 영문에는 「먼저 사용해 보기」 **시범 참여 신청이 없습니다** · 주 버튼은 1분 진단(한국어 화면) · 「Talk to us」(메일) | `lang=en` 쿠키가 있는 방문자는 `/` 에서 `/en` 으로 307 됩니다(middleware) — 영어 쪽 방문자는 신청 폼을 볼 길이 없습니다 |
| 5 | `en-privacy.html` 은 이제 「early access application on our home page」를 적습니다(§01 · §02) | 영문 홈에는 그 폼이 없습니다 — 방침은 사실(국문 홈에 있음)이지만, 영문 독자에게는 가리키는 곳이 없습니다 |
| 6 | 소개 링크(`https://trops.kr/?ref=…#apply`)를 `lang=en` 쿠키가 있는 사람이 열면 `/en` 으로 넘어갑니다 | `?ref=` 가 영문 페이지에 도착하고 폼이 없어 **소개 코드가 실리지 않습니다** — 영어 사용자끼리 소개하면 끊깁니다 |

## ℹ️ 국문에서 걷었는데 영문에 남은 것 (틀리지는 않음)

- 출처 붙은 통계 셋(KRW 1.46 trillion · 44% · 77%)과 인용 블록 — 국문은 v3 에서 걷었고 `about.html` 의 「출처는 홈에」 문장도 지웠습니다.
- 「Who it’s for」 대상 카드 · 3단계 카드 · 진단 결과 예시 — 국문은 신청 섹션의 ✓/– 세 줄 · 1분 진단 섹션으로 옮겼습니다.
- 헤더 주 버튼이 「Free 1-minute export readiness check」 — 국문은 「먼저 사용해 보기」.

## 🔧 영문을 바꾸는 날 함께 고칠 검사

- `test/landing-invariants.test.js` — `STAT_BLOCK_LANDINGS = ['en.html']` 두 검사(통계 블록이 사라지면 걷음) · `[메타]` 구조 검사(`class="fin"`).
- `test/faq-structured-data.test.js` — 영문 FAQ ↔ JSON-LD 글자 일치(문항을 바꾸면 두 자리 함께).
- `test/disclaimer-parity.test.js` — 영문 FAQ 「Does TROPS apply for trade insurance on my behalf?」 질문 글자 · 푸터 `.nd`.
- `test/i18n-parity.test.js` — 영문 화면에 한글 0 · em dash 0 · 국문 전용 경로(`/contact` · `/about`)로 링크 금지.
- 앱 `tests/payment/cross-repo-values.test.ts` 가 `en.html` 을 대조 파일 목록에 둡니다(파일은 있어야 합니다).
