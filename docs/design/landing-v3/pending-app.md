# 랜딩 v3 — 운영 배포와 시범 참여 신청 열기

## ✅ v3 운영 배포 — 완료 〔2026-09-30〕

- main `32f71c9` · Vercel 운영 배포 `trops-e1wtl89z4` · 시행일 2026-09-30 · 폼 켜기 커밋 `f28cb3a`.
- 배포 후: 운영 문구 16항목 · 두 주소(`https://trops.kr` · `https://www.trops.kr`) 폼 풀림 · `verify:prod` 16/16 · 앱 대조 통과.
- 대표 운영 시험 신청: 완료 화면 · 접수 메일 · 담당자 알림 · 콘솔 목록 · `?ref=` 모두 [O] → 철회 · 메일 삭제 · 카카오 캐시 초기화.
- 작업 브랜치 `feat/landing-v3` · `feat/landing-v3-pilot-on` 은 main 포함을 확인하고 로컬·원격 모두 지웠습니다.
- 폼만 끄기(여전히 유효): `git revert f28cb3a` → `npm test` → `ALLOW_MAIN_PUSH=1 git push origin main` · 또는 앱 운영 스위치 false.

## 🚀 다음 랜딩 배포 묶음 — 운영 배포 〔2026-09-30 · 대표 「오늘 배포할게」〕

- 같은 날 **두 번째 개정**입니다. §07 에 **「2026년 9월 30일 시행(2차)」** 로 따로 적었습니다(영문 「(second amendment)」) — 1차 판은
  이미 게시됐고 그 판에 동의한 신청이 있어서, 한 항목에 덧붙이면 무엇이 언제 바뀌었는지가 흐려집니다.
- 판 이름 **`pilot-apply-2026-09-30-2`**(1차 `pilot-apply-2026-09-30`) — 두 동의 문구가 같은 이름을 쓰지 않게. 앱은 허용 목록이 없어(1~80자) 그대로 받습니다.
- `set-release-date.js` 에 `--rev N` 을 더했습니다(판 이름 `-N`). 「(2차)」 표지는 사람이 적고 도구는 날짜만 바꿉니다 — **다음 개정 때 표지를 지우고** 새 고지를 위에 올립니다.
- 배포 후 확인은 아래 3) 그대로 · 시험 신청은 대표.

### (아래는 배포 전에 쓴 인수인계 — 기록으로 남깁니다)

### 1) 무엇이 들어 있나 — 브랜치 `feat/landing-next`(main `32f71c9` 위 · 원격 없음)
| 커밋 | 내용 |
|---|---|
| `de6095d` | ① 신청에 **들어오신 경로**(`acquisition`: `ref` = `?from=` 채널 코드 · `utm_*` · `landing_path`) ② 201 에서만 **`apply-success`** 계측(track.js `window.tropsEvent`) ③ 푸터 「문의 · 교육 · 파트너」 → **`/contact`** ④ 방침 §01 · §02 시범 신청 행 · §07 새 고지 · 폼 동의 블록(국문·영문) |
| (이 문서 커밋) | v3 배포 완료 기록 · 이 인수인계 |

- 방침 개정은 **받는 항목이 하나 늘어납니다**(들어오신 경로). §07 고지 「시범 참여 신청에 들어오신 경로를 함께 받습니다」 · 게시한 날 시행.
- 시행일 가안 **2026-10-01** — 배포일에 `set-release-date.js` 로 맞춥니다(머리 · §07 × 국문·영문 + `notice_version`). → **2026-09-30(2차)** 로 맞춤.
- 검사: `npm test` **145** 통과.

### 2) 배포 명령 (대표가 「배포해」라고 한 뒤)
```
cd /Users/hanabeom00/Projects/dev/main_web_page
git status --short                              # 비어 있어야 합니다
git fetch origin && git switch main && git merge --ff-only origin/main   # 로컬 main = 운영
git switch feat/landing-next && git rebase main  # main 이 그 사이 움직였을 때만 필요
node scripts/set-release-date.js YYYY-MM-DD     # 배포일
npm test                                        # 145
git commit -am "docs(privacy): 시행일을 배포일 YYYY-MM-DD 로"
git switch main && git merge --ff-only feat/landing-next && npm test
ALLOW_MAIN_PUSH=1 git push origin main
vercel ls trops                                 # Production ● Ready
```

