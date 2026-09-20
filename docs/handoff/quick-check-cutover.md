# 1분 진단의 자리를 앱으로 옮긴다 — 배치 6 기록

> **왜** 대표 결정 2026-09-21 — 랜딩의 「1분 무료 진단」이 이 저장소의 `/precheck` 가 아니라
> **앱 `app.trops.kr/quick-check`** 로 간다. 같은 6문항에 **회사명 · 수출 상품 · 선적 시기**가
> 더해지고, 로그인 없이 점수를 본 뒤 결과를 계정에 잇는다.
> **짝** 앱 저장소 `docs/handoff/quick-check-landing-handoff.md`(요청) ·
> 이 저장소 `docs/handoff/quick-check-landing-reply.md`(2026-09-20 답신).

---

## 1. 이 배치가 한 것 — L1 · L3

### L1. 링크 6곳이 앱을 가리킨다

| 파일 | `data-track` | 종전 | 지금 |
|---|---|---|---|
| `index.html` | `nav-precheck` · `hero-precheck` · `step1-precheck` · `final-precheck` | `/precheck` | `https://app.trops.kr/quick-check` |
| `about.html` | `nav-precheck` · `about-precheck` | `/precheck` | 같음 |

🔴 **대표 지시는 「4곳」이었고 실측은 «6곳»이었다.** `about.html` 이 같은 nav 를
**같은 이름(`nav-precheck`)으로** 들고 있어서, 한쪽만 옮기면 **한 시계열이 두 목적지를
뜻하게 된다.** 그래서 여섯을 함께 옮겼다.

🔴 **`data-track` 여섯 값은 그대로다** — 버튼 시계열이 끊기지 않는다.

🔴 **⛔ `?from=` 을 손으로 붙이지 않았다.** `/insurance/quick` 과 **반대**다:

| | `/insurance/quick` | `/quick-check` |
|---|---|---|
| 앱 저장 칸 | `from_source`(0053) | `from_source_raw`(0075) |
| 성격 | **닫힌 5값** 집계 축 | **제휴 코드 원문**(열린 축) |
| 그래서 | `?from=landing` 을 박아 둔다 | **비워 둔다** |

`assets/track.js` 가 클릭 순간에 `if (!url.searchParams.get('from'))` 로 채운다 — 박아 두면
그 `if` 가 **채널 코드(`?from=brief`·`?from=2logis`)를 영영 막는다.** 열쇠(`vs`)도 같은 자리에서
함께 붙으므로 랜딩 방문과 앱 방문이 한 줄로 이어진다.

### L1 딸림 ① — `assets/track.js` `nextStepOf`

`'/precheck'` 는 `/quick-check` 를 **잡지 못한다**(부분 문자열이 아니다). 그대로 두면
`nextStepOf` 가 `null` 을 돌려주고 **「다음 걸음」 이벤트가 통째로 사라진다** — 화면에는
「아무도 진단으로 안 간다」로 보이고 **오류는 나지 않는다.** 그래서 한 줄을 더했다:

```js
if (href.indexOf('/quick-check') !== -1) return 'quick-check';
```

🔴 **`'precheck'` 로 합치지 않았다.** 이 값은 「어디로 갔는가」이고 목적지가 실제로 바뀌었다
(랜딩 페이지 → 앱 화면). 합치면 앱의 `movedToApp`(앱으로 간 방문)이 **가장 큰 CTA 를 빠뜨린 채
거짓**이 된다. ⚠️ **대가** — `next:precheck` 시계열이 2026-09-21 에 끊기고
`next:quick-check` 로 이어진다. ⛔ 두 수를 더해 한 줄로 만들지 않는다.

### L1 딸림 ② — 앱 저장소를 같은 배치에서 함께 고쳤다

새 라벨을 앱 사전이 모르면 운영자 화면에 **원문이 그대로 뜨고** 집계에서 빠진다.

- `lib/constants/admin-insights.ts` — `next:quick-check`·`about-precheck` 를 관심 제품(`precheck`)에
  · 사람 말 사전에(`next:precheck` 는 **지우지 않고** 「(랜딩 · ~2026-09-21)」로 시기를 적었다)
  · `PATH_INTEREST` 에 `/quick-check`(그 화면을 연 것도 사전점검에 닿은 것이다)
- `lib/admin/customer-insights.ts` — `APP_BOUND_NEXT` 에 `next:quick-check`

### L3. 개인정보처리방침 §01 · §02

