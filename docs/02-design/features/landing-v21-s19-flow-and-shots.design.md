# Design — 랜딩 v2.1 · 이미지 교체 검증 · §5-17 캡션 · §5-19 흐름도

- Plan: `docs/01-plan/features/landing-v21-s19-flow-and-shots.plan.md`
- 작성: 2026-08-24

## Context Anchor

| 항목 | 내용 |
|---|---|
| WHY | 이미지가 바뀌었는데 문면이 따라오지 않으면 랜딩이 조용히 거짓말을 한다 |
| WHO | 수출 실무 담당자 (랜딩 국문·영문 방문자) |
| RISK | PRD 에 없는 문구를 직접 쓰는 것 |
| SUCCESS | check 게이트 9종 전부 통과 · 90점 이상 |
| SCOPE | `assets/img/` 3장 · `index.html` · `en.html` |

## 1. 설계안 비교 (T1 이미지 처리)

| | A — 무조건 재인코딩 | B — 규격 위반분만 손댐 | C — 전량 재생성 |
|---|---|---|---|
| 내용 | 3장 모두 리사이즈+재압축 | 실측 후 위반한 것만 처리 | 캡처를 다시 떠서 통일 |
| 복잡도 | 낮음 | 낮음 | 높음 |
| 위험 | **멀쩡한 캡처를 재압축해 조문·날짜 글자가 뭉갠다** | 없음 | 캡처 환경 재현 불가 |
| 재현성 | 낮음(재압축은 비가역) | 높음 | 낮음 |

**선택: B — 규격 위반분만 손댐.** 〔자동 승인 · Checkpoint 3〕

이 3장은 UI 스크린샷이라 텍스트 획이 가늘다. JPEG 재압축은 링잉을 만들고,
「근거 제3조 ②」·「확인 기준일 2026-08-23」처럼 **읽혀야 의미가 있는 글자**를 먼저
잃는다. 규격을 이미 만족한다면 손대지 않는 것이 설계상 옳다.

### 1.1 실측 (`sips` · 2026-08-24)

| 파일 | 픽셀 | 비율 | 용량 | 판정 |
|---|---|---|---|---|
| `precheck-report.jpg` | 1600×1000 | 1.6 | 119.5 KB | ✅ |
| `contract-list.jpg` | 1600×1000 | 1.6 | 102.2 KB | ✅ |
| `policy-deadlines.jpg` | 1600×1000 | 1.6 | 122.9 KB | ✅ |

세 장 모두 1600×1000 · 비율 동일 · 500KB 이하. **리사이즈·재인코딩 불필요.**
`<img width="1600" height="1000">` 속성과도 일치하므로 탭 전환 시 레이아웃 시프트 없음.

## 2. T3 흐름도 — 3-3 반응형 방식 권고 (미구현)

지시된 두 안 중 **인라인 SVG + 가로 스크롤 래퍼**를 권고한다.

- SVG 는 `viewBox="0 0 1600 1000"` 에 `font-size` 15~21px 본문을 담는다.
  390px 폭에 맞춰 축소하면 15px 글자가 실효 3.6px 이 되어 조문 번호가 사라진다.
  이 그림의 존재 이유가 「근거 제3조 ② · 확인 기준일 2026-08-23」을 보여주는 것이므로
  축소는 그림을 무의미하게 만든다.
- jpg 대체안은 모바일에서 **텍스트 선택 불가**가 되어 check 조건 5 와 충돌한다.

권고 구현 (원본 확보 시 적용):

```css
.flow-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
.flow-scroll > svg { display: block; width: 1600px; max-width: none; height: auto; }
@media (min-width: 1024px) { .flow-scroll > svg { width: 100%; } }
```

`.flow-scroll` 에 `tabindex="0"` 과 `role="region"` 을 주어 키보드로도 스크롤되게 한다.

## 3. 보류 항목의 처리 원칙

T2·T3 는 **파일을 만들지도, 문구를 쓰지도 않는다.** 반쯤 넣은 섹션은
다음 사람에게 「정본이 있다」는 잘못된 신호를 준다. 흐름도용
`assets/img/flow-how.svg` 는 작업 트리에 그대로 두되 **어디에서도 참조하지 않는다.**

## 4. 변경 파일

| 파일 | 변경 |
|---|---|
| `assets/img/precheck-report.jpg` | 캡처 교체 (기존 작업 트리 변경) |
| `assets/img/contract-list.jpg` | 캡처 교체 (기존 작업 트리 변경) |
| `assets/img/policy-deadlines.jpg` | 캡처 교체 (기존 작업 트리 변경) |
| `index.html` · `en.html` | **무변경** (check 조건 3) |

## 5. Test Plan

L1 규격 실측 · L2 참조 무결성 · L3 결제 diff · L4 폐기어 · L5 회귀 563종.
