# flow-s9-track-c Design Document

> **Project**: main_web_page
> **Date**: 2026-08-13
> **Plan**: `docs/01-plan/features/flow-s9-track-c.plan.md`
> **Spec (결정 원본)**: `doc/s9/TROPS_user_flow_2026-08-13.md`
> **Status**: Approved (사용자 지시로 자동승인)

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 선결제 후 대기 구간(결제~전달)이 침묵이라 문의·환불·이탈로 샌다 |
| **WHO** | 로그인 없이 서류를 올리고 이메일만으로 결과를 기다리는 중소기업 대표 |
| **RISK** | 로그인 필드 유입 / 착수 여부 거짓주장 / Hobby cron 상한 / docType 이 기존 접수경로 훼손 |
| **SUCCESS** | 25+30+25+20 = 90점 이상 |
| **SCOPE** | index.html · precheck.html · api/{intake,_notify,_payment-reminder,cron/refund-blocked} · precheck-schema.sql · scripts/ · test/ |

---

## 1. Design Principles

1. **경계 유지** — 이 저장소는 접수·저장·알림·결제만. `precheck_nda_run` 은 **select 만** 한다(`api/_nda-outcome.js` 선례).
2. **앞서 말하지 않는다** — 진행상태 단계는 실제 증적(대조 실행 행)이 있을 때만 올린다.
3. **없으면 안 그린다** — 자리표시자·빈 섹션을 만들지 않는다(기존 `tariff`/`routeNotice` 처리와 동일).
4. **한쪽 실패가 다른 쪽을 멈추지 않는다** — 배치를 합칠 때 `runGuarded()` 로 감싼다.
5. **문면은 한 곳에서** — 메일·화면이 같은 문장을 말해야 하면 상수 한 곳에 둔다.
6. **주석에 근거를 남긴다** — 왜 이 값인지 · 무엇을 하지 말 것인지. 빌드가 주석을 떼므로 소스에만 남는다.

---

## 2. Architecture Options

### 2.1 진행상태(S7) 단계 산출 위치

| | A — 클라이언트 계산 | B — 서버 계산 (선택) | C — trops_a 조회 신규 API |
|---|---|---|---|
| 단계 근거 | `status` 만 (브라우저) | `status` + `precheck_nda_run` 행 존재 | 별도 라우트 신설 |
| "검토중" 정확도 | 낮음 (`in_progress` 는 미착수 건에도 붙음) | **높음 (대조 실행 증적)** | 높음 |
| 신규 코드 | 화면만 | 화면 + `handleReceipt` 1절 | 라우트 1개 + 화면 |
| 판정층 경계 | 유지 | **유지 (select 만)** | 유지 |
| **선택** | | ✅ | 과잉 |

**B 선택 이유**: `api/_nda-outcome.js readOutcome()` 이 이미 있고 `handleReceipt` 는 이미 같은 꼴로 `ROUTE.readLatestRoute()` 를 부른다 — 배선이 한 줄이다. 표를 못 읽어도 `available:false` 로 조용히 낮은 단계로 폴백하므로 접수확인 화면 전체를 잃지 않는다.

### 2.2 리마인드 배치(S9) 배치 위치

| | A — 새 cron 라우트 | B — refund-blocked 병합 (선택) | C — 접수 시 지연 예약 |
|---|---|---|---|
| Hobby 상한(2개) | **위반** — 테스트가 막음 | 준수 | 준수 |
| 발송 시각(KST) | 임의 | 07:40 | 정확히 +3h |
| 필요 인프라 | 없음 | 없음 | Queue/외부 스케줄러 |
| 기존 테스트 | `cron-registration.test.js` 실패 | 통과 | 통과 |
| **선택** | | ✅ | 인프라 추가 필요 |

---

## 3. Data Model

### 3.1 `public.intake` 추가 컬럼

```sql
alter table public.intake
  add column if not exists doc_type                 text not null default 'nda',
  add column if not exists payment_reminder_sent_at  timestamptz;

alter table public.intake drop constraint if exists intake_doc_type_allowed;
alter table public.intake add  constraint intake_doc_type_allowed
  check (doc_type in ('nda'));

-- 리마인드 후보: 유료 · 결제 대기 · 아직 안 보낸 건. 대부분의 행이 해당 없음 → 부분 색인
create index if not exists intake_payment_reminder_idx
  on public.intake (received_at)
  where intake_path = 'paid'
    and payment_status = 'pending'
    and payment_reminder_sent_at is null;
```