- **§01** — 「1분 무료 진단 버튼도 app.trops.kr 로 이어진다 · 그 화면에서 적으시는 내용
  (**회사명 · 수출 상품** 포함)은 **그 사이트가 받아 그 사이트의 방침이 다룬다** ·
  trops.kr 은 받지도 보관하지도 않는다」 한 문단을 더했다.
- **§02** — 1분 진단 집계 문단을 **지우지 않고** 범위를 좁혔다:
  「이 문단은 **trops.kr 의 사전점검 페이지를 직접 여신 경우**에 해당합니다.」
  🔴 **지금 그것이 사실이기 때문이다** — `precheck.html` 은 살아 있고 **아직 보낸다**(L2 미실행).
- `en-privacy.html` 의 같은 두 자리를 함께 고쳤다(⛔ 한쪽만 되돌리지 말 것).

⏳ **§07 개정 고지는 손대지 않았다 — 대표 판단으로 남긴다.** 이 개정은 trops.kr 이 받는 것을
**줄이는** 쪽이고, 2026-09-20 의 1분 진단 집계 추가도 §07 없이 문단만 늘렸다(그 선례를 따랐다).
⚠️ 머리말의 「개정 · 시행 2026년 9월 12일」도 그대로다. 올려야 한다면 **두 자리를 함께** 고친다.

---

## 2. ⏳ 아직 하지 않은 것 — L2(전송 끄기)

**대표 지시로 여기서 멈췄다.** `precheck.html` 은 **그대로 살아 있고 그대로 보낸다.**

🔴 **그래서 지금 두 지면이 같은 표(`web_quick_check`)에 쓴다** — 랜딩 `/precheck` 를 직접
여신 분과 앱 `/quick-check` 를 쓰신 분이 한 표에 섞인다. 가르는 값은 `from`(지면 기본값
`precheck` ↔ 앱 유입원)뿐이다. ⚠️ 이 창이 열려 있는 동안의 집계를 「앱 1분 진단 응답 수」로
인용하지 않는다.

### L2 가 고칠 자리 — 정확히 넷

1. `precheck.html` — `report()` · `schedule()` · `pagehide` 청취(전송 3종)
2. `precheck.html` `.disc` — 「이름·연락처·회사명은 보내지 않습니다」·「점수는 주소에 담지
   않습니다」 두 문장(`test/quick-check-report.test.js` 가 단정한다)
3. `privacy.html` §02 + `en-privacy.html` — 1분 진단 문단(위 L3 가 **그 자리에 표시를 달아 두었다**)
4. `test/quick-check-report.test.js` — 「방침이 이 집계를 적는다」 두 검사

🔴 **L2 를 실행한 «날짜»를 여기 적는다** — 그날 집계의 계단을 설명하는 유일한 근거다.
▶︎ 실행일: ______

---

## 3. ⏳ 그 뒤에 남는 결정 — `precheck.html` 의 처분

**대표 결정 대기.** 선택지 셋: 301 로 앱에 넘긴다 / 축소해 남긴다 / 병존.
선행 조건은 **프로덕션 나란히 대조**(고정 케이스 8건 목록은 앱 세션이 이미 냈다) —
두 판의 점수·표·설명이 같은지 눈으로 확인한 뒤에 정한다.

⚠️ 함께 볼 자리들(지금은 **손대지 않았다** — 그 페이지가 살아 있어 거짓이 아니다):

- `vercel.json` — `/check` → `/precheck` 리다이렉트
- `index.html` JSON-LD `"url": "https://trops.kr/precheck"` · `en.html` 같은 자리
- `llms.txt` 「수출 사전점검」 줄의 주소
- `middleware.js` matcher 의 `/precheck`

⚠️ **영문은 옮기지 않았다** — `en.html` 의 무료 경로는 그대로
`app.trops.kr/export-precheck/new` 다. `/quick-check` 는 **국문 전용**이라 영문 페이지가
거기로 가면 안 된다(`/precheck` 가 그랬던 것과 같은 사유 · `test/i18n-parity` ④).

---

## 4. 검사

- 이 저장소 `npm test` — **153 통과 · 0 실패**
- `test/landing-invariants.test.js` 「무료 경로 CTA」의 국문 주소를 함께 옮겼다.
  🔴 그 검사가 지키는 것은 **무료 경로의 존재**이지 특정 주소가 아니다(그 검사 머리말이 그 축을
  적어 두었다) — 옮긴 것은 주소이고 지키는 것은 그대로다.