### 3) 배포 후 확인
- [ ] `/privacy` · `/en-privacy` — 머리 개정일 · §07 첫 소제목 = 배포일 · 시범 신청 행에 「들어오신 경로」
- [ ] `https://www.trops.kr/` — 푸터 「문의 · 교육 · 파트너」가 `/contact` · 판 이름 `pilot-apply-<배포일>`(이번: `pilot-apply-2026-09-30-2`)
- [ ] `npm run verify:prod` 16/16
- [ ] (대표) `https://trops.kr/?from=test-channel&utm_source=test#apply` 로 시험 신청 1건 → 운영 콘솔 «시범 신청» 「유입」 칸에
      `utm_source: test` · `ref: test-channel` · `landing_path: /` → 철회 · 메일 삭제
- [ ] (선택) 앱 계측에서 `apply-success` 라벨이 한 건 잡혔는지

### 4) 되돌리기
- 이 묶음만: `git revert <이 묶음의 커밋들>`(시행일 커밋 포함) → `npm test` → 배포. 방침은 되돌리기 전에 그 사이 받은 경로 기록을
  설명할 수 있는지 봅니다(받았다면 방침은 남기고 코드만 되돌립니다 — `git restore --source=32f71c9 -- index.html assets/track.js`).

### 5) 알아 둘 것
- trops.kr = Vercel 프로젝트 `trops` · main 푸시 = 운영 배포(로컬 pre-push 훅 → `ALLOW_MAIN_PUSH=1`).
- 앱 `acquisition` 은 일곱 키만 받고(그 밖은 버림) 값마다 200자 · `notice_version` 은 허용 목록 없음(1~80자).
- 대표의 작업 방식: 단계마다 검사 결과 보고 · 배포 · 푸시 · 운영 DB 는 그 메시지에서 명시할 때만.
- 영문 랜딩(`en-gaps.md`)은 이번 주 안에 따로(대표 · 2026-09-30).

## 지금 상태

| 자리 | 상태 |
|---|---|
| 신청 폼 | 앱 `POST /api/pilot-apply` 새 계약에 연결됨 — 필수 다섯 · `requested_work` · `referral_code` · 봇 방지 둘 · `notice_version` |
| 완료 화면 | 「N번째로 신청하셨습니다」 + `queue.basis` + 「소개해 주시면 먼저 연락드립니다」 + 내 소개 링크(1분 진단 요약은 넣지 않음) |
| 스위치 | `site.config.json` `pilotApply` — `feat/landing-v3` 는 **운영 false**, `feat/landing-v3-pilot-on` 은 **운영 true**(켜는 커밋 하나 차이) · 미리보기 true |
| 처리방침 | 시범 신청 **확정본**(국문·영문) — §01 · §02 행 · §03 · §04 두 표 · §04 Resend · §06 메일 문장 · §07 고지 하나. **시행일 가안 2026-10-01**(배포일에 맞춤) |
| 동의 문구 | 동의 블록(받는 항목 · 쓰는 곳 · 보관 · 메일) = 방침 §02 행 · 판 이름 `pilot-apply-2026-10-01`(시행일과 같은 날) |
| 시행일 도구 | `node scripts/set-release-date.js YYYY-MM-DD` — 방침 머리·§07 × 국문·영문 + `notice_version` 다섯 자리 |
| 배포 뒤 검사 | `scripts/verify-deployment.js` 두 검사를 v3 에 맞춤(V5 → `.tabs button b` · 여백 옛 값 → 96·68px) |
| 검사 | `npm test` 142 · 앱 쪽 랜딩 대조 5파일 통과 |
| 앱 운영(2026-09-30 확인) | `app.trops.kr/api/pilot-apply` OPTIONS → 204 · `https://trops.kr` · `https://www.trops.kr` 허용 · 빈 본문 → **503 `closed`**(스위치 꺼짐) |

### 스위치가 어떻게 가르는가
- 페이지가 **접속한 주소**를 봅니다 — `https://trops.kr` · `https://www.trops.kr` 이면(호스트 이름으로 봅니다 · 경로·쿼리 무관) `production*` 두 칸, 그 밖(Vercel 미리보기 · 로컬)이면
  `preview*` 두 칸. 빌드 환경변수를 읽지 않습니다(미리보기 배포를 운영으로 올려도 운영 주소에서는 운영 값이 쓰입니다).
- 꺼져 있으면: 신청 섹션은 보이고 · 칸은 잠기고 · 제출 버튼 대신 「지금은 신청 접수를 준비하고 있습니다. 먼저 연락을 원하시면
  contact@theo-ne.com 으로 보내 주십시오.」
