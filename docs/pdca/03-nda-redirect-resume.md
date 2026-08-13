# PLAN · DESIGN — C-03 결제 후 자동 리다이렉트 재개 (2026-08-13)

2026-08-13 오전에 긴급 롤백(`2bb1087`)했던 「결제 확정 → `app.trops.kr/c/{intakeId}` 자동
이동」을 다시 켭니다. 롤백 사유였던 trops_a 저장 버그가 원인 확정·수정·배포·검증까지
끝났기 때문입니다.

이 문서는 **재개해도 되는 근거를 실제로 확인한 기록**입니다. 같은 사고가 "로컬은 전부
통과, 배포만 실패"였으므로, 재개 판단을 전언이 아니라 코드·커밋으로 확인했습니다.

---

## 1. 무슨 일이 있었나

| 시각 | 커밋 | 내용 |
|---|---|---|
| 08-13 07:59 | `ffc9d01` | 결제 확정 즉시 `app.trops.kr/c/{intakeId}` 로 이동 추가 |
| 08-13 09:08 | `2bb1087` | **긴급 롤백** — 실사용자가 제출 직후 「링크가 유효하지 않습니다」를 봄 |
| 08-13 09:51 | trops_a `ab14653` | **원인 확정·수정** — `http://` 301 이 POST 를 GET 으로 깎았다 |

### 근본 원인 (trops_a `ab14653`)

Vercel 프로덕션의 `PRECHECK_SUPABASE_URL` 이 `http://` 였습니다. Supabase REST 는
`http://` 요청에 301 로 `https://` 를 돌려주는데, Node `fetch` 는 리다이렉트를 따라가면서
**POST 를 GET 으로 깎고 본문을 버립니다**(fetch 스펙의 301/302 규칙). 그래서
`precheck_nda_run` 삽입이 `error:null · status=200 · raw=[]` 로 **성공처럼 보이면서 실제로는
행을 만들지 않았습니다.**

로컬 `.env.local` 은 스킴이 아예 빠진 값이라 `normalizeSupabaseUrl` 이 `https://` 로 채워
넣어 우연히 정상 동작했습니다 — 로컬 검증이 전부 통과하고 배포만 죽은 이유입니다.

**조치**: ① 프로덕션 env 값을 `https://` 로 정정, ② `normalizeSupabaseUrl` 이 실 프로젝트
도메인의 `http://` 를 `https://` 로 강제 승격(로컬 Supabase CLI 의 `http://localhost` 는 예외),
③ 조사용 우회 코드(raw fetch·`data-diag` 노출) 전부 원복.

---

## 2. 재개 조건 검증 — 전언이 아니라 코드로 확인한 것

| # | 확인 항목 | 방법 | 결과 |
|---|---|---|---|
| 1 | trops_a 수정이 원격에 있음 | `git branch -r --contains ab14653` | ✅ `origin/main` 포함, 작업트리 동기 |
| 2 | 식별자 정합성 | `ndaTriggerFor(id)` 가 `intake` 를 `.eq("id", id)` 로 조회 | ✅ main_web_page 의 `intakeId = row.id` 와 **동일 값** |
| 3 | 리다이렉트 시점 적격성 | `intakeReadyForPipeline` = `status ∉ {awaiting_payment, cancelled}` ∧ `consent_terms` ∧ `file_paths.length > 0` | ✅ `patchOrder(status:'received')` 가 **200 응답보다 먼저** 실행됨 |
| 4 | 검수 게이트 존재 | `NDA_RESULT_REVIEW_GATE_ENABLED = true` | ✅ 켜져 있음 |
| 5 | 게이트 fail-closed | `.isReviewed(...).catch(() => false)` | ✅ 조회 실패 시 **미검수 취급** — fail-open 아님 |

### #3 이 왜 중요한가

`api/payment-confirm.js` 의 순서가 다음과 같기 때문에 경합이 없습니다.

```
5) patchOrder(status:'received', payment_status:'paid', paid_at)   ← DB 먼저 확정
6) sendIntakeMails(...)
   res.status(200).json({ ok:true, token, intakeId, ... })          ← 그다음 응답
                                    │
                                    ▼  브라우저가 이 응답을 받고 이동
                          app.trops.kr/c/{intakeId}
```