- `doc_type` 의 check 를 `('nda')` 로 **좁게** 둔다. 화면에서 준비중인 값이 실수로 새어 들어오면 DB 가 막는다. 서류종류를 늘릴 때 이 한 줄과 화면 `<option>` 을 함께 고친다.
- `payment_reminder_sent_at` 이 **멱등의 근거**다. 배치가 두 번 돌아도 두 번 보내지 않는다.

### 3.2 `docType` 왕복 경로

```
precheck.html  <select id="intake-doc-type"> value="nda"
   │  (준비중 옵션은 disabled — 폼 직렬화에 안 실림)
   ▼  POST /api/intake { docType: 'nda', … }
api/intake.js  parseDocType()  아는 값만 통과, 모르면 400
   ▼
intake.doc_type = 'nda'
   ▼  GET /api/intake?r=<token> → { docType }
접수확인 화면  addRow('서류 종류', '비밀유지계약서(NDA)')
   ▼
운영자 알림 메일  <strong>서류 종류:</strong> 비밀유지계약서(NDA)
```

**아는 값만 통과(allowlist)** 는 `readDeclaration()` · `_intake-route.js ROUTES` · `_nda-outcome.js OUTCOMES` 가 이미 쓰는 이 저장소의 표준 패턴이다. 다만 `detection` 과 달리 `docType` 은 **틀리면 400** 이다 — 접수의 요건이고, 조용히 `nda` 로 눕히면 나중에 계약서를 보낸 사람의 건이 NDA 로 대조된다.

---

## 4. Component Design

### 4.1 S1 — KOTRA 재배치 (index.html)

```
09 마감 CTA
  h2  확인이 더 필요하시면, 편하게 물어보세요.
  .close-cta-row   [문의하기] [기한관리 미리보기]
  .close-cta-kotra 초기 서비스는 KOTRA 멘토 네트워크에 먼저 배정됩니다.   ← 신설
  .close-cta-note  보내주시면 순서대로 메일로 회신드립니다.
```
`#interest` 의 `.interest-sub` 는 제거. 스타일은 `.close-cta-note` 와 같은 스케일을 쓰되 `--ink-62` 로 한 단계 위(신뢰신호 > 절차 안내).

### 4.2 S2 — 애니메이션

| 대상 | 방식 | reduced-motion |
|---|---|---|
| `.stat-line` + `.stat-src` | `.reveal` 클래스 → `opacity 0 / translateY(14px)` → IntersectionObserver 가 `.is-in` 부착 → `.42s ease-out` | transition/transform 제거, 즉시 표시 |
| 기한관리 핀 | `.feat-pins` 안의 `.feat-pin` n개. 패널이 열릴 때(`data-open="1"`) `animation: pin-drop .34s ease-out both` + `animation-delay: calc(var(--i) * 160ms)` | `animation: none`, 전부 보임 |
| 아코디언 | **변경 없음** (`grid-template-rows 0fr→1fr .24s`) | 기존 규칙 유지 |

핀은 **지도 없이** 목적국 라벨만 붙은 추상 마커다(프랑스 · 아랍에미리트 · 베트남 — md §1 이 예시로 든 샘플 데이터). "실제 화면 캡처 준비 중" 문장을 그대로 유지해 제품 화면으로 오독될 여지를 남기지 않는다.

CSS 로 켜지 않고 **JS 가 `.is-in` 을 붙이는** 이유: JS 가 죽으면 문장이 보이지 않아야 하는 게 아니라 **그대로 보여야** 한다. 그래서 초기 숨김도 JS 가 `.reveal-armed` 를 붙인 뒤에만 적용한다(no-JS = 항상 보임).

### 4.3 S4 — FAQ 문항

`▸ 어떻게 쓰나요`(2번 묶음, qa-4~8) 끝에 `qa-14` 로 추가. 1번(처음이신가요=용어)·3번(믿을 수 있나요=신뢰)이 아니라 2번인 이유: **"어느 경로로 시작하나"** 는 사용법 질문이다.

```
Q 셀프서브 사전점검이랑 문의하기는 뭐가 달라요?
A 지금 바로 결과를 받고 싶으시면 사전점검, 저희 대표님과 먼저 상황을 얘기하고 싶으시면 문의하기입니다.
```
문구는 md §5-1 13번 원문에서 "상담신청"→"문의하기"만 바꿔 쓴다(§2 CTA 표가 명칭을 확정).

### 4.4 S5 — 문서유형 선택 (precheck.html)

`#intake-form` 최상단(이메일 필드 **앞**)에 둔다 — "무슨 서류를 보내는가"가 이메일보다 먼저 정해지는 순서다.

