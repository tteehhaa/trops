# 히어로 속 앱 화면 — 앱에서 옮긴 값

*작성 2026-09-29 · 랜딩 v3 3단계 · 대상 `index.html` 의 `figure.appfig`*
*앱 기준: `trops_a` 브랜치 `prd-v2-pdca` · 커밋 `dc30e6cc` + 작업 중 트리(같은 날 앱 세션이 작업 중이었습니다)*
*캡처 대조: 같은 폴더의 `preview (3).png`(앱 홈 · Preview 배포)*

원칙은 하나입니다 — **글자와 구성은 앱, 배치·여백·크기·모서리는 시안.**
앱이 이름이나 순서를 바꾸면 **이 표를 먼저** 고치고 `index.html` 을 따라 고칩니다.

## 앱에서 옮긴 것

경로는 `trops_a` 기준입니다. 줄 번호는 위 커밋 기준이라 밀릴 수 있습니다 — 기호 이름으로 찾으십시오.

| 랜딩 자리 | 옮긴 값 | 앱 파일 · 기호 |
|---|---|---|
| 가운데 제목 | `TROPS AI` · 굵기 600 · 자간 -0.02em | `app/organizations/[id]/home/page.tsx:196` (`data-ai-home-title`) |
| 입력칸 안내 문구 | `오늘은 어떤 수출 업무를 도와 드릴까요?` (이름이 없을 때의 꼴) | `lib/work/home-view.ts:76-79` `aiGreeting` |
| 입력칸 화면 읽기 이름 | `TROPS AI 에게 요청` | `components/ledger/home/ai-console.tsx` (textarea 의 `sr-only` 라벨) |
| + 버튼 | 원형 · 테두리 · `+` 아이콘 · 이름 `자료 넣기 · 수출 건 연결` | `components/ledger/home/ai-console.tsx:319` `PlusMenu` |
| 보내기 | 라벨 `보내기` · 입력이 비면 흐림(`disabled:opacity-50`) | `components/ledger/home/ai-console.tsx:249` |
| 보내기 단축키 | Cmd/Ctrl + Enter | `components/ledger/home/ai-console.tsx:192` `onKey` |
| 명령 버튼 이름·순서 | 신규 수출 건 등록 · 견적서(PI) 작성 · 선적서류(CI, PL) 초안 작성 · 운송 견적 요청 · 선적 통보 보내기 · 대금 확인 | `lib/work/ai-settings.ts:23` `DEFAULT_AI_COMMANDS` (label) |
| 명령 배치 | 한 줄에 셋 · 마지막 줄 끝에 `편집` | `components/ledger/home/command-grid.tsx:25` `commandRows(commands, 3)` · `:43` |
| 요약 줄 날짜 꼴 | `9월 29일(화)` | `lib/work/home-view.ts:118,129` `WEEKDAY` · `todayShortDateLine` |
| 요약 줄 항목·순서 | 이달 수출 예정 · 진행 · 받을 돈 · 이달 들어올 돈 | `lib/work/home-status.ts:56` `HOME_STATUS_LABEL` |
| 요약 줄 모양 | 날짜 먼저 · 칸 사이 `·` · 값만 굵게 · 금액 `USD 12,000` 꼴 | `components/ledger/home/status-board.tsx:16-36` `StatusLine` · `home-status.ts:189` `homeStatusLine` |
| 왼쪽 메뉴 머리 | 로고 마크 + `TROPS` · 오른쪽 접기 아이콘 | `components/nav/side-nav.tsx` 브랜드 줄 · `components/nav/brand-mark.tsx` · `lib/constants/brand.ts` `PRODUCT_NAME` |
| 로고 마크 | `public/brand/icon-primary.svg` — 랜딩 `img/icon_primary.svg` 와 **같은 바이트** | 앱 검사 `tests/guardrails/landing-entry-header.test.ts` 가 대조합니다 |
| 회사 줄 | `{회사명} · 소유자` | `side-nav.tsx:388` `LedgerOrgBlock` · `lib/constants/ledger-nav.ts:627` `LEDGER_ROLE_LABEL.owner` |
| 메뉴 무리 | 업무 · 기준 정보 · 참고 (마지막 무리는 제목 없이 선만) | `lib/constants/ledger-nav.ts:142` `LEDGER_NAV_GROUPS` |
| 메뉴 항목·순서 | 업무: 홈 · 수출 거래 · 서류 · 운송 · 대금·보험 · 보내기 / 기준 정보: 바이어 · 수출 품목 / 참고: 수출 정보 / 아래: 회사 · 내 정보 | `lib/constants/ledger-nav.ts:179` `LEDGER_NAV` |
| `+` 가 붙는 항목 | 수출 거래 · 운송 · 바이어 · 수출 품목 | 같은 파일의 각 항목 `add` 칸 |
| 흐린 무리 | 참고(수출 정보) | `ledger-nav.ts:159` `LEDGER_MUTED_GROUPS` |
| 활성 항목 | 옅은 파랑 바탕 + 파랑 글자 · 굵게(왼쪽 막대 없음) | `lib/constants/ui.ts:812` `itemActive` |
| 메뉴 아이콘 | House · FolderOpen · FileText · Truck · Wallet · Send · Contact · Boxes · BookOpen · Building2 · CircleUserRound · Plus · PanelLeftClose (lucide-react 1.33.0 · 선 굵기 1.7) | `components/nav/side-nav.tsx:78` `ICONS` |
| 오늘 확인 머리 | `오늘 확인` + 작은 회색 `N건` · 오른쪽 `기록 보기` | `components/ledger/home/today-list.tsx:84-86` |
| 오늘 확인 카드 | 테두리 한 장 · 줄 사이 구분선 · 줄마다 글 + 오른쪽 테두리 버튼 하나 | `today-list.tsx` `<ol>` (`UI.CARD`) · `:244` `CompactRow` |
| 줄 글 꼴 | `{거래처} · {업무} — {한 줄}` · 거래처만 굵게 | `today-list.tsx:251-259` `CompactRow` |
| 줄 버튼 모양 | 흰 바탕 · 1.5px 파랑 테두리 · 파랑 글자 | `lib/constants/ui.ts:359` `BTN_PRIMARY_OUTLINE_COMPACT` |
| 줄 ① 글 | `선적 통보` — `실제 선적 {날짜} · 바이어에게 알릴 메일` · 버튼 `통보 준비` | `lib/work/types.ts` `WORK_KIND_LABEL.shipping_notice` · `lib/work/derive.ts:159-160` · `:94` |
| 줄 ② 글 | `받을 돈 USD 36,000` — `만기 {날짜} · 3일 남음 · 장부상 잔액` · 버튼 `대금 확인` | `lib/work/derive.ts:162-167` · `:95` |