브라우저가 이동할 시점엔 `intake.status` 가 이미 `received` 이므로
`intakeReadyForPipeline` 이 통과합니다. 반대 순서였다면 즉석 실행이 자기 전제를 깨고
`InvalidLink` 를 냈을 것입니다.

---

## 3. 설계 — 무엇을 켜고 무엇을 안 건드리나

### 켜는 것

`precheck.html` 의 `confirmPayment()` 성공 분기에서 `intakeId` 가 있으면
`https://app.trops.kr/c/{intakeId}` 로 이동합니다. `ffc9d01` 과 같은 자리·같은 동작입니다.

**폴백을 유지합니다** — `intakeId` 가 없으면(구버전 응답·일시 오류) 기존 `showReceipt(token)`
그대로입니다. 새 경로가 실패해도 기존 경로가 살아 있습니다.

**주소창은 먼저 정리합니다** — `history.replaceState('/precheck?r={token}')` 를 이동 **전에**
실행하므로, 사용자가 뒤로가기를 눌러도 결제 파라미터가 아니라 공식 접수 확인 주소로
돌아옵니다.

### 안 건드리는 것 (요구사항 #4)

**`delivered_at`(환불 기준 타임스탬프)은 그대로입니다.** 이 리다이렉트는 *미리보기*이고,
공식 전달은 지금처럼 사람이 `scripts/deliver.js` 를 돌려야 찍힙니다
(`api/_delivery.js` 의 기존 설계). 리다이렉트가 환불 기준선을 앞당기면 안 됩니다 —
고객이 화면을 봤다는 사실과 우리가 결과물을 인도했다는 사실은 다른 사건입니다.

`token`(access_token) 과 `intakeId`(intake.id) 도 **계속 분리**합니다. 전자는 이 저장소의
공식 접수확인·매직링크용, 후자는 trops_a 미리보기 링크 전용입니다.

---

## 4. 검수 게이트와 20건 임계치 (요구사항 #2·#3)

리다이렉트되더라도 고객이 **실제 대조 내용(diff·판정)을 바로 보지는 않습니다.**
trops_a 의 `renderStoredResult` 가 `precheck_nda_run_review` 행이 있을 때만 결과를
렌더링하고, 없으면 「결과 확인 중입니다」 화면을 보여줍니다.

```
계산 끝남  ─┬─ 검수 행 있음 → 실제 대조 결과
            └─ 검수 행 없음 → 「결과 확인 중입니다」
```

조회가 실패하면 `.catch(() => false)` 로 **미검수** 취급합니다 — 못 읽었을 때 열어주는
fail-open 이 아닙니다.

### 🔴 게이트 해제 임계건수: **초반 실증 20건 전부 검수 통과**

〔2026-08-13 창업자 확정〕 `NDA_RESULT_REVIEW_GATE_ENABLED` 를 `false` 로 뒤집는 조건은
다음 하나입니다.

> **초반 실증 20건이 전부 검수를 통과할 것. 20건 중 일부만 보고 넘어가지 않는다.**

- 「몇 건 해 보고 괜찮으면」 같은 재량 판단을 남기지 않기 위해 숫자를 못 박습니다.
- **전수**입니다 — 20건 중 1건이라도 검수에서 걸리면 카운트를 다시 시작합니다.
  "20건 중 19건 통과"는 해제 조건이 아닙니다.
- 순서가 중요합니다: **먼저 검수로 검증하고 그다음에 끕니다.** 미리 꺼 두고 나중에
  검수를 붙이는 반대 순서가 되면 게이트의 의미가 없습니다.
- 게이트를 끈 뒤에도 `precheck_nda_run_review` 표·`markReviewed`·검수 화면은 **지우지
  않습니다** — 과거 검수 이력이고 필요하면 다시 켭니다.

이 숫자는 trops_a `lib/precheck/nda/review-gate.ts` 주석에도 같은 값으로 적어 둡니다
(스위치가 실제로 있는 자리라, 뒤집으려는 사람이 거기서 조건을 읽어야 합니다).

---

## 5. 알려진 잔여 이슈 (차단 아님)

trops_a 쪽에 **"방금 INSERT 한 행을 같은 요청 안에서 바로 재조회하는 첫 요청"에서만**
일시적으로 `InvalidLink` 가 뜨는 드문 엣지케이스가 있습니다. 다음 요청에서 자동
해소되고 최초 방문자 1회에 한정됩니다.