```html
<div class="field">
  <label for="intake-doc-type">문서 종류 <span class="req">*</span></label>
  <select id="intake-doc-type" name="docType" required>
    <option value="nda" selected>비밀유지계약서(NDA) — 현재 지원</option>
    <option value="contract" disabled>거래계약서 — 준비중</option>
    <option value="quotation" disabled>견적서 — 준비중</option>
    <option value="po"        disabled>발주서(PO) — 준비중</option>
  </select>
  <p class="field-hint">지금은 NDA만 대조할 수 있습니다. 나머지는 준비 중입니다.</p>
</div>
```

- `disabled` 옵션은 **보이지만 고를 수 없다** — md §5 의 "새 페이지 없이 옵션만 늘어난다"를 화면에서 미리 보여주면서 오접수는 막는다.
- **로그인/계정 필드는 추가하지 않는다.** `.pay-note` 의 "로그인이나 회원가입은 필요 없습니다"가 그대로 유효해야 한다.

### 4.5 S6 — SLA 문구

```html
<p class="pay-refund">
  요약 자료를 받으시기 전에는 전액 환불해 드립니다. <a href="/refund">환불규정 보기</a>
</p>
<p class="pay-sla">영업일 기준 24시간 내 전달해 드립니다.</p>
```

- md §3·§5-1 1번의 "영업일 기준 O시간"에서 **O = 24**. 근거: 접수확인 메일·`deliver` 섹션이 이미 "**당일** 안에" 를 약속하고 있어, 그보다 느슨한 값을 새로 쓰면 두 문면이 어긋난다. 24시간은 "당일"의 영업일 환산 상한이다.
- 자리는 `.pay-area` 안(결제 화면) — md §3 이 "결제 화면에 크게 명시"로 지정.
- ⚠️ 이 숫자를 바꿀 때 `api/_notify.js` 의 "당일 안에" 문장을 함께 보아야 한다.

### 4.6 S7 — 진행상태 3단계

**서버 (`api/intake.js handleReceipt`)**

```js
// 3단계 진행 라벨의 근거 〔S7〕
//   delivered      → 3 전달완료   (delivered_at/status 가 곧 증적)
//   대조 실행 있음  → 2 검토중     (precheck_nda_run 행 = 엔진이 돈 증적)
//   received/in_progress → 1 접수됨
//   awaiting_payment/cancelled → null (트래커 자체를 그리지 않음)
const outcome = await OUTCOME.readOutcome(config, row.id);
const stage = progressStage(row.status, outcome.available && Boolean(outcome.row));
```

**화면**

```
접수됨 ──── 검토중 ──── 전달완료
  ●          ○           ○
```
`<ol class="steps">` + `aria-current="step"`. `stage === null` 이면 렌더하지 않는다.

⚠️ `in_progress` 를 2단계로 올리지 않는다 — 기존 `statusLabel` 주석이 "이 상태는 접수만 되고 사람이 아직 손을 대지 않은 건에도 붙는다"고 실측을 남겨 뒀다.

### 4.7 S8 — 결제확인 메일 기한관리 링크

`sendIntakeMails` 이용자 메일의 매직링크 문단 **뒤**, 협정세율 문단 **앞**에 삽입.

```html
<hr>
<p><strong>결과 준비되는 동안, 기한관리 먼저 둘러보세요.</strong></p>
<p>계약서 하나에 기한이 몇 개나 숨어있는지 아세요?
   등록된 거래가 목적국 위에 표시되는 화면을 로그인 없이 보실 수 있습니다.</p>
<p><a href="{origin}/#feat-timeline">기한관리 미리보기</a> · <a href="{appOrigin}/">계약 등록해보기</a></p>
```

- 랜딩 훅 문장(`.feat-hook`)을 그대로 재사용 — 메일과 화면이 같은 말을 한다.
- 링크는 `/#feat-timeline`. 랜딩 아코디언 카드 id 가 그것이고, 앵커로 그 자리까지 간다(패널 펼침은 JS 트리거 몫이라 앵커만으로는 접힌 채 도착 — 카드 제목은 보이므로 죽은 링크가 아니다).
- **무상/유료 양쪽에 붙인다.** md §3 은 결제확인 메일을 지목했지만 대기 공백은 무상 건도 같고, `sendIntakeMails` 는 두 경로가 공유하는 한 함수다.

### 4.8 S9 — 결제 미완료 리마인드

**본체: `api/_payment-reminder.js`** (`_cleanup.js`/`_route-refund.js` 와 같은 층)