## 예시 값 (앱에서 오지 않음 — 화면 아래 「화면 예시」)

- 회사명 `○○무역`
- 요약 줄 숫자: 이달 수출 예정 3 · 진행 2 · 받을 돈 USD 108,000 · 이달 들어올 돈 USD 72,000
  — 「이달 들어올 돈」은 제품 탭 ②(`USD 72,000 · 2건`)와 맞췄습니다
- 오늘 확인 두 줄의 거래처(Hanoi Trading · Manila Supply)와 금액 — 제품 탭 ② 표의 거래처와 같습니다
- 날짜 셋(요약 줄의 오늘 · 선적일 = 오늘 −2일 · 만기 = 오늘 +3일)은 스크립트가 서울 시각으로 채웁니다.
  스크립트가 없으면 마크업의 `9월 29일(화)` · `2026-09-27` · `2026-10-02` 가 그대로 보입니다

## 시안에서 가져온 것

창 머리의 점 셋 · 왼쪽 200px + 본문 두 칸 · 본문 여백 28/36/32px · 제목 30px(좁은 화면 22px) ·
입력 상자 모서리 12px · 명령 버튼 모서리 6px · 오늘 확인 카드 모서리 10px · 요소 사이 간격 ·
좁은 화면에서 메뉴 숨김 · 명령 두 칸 · 예시 타이핑 문장 다섯 · 오늘 확인 줄 등장 효과.

## 앱과 다르게 둔 것 (알고 고른 차이)

| 자리 | 앱 | 랜딩 | 까닭 |
|---|---|---|---|
| 파랑 | `#1F56C9` (`tailwind.config.ts` primary) | `#1D4ED8` | 대표 지시 「지금 사이트의 파랑 유지」 |
| 제목 크기 | 40px | 30px | 시안의 축소 비율 |
| 입력 상자 모서리 | 24px(`rounded-3xl`) | 12px | 모양은 시안(요청 목록에 없는 항목) |
| 명령 버튼 모서리 | 둥근 알약(`rounded-full`) | 6px | 같은 사유 |
| 명령 버튼을 누르면 | 입력창에 긴 요청문(`prompt`)을 채움 · 보내지 않음 | 명령 **이름**을 신청 폼으로 넘김 | 긴 요청문이 「연결한 수출 건의 …」로 거래가 있다는 전제라 신청 단계와 맞지 않습니다 |
| + 버튼 | 자료 넣기 · 수출 건 연결 메뉴 | 신청 폼으로 이동(입력 문장을 넘김) | 이 화면은 미리 보기입니다 |
| 메뉴 · 기록 보기 · 편집 · 줄 버튼 | 누르는 자리 | 그림(누르지 않음) | 누르면 신청 폼이 아닌 곳으로 가야 해서 그림으로 둡니다 |
| 윗머리(60px · 「TROPS 홈」 · 로그아웃) | 있음 | 없음 | 캡처(`preview (3).png`)와 시안 모두 없습니다 |
| 사용량 안내 · 자료 넣기 펼침 · 거래 연결 칩 | 조건부로 섬 | 없음 | 조건부 요소 |
| 오늘 확인 맨 앞 줄(요청하신 업무 · 시범 서류 · 첫 설정) | 조건부로 섬(self15 27·28) | 없음 | 가입 뒤에만 서는 줄입니다 |