- 마크업의 기본이 «꺼짐»입니다 — 스크립트가 없는 브라우저에서도 아무것도 보내지 않습니다.

### 사용자 문구 (응답 → 화면)
| 응답 | 화면 |
|---|---|
| 201 `created` | 완료 화면 「신청이 접수되었습니다」 |
| 201 `updated` | 완료 화면 「신청 내용을 고쳐 받았습니다」 |
| 400 `invalid` · `business_closed` | 앱의 칸별 `message` 를 **그 칸 아래에 그대로** · 폼에 없는 칸이면 폼 아래 한 줄 |
| 400 `bot` · `bad_body` | 잠시 뒤 다시 보내 주세요. |
| 403 `origin` | 이 주소에서는 신청을 보낼 수 없습니다. contact@theo-ne.com 으로 보내 주십시오. |
| 409 `not_updatable` | 앱의 `message` 그대로(없으면: 이미 초대했거나 가입한 신청이라 내용을 바꿀 수 없습니다. 고치실 내용은 contact@theo-ne.com 으로 보내 주십시오.) |
| 413 `too_large` | 적은 내용이 너무 깁니다. 요청하신 업무를 줄여 다시 보내 주세요. |
| 429 `rate_limited` | 신청이 잠시 몰려 받지 못했습니다. 약 N분(초) 뒤 다시 보내 주세요. (`retry_after`) |
| 503 `closed` · `not_effective` | 지금은 신청을 받지 않고 있습니다. 먼저 연락을 원하시면 contact@theo-ne.com 으로 보내 주십시오. |
| 503 `unavailable` · `save` | 지금 신청을 저장하지 못했습니다. 잠시 뒤 다시 보내 주세요. |
| 그 밖 · 네트워크 실패 | 보내지 못했습니다. 잠시 뒤 다시 시도해 주시거나 contact@theo-ne.com 으로 보내 주십시오. |

- ⛔ 201 이 아니면 「접수되었습니다」라고 말하지 않습니다.
- 폼을 연 지 3초가 안 됐으면 모자란 만큼 기다렸다 보냅니다(앱이 `elapsed_ms` 3000 미만을 `bot` 으로 봅니다).
- 소개 링크 꼴: `https://trops.kr/?ref=<코드>#apply`(미리보기에서는 그 미리보기 주소). ⚠️ 계약의 예(`/pilot?ref=`)와 다릅니다 —
  랜딩에 `/pilot` 이 없습니다. **앱 쪽 문서·접수 메일이 링크를 만든다면 이 꼴로 맞춰 달라고 전하십시오.**

## 미리보기에서 시험하기

1. 이 브랜치를 푸시하면 Vercel 이 미리보기를 만듭니다. trops.kr 을 받는 프로젝트는 **`trops`** 이고 그 브랜치 주소는
   **`https://trops-git-feat-landing-v3-teheranroai-9246s-projects.vercel.app`** 입니다(배포마다 바뀌지 않는 브랜치 별칭).
   - ⚠️ 계약 문서의 예 `main-web-page-git-pilot-form-tteehhaa.vercel.app` 은 맞지 않습니다 — 프로젝트 이름과 범위가 다릅니다.
   - ⚠️ 같은 저장소를 **`main_web_page` 프로젝트도** 빌드합니다(도메인 없음). 그쪽 미리보기는
     `https://main-web-page-git-feat-landing-v3-teheranroai-9246s-projects.vercel.app` 입니다 — 시험은 `trops` 쪽 하나로 하십시오.
2. 앱 Preview(prd-v2-pdca) 환경변수 `PILOT_APPLY_ALLOWED_ORIGINS` 에 위 주소를 넣고 **앱 Preview 를 다시 배포**합니다(계약 1).
3. 랜딩 미리보기는 `previewEndpoint` = `https://trops-a-git-prd-v2-pdca-teheranroai-9246s-projects.vercel.app/api/pilot-apply` 로 보냅니다.
   - ⚠️ 앱 Preview 에 **Vercel 배포 보호**가 켜져 있으면 다른 출처의 요청이 401 로 막혀 브라우저에는 CORS 실패로 보입니다
     (화면 문구는 「보내지 못했습니다 …」). 그때는 그 브랜치의 보호를 풀거나 자동화 우회를 설정하십시오.