```
후보 조회  intake_path='paid' AND payment_status='pending'
           AND payment_reminder_sent_at IS NULL
           AND received_at <= now - REMIND_AFTER_HOURS(3)
           AND status='awaiting_payment'
           AND erasure_requested_at IS NULL          ← 자료 지운 사람에게 결제 독촉 금지
           AND received_at >= now - MAX_AGE_HOURS(72) ← 3일 지난 건은 회수 대상 아님
   ↓ 건별
① 메일 발송 (sendPaymentReminderMail)
② 성공 시에만 payment_reminder_sent_at = now  ← 실패 시 다음 실행이 재시도
```

- **①→② 순서가 중요하다.** 먼저 표시하면 발송 실패한 건이 영구히 회수 불가가 된다. 반대로 발송 후 표시 실패 시 다음날 한 번 더 갈 수 있는데, "1회"의 위반이지만 회수 불가보다 낫다(같은 트레이드오프를 주석에 남긴다).
- `MAX_AGE_HOURS` 상한을 두는 이유: 컬럼을 나중에 추가하므로 **기존 `awaiting_payment` 잔행 전체가 첫 실행에서 후보가 된다.** 며칠 전에 그만둔 사람에게 갑자기 독촉메일이 가는 것을 막는다.
- **결제화면 복귀 링크**: `/precheck?resume=<token>` 이 아니라 `/precheck` 로 보낸다. 현재 접수 폼은 파일을 다시 받는 구조이고 재업로드 없는 결제 재개는 trops_a/주문 재사용 설계가 선행이라 이번 스코프 밖 — 메일 문면도 그에 맞춰 "다시 보내주시면"으로 정확히 쓴다. **거짓 약속("재업로드 불필요")을 하지 않는다.**

**라우트: `api/cron/refund-blocked.js`** 에 3번째 `runGuarded()` 잡으로 추가. 응답에 `paymentReminder` 필드 추가, `failed` 판정에 합산.

**CLI: `scripts/refund.js` 계열과 같은 꼴로 `scripts/payment-reminder.js`** — `--apply` 없이는 미리보기. `package.json` 에 `remind:preview` / `remind:apply` 추가.

---

## 5. Error Handling

| 상황 | 처리 |
|---|---|
| `precheck_nda_run` 못 읽음 | `stage` 를 1단계로 두고 200 유지. 접수확인 화면 전체를 잃지 않는다 |
| `docType` 미지의 값 | 400 `{ error:'invalid input', field:'docType' }` — 조용히 눕히지 않는다 |
| `doc_type` 컬럼 미생성(스키마 미실행) | insert 가 PGRST204 로 실패 → 접수 502. **그래서 배포 전 스키마 실행이 선행이다** (릴리스 노트에 명시) |
| 리마인드 메일 실패 | `payment_reminder_sent_at` 미기록 → 다음 실행 재시도. `errors[]` 에 실어 응답 |
| `payment_reminder_sent_at` 컬럼 미생성 | 후보 조회가 실패 → `available:false` 로 0건, 200 유지 (표 없음을 실패로 세지 않는 기존 원칙) |
| IntersectionObserver 미지원 | `.reveal-armed` 를 붙이지 않아 문장이 처음부터 보인다 |

---

## 6. Test Plan

| ID | 대상 | 단정 |
|---|---|---|
| T1 | `parseDocType` | `nda` 통과 / 미지값 400 / 미전송 시 기본 `nda` |
| T2 | 접수 왕복 | insert row 에 `doc_type` 이 실린다 |
| T3 | `progressStage` | 5개 status × 대조행 유무 조합의 단계값 |
| T4 | `sendIntakeMails` | 이용자 메일 본문에 기한관리 링크·훅 문장이 있다 |
| T5 | `_payment-reminder` 후보 선정 | 3h 미만 제외 / 이미 보낸 건 제외 / 삭제요청 건 제외 / 72h 초과 제외 |
| T6 | `_payment-reminder` 멱등 | apply 후 같은 건이 다시 후보가 되지 않는다 |
| T7 | cron 등재 | `refund-blocked` 응답에 `paymentReminder` 가 있고 cron 수는 2개 유지 |
| T8 | precheck 화면 | `docType` select 존재 / SLA 문구 존재 / `type="password"` 0건 |
| T9 | index 화면 | KOTRA 문구가 `.close-cta` 안에 1건, `#interest` 에 0건 / FAQ 15문항 |
| T10 | 회귀 | 기존 244건 전건 통과 + `npm run build` 성공 |
