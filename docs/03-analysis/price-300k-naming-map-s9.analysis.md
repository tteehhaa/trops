# Check — price-300k-naming-map-s9

Design: `docs/02-design/features/price-300k-naming-map-s9.design.md`
실측 시각: 2026-08-13 · `npm test` 361건 · trops_a `vitest run tests/payment/` 184건

## 1. 채점 (기준: 90점 미만 통과 금지)

| 항목 | 배점 | 실측 | 점수 |
|---|---|---|---|
| ① 가격 ₩300,000 + 노출 시점 | 35 | 5개 좌표 순서대로 이동 · VAT 병기 · 노출 자리 2겹 못질. **티저 재구조화는 별건 분리(요청자 대안대로)** | **32** |
| ② 이름 통일 (모든 노출지점) | 30 | 국문 12곳 · 영문 3곳 · 결제창 주문명 1곳. 폐기 4종 배포본 **0건** | **30** |
| ③ 지도 되돌림 | 25 | 3항목(2개국·애니메이션0·수치0) 국문+영문 양쪽 | **25** |
| ④ 기존 테스트 회귀 없음 | 10 | 361 pass / 0 fail (기준선 349 → +12) · trops_a 184 pass | **10** |
| | **100** | | **97** |

### ① 에서 3점을 뺀 이유

요청의 1번은 두 부분입니다 — **값 이동**과 **노출 시점 재구조화**. 값 이동은 전건
완료됐고, 재구조화는 요청자가 함께 제시한 대안(「최소한 선택 전부터 가격이 안 보이게만
우선 처리하고 전체 재구조화는 별도 보고」)대로 처리했습니다. 대안 경로를 따랐으므로
감점이 아니라 **미완 부분의 표시**로 3점만 남깁니다 — 이 3점은
`docs/03-analysis/price-gate-teaser-restructure.md` 가 닫습니다.

## 2. 실측 로그

### 2-1. 가격 — 5개 좌표

| # | 좌표 | 실측 |
|---|---|---|
| P1 | trops_a `PRECHECK_PRICE.launchKrw` | `300_000` ✅ |
| P2 | trops_a 원장 `RESOLVED_DECISIONS` | `S9-04` 항목 신설 · `PRICE_MIRRORS` note 갱신 ✅ |
| P3 | `api/_payment.js` `PRICE` | `300000` ✅ |
| P4 | `precheck.html` ×3 | `.plan-price` · `.pay-summary-value` · 제출 버튼 라벨 ✅ + `.pay-vat` 신설 |
| P5 | `verify-deployment.js` R1-취소선 | `₩300,000` 존재 + `₩99,000` **부재** + VAT 병기 3단 ✅ |

부수 이동 2곳: `nda.html` FAQ · `refund.html` 적용대상 문장(2곳).

**빌드 실측** (`dist/`, 주석 제거 후):

```
precheck.html   ₩300,000  3건 · ₩99,000  0건 · 부가세(VAT) 별도  1건
nda.html        99,000    0건
refund.html     99,000    0건
```

### 2-2. 이름 — 폐기 4종이 배포본에 0건

```
$ cd dist && grep -l "바이어 서류 사전 확인\|문서 대조\|Document comparison\|Buyer document pre-check" *.html
0건
```

바꾼 자리: index(04 카드 eyebrow · 05 feat-title · 로드맵 구분문구 · 푸터 링크) ·
precheck(`<title>` · og:title · 플랜명 · 동의 문면) · nda(eyebrow · 푸터) ·
uae(푸터 · `DIAGNOSIS_CTA_LABEL`) · refund(meta desc · 서비스명 · 푸터) ·
privacy(본문 · footer-meta · 푸터) · site.config.json · `api/_payment.js` `ORDER_NAME` ·
en(04 카드 · 로드맵 구분문구) · en-privacy(footer-meta).

### 2-3. 지도 — trops_a 정책 대조

| trops_a 단언 | 이 저장소 실측 |
|---|---|
| `EXAMPLE_CODES = ["FR","AE"]` | 핀 2건 = 프랑스·아랍에미리트 (en: France·United Arab Emirates) ✅ |
| 「⛔ 항로선·애니메이션 0」 | `pin-drop` 0건 · `.feat-pin` animation 규칙 0건 · `--i` 0건 (양쪽 파일) ✅ |
| 「예시 점에 건수를 적지 않는다」 | `.feat-pin-meta` 0건 · `D-\d+` 0건 ✅ |

`prefers-reduced-motion` 의 `.feat-pin { animation: none }` 예외도 함께 제거 —
끌 애니메이션이 없어졌으므로 남기면 서로 반대되는 두 규칙이 됩니다.

### 2-4. 검사 변경 내역

| 파일 | 변경 | 신규 단언 |
|---|---|---|
| `test/price-exposure.test.js` | **신설** | 8건 (값 3 · VAT 1 · 노출 2겹 2 · 결제영역 2) |
| `test/naming-consistency.test.js` | 기대 문자열 교체 + 신설 4건 | 05 제목 3종 · 폐기 4종 0건 · title/og/주문명 · 푸터 링크 5페이지 |
| `test/landing-flow-s9.test.js` | 「순차 등장」 → 「제품 정책과 같다」로 **뒤집음** | 2개국 · 수치0 · 애니메이션 3겹 부재 |
| `test/precheck-charge-gate.test.js` | `amount` 기대값 300000 | — |
| trops_a `cross-repo-values.test.ts` | 「값 무변경」 → 「결정이 등재된 값만 움직였다」 | 99,000 미복귀 · 원장 등재 확인 |
| trops_a `precheck-paid-gate.test.ts` | 축 충돌 단언 **뒤집음**(겹쳤다 → 갈라졌다) | `collided === false` |

## 3. 남은 것 · 관측된 것

| # | 내용 | 처리 |
|---|---|---|
| ① | **티저 재구조화 미착수** — 흐름 md §3 과 반대 방향이고 trops_a 계약이 필요 | `price-gate-teaser-restructure.md` 로 분리, 대표 결정 대기 |
| ② | **`listKrw`(290,000) < 판매가(300,000)** — 「정가」로 쓸 수 없는 값이 됐다 | 값은 사본 좌표 유지용으로 남기고, 게시 금지를 양쪽 주석·R1-비교표기가 계속 막음. **미해소 관측** |
| ③ | **로드맵 「확인 항목 요약 자료」 99,000원 (9월 오픈)** 이 판매가 300,000 옆에 남았다 — 준비 중 상품이 파는 상품보다 싸 보이는 배치 | 섹션 머리주석이 「손대지 마십시오」로 못질한 별도 상품. **스코프 밖 · 별건 결정 필요** |
| ④ | `refund.html` 시행일(2026-08-08) 미변경 | 환불 **조건**은 불변이고 적용대상 금액 표기만 현행화. 주석에 근거 명기 |
| ⑤ | trops_a 는 커밋만 하고 **배포하지 않음** | 앞단 판매가는 main_web_page 가 청구하고, trops_a 쪽 값은 게이트가 닫힌 상태의 참조값 |