4. 받을 수 있는 내부 주소로 신청 → 완료 화면의 순번 · 소개 링크 확인 → 소개 링크로 다시 열어 `referral_code` 가 실리는지 확인.
   시험 신청은 운영 콘솔 «시범 신청»의 «신청 지우기(철회)»로 지웁니다.


## 배포 체크리스트 (순서: 앱 스위치 → v3 배포 → 운영 시험 신청)

### 0. 배포 전 (랜딩 · 로컬)
- [ ] 배포일을 정하고 시행일을 맞춘다 — `feat/landing-v3-pilot-on` 에서
      `node scripts/set-release-date.js YYYY-MM-DD` → `npm test`(142) → 커밋
- `llms.txt` 소개 줄 · 방침 Resend 국외이전 행은 이 배포에 들어 있습니다(아래 「정한 것」).

### 1. 앱 운영 스위치 켜기 (대표)
- [ ] 앱 운영 `SELF15_PILOT_APPLY_ENABLED=true` → 앱 운영 다시 배포
- [ ] 확인: `curl -s -X POST -H "Origin: https://trops.kr" -H "Content-Type: application/json" --data '{}' https://app.trops.kr/api/pilot-apply`
      → **`400` `bot`**(503 `closed` 면 아직 꺼짐 · 이 요청은 저장되지 않습니다)
- ⚠️ 1 과 2 사이에는 운영 랜딩 폼이 아직 꺼져 있어 신청이 들어오지 않습니다(앱만 켜진 상태는 안전합니다).

### 2. v3 배포 (처리방침 시행 + 폼 켜기)
- [ ] `git switch main && git merge --ff-only feat/landing-v3-pilot-on` → `npm test`
- [ ] `ALLOW_MAIN_PUSH=1 git push origin main`(로컬 pre-push 훅) → `vercel ls trops` 로 Production **Ready**
- [ ] 운영 확인
  - `https://trops.kr/` · `https://www.trops.kr/` — 제목 「TROPS — 수출 업무를 위한 AI」 · `#apply` 에서 칸이 풀리고 제출 버튼이 선다
  - `/privacy` · `/en-privacy` — 머리 개정일 · §07 첫 소제목이 배포일 · 시범 신청 행이 보인다
  - `npm run verify:prod` → 전부 통과
- [ ] 공유 카드 — `og:description` 이 바뀌었습니다. 카카오 캐시는 developers.kakao.com/tool/debugger/sharing 에서 `https://trops.kr/` 초기화

### 3. 운영 시험 신청 (대표)
- [ ] `https://trops.kr/#apply` 에서 **받을 수 있는 내부 주소**로 1건(`example.com` · `.test` 는 접수 메일이 안 갑니다)
- [ ] 완료 화면: 순번 · 순번 설명 · 내 소개 링크(`https://trops.kr/?ref=TR-…#apply`)
- [ ] 메일: 신청 주소로 **접수 메일** · `contact@theo-ne.com` 으로 **담당자 알림**
- [ ] 운영 콘솔 `https://app.trops.kr/admin/pilot-applications` 에 그 신청(운영자 계정으로 로그인)
- [ ] 소개 링크를 새 창에서 열어 `?ref=` 가 폼에 실리는지(보내지 않아도 됩니다)
- [ ] 정리: 콘솔 «신청 지우기(철회)» · 담당자 알림 메일과 접수 메일 삭제

## 되돌리는 법

### A. 폼만 끄기 — 화면·방침은 v3 그대로, 신청만 멈춤
- **A1 랜딩(권장 · 1~2분)**: `git revert <켜는 커밋>` → `npm test` → `ALLOW_MAIN_PUSH=1 git push origin main`.
  폼이 잠기고 「지금은 신청 접수를 준비하고 있습니다 …」가 섭니다. 켜는 커밋은 `feat/landing-v3-pilot-on` 맨 위
  「feat(apply): 운영에서 시범 참여 신청 폼을 켠다」 하나이고, 되돌리면 운영 기본값 검사도 함께 false 로 돌아갑니다
  (2026-09-30 예행: 되돌린 판 검사 통과).
- **A2 앱만(랜딩 배포 없이)**: 앱 운영 `SELF15_PILOT_APPLY_ENABLED=false` → 앱 다시 배포. 폼은 보이지만 보내면
  `503 closed` → 「지금은 신청을 받지 않고 있습니다 …」. 랜딩을 곧바로 배포할 수 없을 때.