**이번 재개 작업의 범위 밖입니다** — 그대로 두고 진행합니다. 원인 계열이 다르고
(저장 실패가 아니라 읽기 타이밍), 사용자는 새로고침 한 번으로 정상 화면을 봅니다.

---

## 6. 검증 결과 (2026-08-13)

| 층 | 방법 | 결과 |
|---|---|---|
| 단위 | `npm test` (node --test) | ✅ **244/244 통과 · 실패 0** — 회귀 0 |
| 빌드 | `npm run build` | ✅ 정상 · `dist/precheck.html` 에 리다이렉트 반영 확인 |
| 회귀 | `delivered_at` 경로 diff | ✅ `scripts/deliver.js` · `api/_delivery.js` · `api/payment-confirm.js` **변경 0** |
| 배포 | `curl https://www.trops.kr/precheck` | ✅ 프로덕션 산출물에서 리다이렉트 코드 실물 확인 |
| 라이브 | 실제 제출 1건 e2e | ⏸ **보류** (아래) |

### 라이브 e2e 보류 〔2026-08-13 결정〕

**보류 사유**: 이 경로는 유료 접수 전용이라 e2e 에 **₩99,000 실 결제**가 필요합니다
(`api/_payment.js` `PRICE`). 프로덕션은 라이브 토스 키를 쓰고, 로컬 `.env.local` 에는
토스 키가 없어 테스트 키 경로도 없습니다. 검증 한 번을 위해 실 결제를 만드는 대신,
**첫 실제 유료 접수 건에서 관찰**하기로 했습니다.

리다이렉트는 이미 프로덕션에 켜져 있으므로, 그 첫 건이 곧 실증 20건 카운트의 1건이
됩니다(§4). 그 건에서 확인할 것:

1. 결제 확정 후 `app.trops.kr/c/{intakeId}` 로 실제로 이동하는가
2. 도착 화면이 「결과 확인 중입니다」인가 (「링크가 유효하지 않습니다」가 아니라)
3. `precheck_nda_run` 에 행이 실제로 생겼는가 (롤백 사고의 직접 증상)
4. 검수 완료 표시 후 실제 대조 결과로 바뀌는가

**⚠️ 남은 리스크를 정직하게 적어 둡니다.** §2 의 확인은 전부 코드 판독이고,
배포 확인도 "리다이렉트 코드가 산출물에 있다"까지입니다. 롤백 사고의 교훈이 바로
**"단위 테스트 244개가 전부 통과했는데도 배포에서 죽었다"** 였으므로, 이 작업은
아직 그 교훈이 요구하는 수준의 검증을 통과하지 못했습니다. 첫 유료 건을 반드시
관찰해야 하고, 위 4번 중 하나라도 어긋나면 즉시 재롤백(`2bb1087` 패턴)합니다.

---

## 7. 이 사이클에서 손댄 것

| 저장소 | 파일 | 내용 | 상태 |
|---|---|---|---|
| main_web_page | `precheck.html` | 리다이렉트 복원 + 이력·근거·20건 주석 | 커밋 `bfbd722` · **푸시·배포됨** |
| main_web_page | `docs/pdca/03-nda-redirect-resume.md` | 이 문서 | 커밋 `bfbd722` |
| trops_a | `lib/precheck/nda/review-gate.ts` | 해제 임계치 20건 전수 명시(주석만) | 커밋 `103102a` · **푸시·배포됨** |

trops_a 푸시는 재배포가 걸리는 일이라 사람 승인을 받고 진행했습니다〔2026-08-13 승인〕.
주석 전용이라 `NDA_RESULT_REVIEW_GATE_ENABLED` 값(`true`)과 동작은 그대로입니다.
pre-push 훅이 전체 테스트를 돌려 **3831개 통과**(264 파일)했고, 재배포 후
`app.trops.kr` HTTP 200 정상 확인했습니다.

이로써 20건 임계치가 세 곳(이 문서 §4 · `precheck.html` 주석 · trops_a
`review-gate.ts`)에 같은 값으로 배포된 상태입니다. 셋이 어긋나면 `review-gate.ts` 가
정본입니다 — 스위치가 실제로 있는 자리이므로.
