# TROPS 랜딩 — 블록 1 + 블록 2 재디자인 핸드오프

선택안: **1a**(Hero 조회 블록) + **1c**(STEP BY STEP 로드맵)

## 파일

- `index.html` — 두 블록이 적용된 전체 파일. 기존 파일을 이것으로 교체하면 끝입니다.
- `new-css.css` — 적용된 신규 CSS만 모은 참고용 사본 (index.html에 이미 포함됨).

## 변경 범위 (원본 index.html 기준 행 번호)

### 블록 1 — Hero 좌측 하단
| 위치 | 원본 | 변경 후 |
|---|---|---|
| 마크업 463–482행 | `.hero-lead` / `.hero-sub` / `.hero-note` / `form.hs-form` / `.hs-note` / `.cta-row` | `.hero-lead` / `.hero-sub` / `.hs-box`(라벨 + `.hs-group` + `.hs-meta`) / `.hs-second` |
| CSS 172–192행 | `.hs-form` 계열 · `.hs-note` | `.hs-box` `.hs-box-label` `.hs-group` `.hs-country` `.hs-meta` `.hs-second` `.hs-second-note` |
| CSS 164–171행 | `.hero-note` | 삭제 (마크업에서 미사용) |
| CSS 393행 | `.form-row input, .hs-form input, .hs-form select` | `.form-row input, .hs-group input` |
| CSS 430행 | `.hs-form select { flex: 1 0 100% }` | `.hs-box` / `.hs-group` / `.hs-country` / `.rm-row` 모바일 규칙 |

의도: 액션 4개 → 1차(확인) 1개 + 2차(수출 시작하기) 1개. 관심 등록하기는 Hero에서 제거(아래 섹션에 이미 2회). 문장 4줄 → 2줄, "아랍에미리트 지원" 문장은 `.hs-meta` 보조 문구로 흡수. select 대신 고정 텍스트(`.hs-country`)라 화살표 여백 문제 없음 — 국가가 늘어나면 `.hs-group select`(우측 여백 40px)로 교체.

### 블록 2 — STEP BY STEP
| 위치 | 원본 | 변경 후 |
|---|---|---|
| 마크업 630–654행 | `div.container.how-inner` 안 kicker + h2 + `.cta-sub` + `table` | `div.container.how-inner.how-inner-tight` 안 kicker + `.rm-h2` + `.rm-lead` + `.rm`(3 × `.rm-row`) |
| CSS 316–341행 | `#stages table` 계열 전체 | `.how-inner-tight` `.rm-h2` `.rm-lead` `.rm` `.rm-row` `.rm-name` `.rm-num` `.rm-desc` `.rm-meta` (`#stages { border-top: 0 }` 유지) |

의도: 표 제거 → `.tl-body`와 같은 `minmax(0,300px) minmax(0,1fr)` 행 결. h2 40px → 32px, 리드 1줄, band와의 상단 여백 축소(112px → 68px). 상태 텍스트는 전부 `--muted`(색 없음). 01행은 행 전체가 `/uae` 링크이고 밑줄 없이 hover에서 `--surface` 배경으로 반응합니다.

## 유지된 것
Hero h1 타이포그래피, 우측 거래 흐름 패널(`.wf-*`), HOW IT WORKS 타임라인(`.tl-*`), 관심 등록 폼, 푸터, CTA 섹션 — 변경 없음.

## 제약 준수
강조색 `--accent`(#0F172A) 단독 · `--warning` 미사용 · 버튼 6px / 패널 8px · 그라데이션·그림자·신규 애니메이션 없음(전환은 기존 `.btn`의 `.14s`만) · 본문 16.5px / line-height 1.76.

## QA 체크
- [ ] 데스크톱 1440 / 1200 / 900(1열 전환) / 390
- [ ] HS 8자리 미입력 시 `pattern` 검증 메시지, 제출 시 `/uae?hs=…`
- [ ] `.hs-group` 키보드 포커스 시 테두리 `--muted`
- [ ] 01행 링크가 키보드 탭으로 도달·엔터 동작