- 방침은 그대로 둡니다 — 이미 받은 신청 기록을 방침이 계속 설명해야 합니다.

### B. 전체 되돌리기 — v11 화면으로
- **B1 급할 때(수십 초)**: Vercel 대시보드 trops → Deployments → 직전 운영 배포(`e8d456b` 판)를 «Instant Rollback».
  ⚠️ **방침까지 옛 판으로 돌아갑니다** — 그 사이 받은 신청이 있으면 방침이 그 기록을 설명하지 못하므로, 같은 날 B2 로 바로잡습니다.
  ⚠️ 롤백 뒤 Vercel 은 운영 주소를 그 배포에 묶어 둡니다 — 다음 운영 배포(승격 · main 푸시) 전에 git 을 B2 로 맞춥니다.
- **B2 git(화면만 v11 · 방침은 v3 판 유지)**: main 에서
  ```
  git restore --source=e8d456b --staged --worktree -- . ':(exclude)privacy.html' ':(exclude)en-privacy.html' ':(exclude)docs'
  npm test          # 옛 판 검사 130 (2026-09-30 예행: 통과)
  git commit -m "revert(landing): v3 화면을 되돌린다 — 방침은 시범 신청 판 유지"
  ALLOW_MAIN_PUSH=1 git push origin main
  ```
  ⚠️ 방침은 「홈에서 시범 신청을 받는다」를 계속 적습니다 — 되돌린 상태가 길어지면 「신청을 닫았다」를 적는 §07 고지가 필요합니다.
- 어느 쪽이든 앱 스위치는 따로입니다 — 신청을 완전히 멈추려면 A2 도 함께.

## 정한 것

- 완료 화면에 1분 진단 요약(`quick_check`)은 넣지 않습니다 〔2026-09-30 · 대표〕 — 요약은 앱의 접수 메일이 싣습니다.
- 문의 접수 메일 문장은 운영에 나갔습니다 〔2026-09-30 · `e8d456b`〕 — 「담당자 알림 한 통 · 접수 확인 메일 없음」.
  `/contact` 합성 접수로 확인(담당자 알림 도착 · 답장 = 접수한 주소) · 시험 기록과 알림 메일은 지웠습니다.
- 운영 판별 주소는 `https://trops.kr` · `https://www.trops.kr` 둘입니다(호스트 이름으로 봅니다 · 검사에 두 주소 모두).
- 시범 신청 방침은 확정본이고 §07 고지는 이번 한 번입니다(시범 신청 · §04 Resend · §06).
- 〔2026-09-30 · 대표 결정 · 다음 묶음〕 신청에 **들어오신 경로(acquisition)** 를 싣습니다 · 신청 접수는 **201 에서만 `apply-success`** 로 셉니다 ·
  폼 칸은 **지금 다섯 개 유지**(넓히지 않음) · 푸터 「문의」를 **`/contact`** 로 되돌립니다.
- 담당자 알림 메일(시범 신청)은 **신청일부터 1년 이내** 파기합니다 — 신청 기록 보관과 같은 기준 〔2026-09-30 · 대표〕.
  자동 배치가 아니라 **사람이 메일함에서 지키는 약속**입니다.
- 방침 §04 국외이전 표에 **Resend, Inc.(미국)** 행을 더했습니다 — 항목 이메일 · 회사명 · 담당자 이름 · 문의·요청 내용 · 목적 메일 발송 〔2026-09-30 · 대표〕.
  이번 §07 고지 하나에 함께 적었습니다.
- 이번 개정은 **게시일 = 시행일**입니다 — §07 고지 끝에 「게시한 날 시행」 〔2026-09-30 · 대표〕.
- `llms.txt` 소개 줄: 「수출 업무를 위한 AI — 견적서·선적서류 초안, 결제기일·통지 기한 관리, 무역보험 서류 준비」 〔2026-09-30 · 대표〕.
- 앱은 `notice_version` 을 허용 목록으로 검사하지 않습니다 — API(`lib/pilot/validate.ts`)와 DB(0150~0153) 모두 「비어 있지 않고
  80자 이하」만 봅니다(운영 `79b9b373` 기준 · 2026-09-30 확인). 새 판 이름을 앱에 등록할 일은 없습니다.

## 남은 일 (배포와 무관 · 급하지 않음)

- 다음 배포 묶음(`feat/landing-next`) — 위 인수인계.

- 영문 랜딩 — `en-gaps.md` 🔴 셋부터.
