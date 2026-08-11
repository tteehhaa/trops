# /en 영문 랜딩 문구 v2

2026-08-11 · 기준 국문 = `trops_랜딩_최종문구_확정본_v3.1.md` (v3.1/v3.2)
v1 → v2 변경: 국문 v3.1 수령에 따라 8개 섹션 재작성

---

## 0. v1에서 바뀐 것

| 섹션 | 변경 |
|---|---|
| 3 안심문구 | 마지막 행 교체 — 「무엇이 유리한지는 대표님이 정하십니다」 → 「정리해드립니다」 |
| 4 2층카드 | H2·라벨이 「서명 전/후」 → 「거래 시작 전/후」. **CEPA 데모 블록 신규 등장** |
| 5 HOW | 「올리고·대조하고·넘깁니다」 → 「제출하고·비교하고·정리합니다」 |
| 7 로드맵 | 「대조표」→「비교표」, 「추적」→「트래킹」 |
| 8 QnA | **15 → 14문항** (「NDA에 서명해도 되나요」 삭제), 기관 나열 순서 변경 |
| 9 마감 CTA | **국문 확정됨** — 제 v1 제안은 폐기 |
| 10 폼 | 보조 문구 교체 |
| 11 기관안내 | 나열 순서 변경 |

## 0-1. 「대조 → 비교」 전환은 영문에 영향 없음 ✅

국문이 랜딩만 「비교」, 제품 앞단·본체는 「대조」로 갈라졌습니다(Option A). **영문은 원래 `compare` 하나로 통일이라 그대로입니다.**

국문 §8에 들어간 병기문구 「(실제 서비스 화면에서는 「대조」라는 표현을 씁니다.)」는 **영문판에 넣지 않습니다.** 앱이 한국어 전용이라 영어 독자는 그 화면을 볼 일이 없고, 넣으면 존재하지 않는 영문 UI 용어를 예고하는 셈이 됩니다.

---

# 1 · 헤더

```
Logo:     TROPS
Anchors:  Service · How it works · FAQ
Button:   Compare my NDA — free
```

> 5지점 ②A로 헤더를 텍스트 링크로 강등하기로 했는데, v3.1 국문은 「버튼」으로 표기돼 있습니다. **국문 기준으로 버튼으로 뒀습니다** — 강등이 유효하면 국문·영문 함께 정정이 필요합니다.

---

# 2 · 히어로

```
[eyebrow]   BEFORE YOU EXPORT

[H1]        First export? Start with the NDA you were sent.

[lead]      Upload the NDA your buyer sent you.
            We compare it line by line against a public standard form
            and mark where they differ.
            We also show you what's left to check.

[CTA 1]     Compare my NDA — free
[CTA 2]     Get notified about trade procedure tracking

[micro]     First 20 free · no sign-up
```

---

# 3 · 안심 문구

```
TROPS does not judge.

We show what the document says.
Public procedures we gather in full. What's in your trade documents,
we move over as it is.
We lay it out so you can decide quickly and easily.

※ This is not a legal advisory service.
```

**번역 노트 2건**

① **마지막 행이 v1과 완전히 다릅니다.** 국문이 「무엇이 유리한지는 대표님이 정하십니다」에서 **「대표님이 빠르고 쉽게 결정하실 수 있도록, 정리해드립니다」**로 바뀌었습니다. 주어가 고객에서 우리로 옮겨왔지만 **결정 주체는 여전히 고객**이라, `so you can decide`로 그 구조를 지켰습니다. `we decide for you`로 읽힐 여지가 없습니다.

② `TROPS does not judge.`는 그대로 뒀습니다. 영어로는 다소 세게 들리는데 국문이 확정본이라 직역을 유지했습니다. 대안 `TROPS reads. You decide.`는 국문과 문장이 달라지는 선택입니다.

---

# 4 · 2층 카드

```
[H2] Once before the deal starts. Once after.
```

**01 카드** (비중 6)
```
AVAILABLE NOW

Before the deal · NDA comparison

Upload the NDA your buyer sent. We compare it line by line
against a public standard form and mark where they differ.

· No sign-up
· First 20 free

[ Compare my NDA — free → ]
```

**CEPA 데모 블록** (01 카드 내부)
```
Tell us the destination country and we'll show you the
agreement tariff rate that applies there.

[ Check UAE tariff rates → ]
```

**02 카드** (비중 4)
```
COMING SOON

After the deal starts · Trade procedure tracking

Deadlines in your trade documents, plus customs and foreign
exchange procedures, gathered in one view with the days
remaining on each.

· Your contract is all you need to start
· Email 7 days and 1 day before each deadline

[ Get notified ]
```

**번역 노트 3건**

① **CEPA 블록은 v1에 없던 신규 문구입니다.** 「확인해 드립니다」를 `show you`로 옮겼습니다 — `check for you`는 우리가 판정한다는 함의가 생깁니다.

② `[ Get notified ]`는 앱으로 보내지 않습니다. 사전 등록 폼으로만 연결됩니다. `Try it` · `Open` · `Start tracking` 류 금지.

③ 「거래 문서」 → `trade documents`. 국문이 「계약서」에서 「거래 문서」로 넓혔으므로 `contract`로 좁히지 않았습니다. 단 불릿의 「계약서만 있으면 시작」은 국문이 그대로 「계약서」라 `Your contract`로 뒀습니다.

---

# 5 · HOW IT WORKS

```
[H2] Submit. Compare. Lay it out.

01  Submit        Send the NDA as you received it. No formatting needed.
02  Compare       We compare it against a public standard form, item by
                  item, and mark the differences.
03  Lay it out    Where judgment remains, we show you where to ask.
```

**번역 노트**

국문이 「올리고·대조하고·넘깁니다」에서 **「제출하고·비교하고·정리합니다」**로 바뀌었습니다.

- 「제출합니다」 → `Submit` (v1의 `Upload`보다 국문에 맞습니다)
- 「정리합니다」 → `Lay it out`. v1의 `Hand off`는 「넘깁니다」의 번역이라 폐기했습니다. `Sort out`은 영국 구어라 톤이 안 맞고, `Organize`는 사무적이라 `Lay it out`으로 갔습니다 — §3 안심문구의 「정리해드립니다」와 같은 동사라 페이지 안에서 일관됩니다

---

# 6 · 신뢰

```
[H2] We show what we compare against.

·  We compare against a standard form published under an open license.
   Reference form: UK Intellectual Property Office public form ·
   Open Government Licence v3.0
   © Crown copyright · checked 10 August 2026

·  We don't write the comparison items. We quote public agency documents
   as they are.

·  We show five fields alongside every item —
   jurisdiction · statute · article · effective date · date checked
```

**제품 이미지 2컷** — 전체 결과지 1장 + 근거 5필드 확대 크롭 1장 (8/20 캡처, 마스킹 없음, 다크 배경 위)

> 저작권 표기는 라이선스 조건이라 **의무**입니다. `© Crown copyright`와 확인일은 빼면 안 됩니다. `Open Government Licence`는 고유명사라 영국식 철자를 유지하고, 본문의 일반명사 `license`와 철자가 다른 것은 의도입니다.

🚫 절대 금지: 재현율·정밀도 수치 · "15 patterns" · 사내 계약서 건수 · ICC · "international standard"

---

# 7 · 로드맵

```
Item comparison sheet         Opens September    ₩99,000
Trade procedure tracking      Coming soon        Pricing to follow
```

> 「확인 항목 비교표」 → `Item comparison sheet`. 「거래 절차 트래킹」 → `Trade procedure tracking`(국문 개명이 「추적→트래킹」이라 영문은 변화 없음).

---

# 8 · 자주 묻는 질문 — 14문항

## ▸ New to this?

**Q. What is an NDA?**
> A non-disclosure agreement. Before serious talks begin, both sides agree
> not to share what they learn from each other. Buyers often send one first,
> usually before the contract itself.

**Q. My industry doesn't use NDAs.**
> Many don't. For now we compare NDAs only. Sales contracts and quotations
> are on the way — register and we'll tell you when they open.

**Q. My buyer is asking me to send a document fee up front.**
> That request comes up often, and it has led to trade fraud in some cases.
> Where you can check on a buyer is listed under "Where can I ask?" below.

## ▸ How it works

**Q. What do you do?**
> We compare the NDA you upload against a public standard form, item by
> item, and mark where they differ.

**Q. Do you tell me which side is better?**
> We mark every difference without exception. What counts as better depends
> on the deal, so that call is yours.

**Q. How do I start?**
> Upload it. No sign-up. The first 20 are free.

**Q. How do I get the result?**
> Through a link we send to your email.

**Q. Is AI doing this?**
> It finds the wording. It doesn't make the call.

## ▸ Can I trust it?

**Q. What do you compare against?**
> A standard form published under an open license.
> Reference form: UK Intellectual Property Office public form ·
> Open Government Licence v3.0 · © Crown copyright · checked 10 August 2026
> Comparison items are quoted from public agency documents as they are.
> We show five fields alongside every item: jurisdiction, statute, article,
> effective date, and the date we checked.

**Q. What happens to the document I upload?**
> The original is deleted automatically after 30 days. We tell you the
> deletion date when you upload. Ask us earlier and we delete it right away.

**Q. My contract has the other party's staff names in it.**
> Other people's information in your document is used only for the
> comparison. We don't collect it separately or use it for training.
> It is deleted after 30 days along with the original.

**Q. Is this legal advice?**
> No. We show what the document says.

**Q. Where can I ask?**
> Korea Customs Service — Customs Valuation and Classification Institute ·
> KOTRA overseas offices · FTA Support Centers ·
> Korea International Trade Association Trade SOS ·
> Ministry of SMEs and Startups Business Support Team.
> We have no affiliation with these organizations and receive nothing from them.

**Q. What does it cost?**
> The first 20 are free. The paid product opens in September, with tax
> invoices issued so you can expense it.
> ← 통신판매업 신고 완료 후 게시

**변경 3건**
- 「NDA에 서명해도 되나요」 삭제 → **14문항**
- 기관 나열 순서를 국문과 동일하게 변경 (공공기관 → 협회 → 중기부)
- 「(실제 서비스 화면에서는 「대조」)」 병기문구는 **영문 미적용** (§0-1)

> **앵커**: "My buyer is asking me to send a document fee up front"와 "Where can I ask?"에서 **11 기관 안내 섹션으로 앵커 링크**.

---

# 9 · 마감 CTA

```
[H2]      One more look before you ask.

[CTA 1]   Compare my NDA — free
[CTA 2]   Get notified about trade procedure tracking

[micro]   First 20 free · no sign-up
```

**번역 노트**

국문 「상담 전에, 한 번 더 확인하세요.」의 「상담」을 영문에서 `consultation`으로 직역하면 유료 자문을 받으러 간다는 인상이 생깁니다. 국문 맥락은 **기관 상담**이고 바로 아래가 기관 안내 섹션이라, `before you ask`로 옮겨 HOW 03단계(`where to ask`)·기관 안내 H2(`Here's where to ask.`)와 같은 동사로 묶었습니다.

- 대안 A: `Take one more look before your consultation.` — 직역에 가까우나 길고, `consultation`이 유료 서비스로 읽힐 여지
- 대안 B: `One last check before you go ask.` — 구어체. 영문판 톤(살짝 formal)에 안 맞음

> 제 v1 제안(`Start with the NDA you were sent.`)은 폐기했습니다. 국문 확정본이 있습니다.

---

# 10 · 사전 등록 폼

```
[H2]   We'll let you know the moment trade procedure tracking opens.
[sub]  Early free slots go to the KOTRA mentor network first.

[Name*]  [Email*]  [Company]

Which documents would you like to compare? (select all that apply)
□ NDA   □ Sales contract   □ Quotation / PI   □ Other

[ Register ]
```

⬜ 개인정보처리방침 동의 체크+링크는 법무 트랙 미결 — 문구 확정과 별개로 진행

> 「초기 무료 서비스는」 → `Early free slots`. v1의 `Free slots`에 「초기」가 빠져 있어 보강했습니다.

---

# 11 · 기관 안내

```
[H2] Here's where to ask.

·  Korea Customs Service — Customs Valuation and Classification Institute
·  KOTRA overseas offices
·  FTA Support Centers
·  Korea International Trade Association — Trade SOS
·  Ministry of SMEs and Startups — Business Support Team

※ We have no affiliation with these organizations and receive nothing
   from them.
```

**표기 원칙**
- 텍스트만. **로고 금지**
- 국문 v3.1의 순서 그대로 (공공기관 → 협회 → 중기부). 클릭 추적으로 순위 변경 금지
- 관세사·법무법인 등 유료 전문가는 이 화면에 넣지 않습니다
- `affiliation` 외에 `partnership` · `partner` 표현 금지

---

# 12 · 푸터

```
[tag]   BEFORE YOU EXPORT

Theone Inc. · CEO Hana Beom · Business Registration No. 625-81-04032
B269-11, 524 Bongeunsa-ro, Gangnam-gu, Seoul, Republic of Korea
contact@theo-ne.com

E-Commerce Business Registration No. [number]

Terms of Service · Privacy Policy · Refund Policy
```

> 🔴 **법인명·대표자명 영문 표기 확인 필요** — 「(주)테오네」·「범하나」의 공식 영문 표기를 등기·사업자등록 기준으로 확인해 주세요. 위는 임시값이고, 법정 고지라 임의 표기하면 안 됩니다.

---

# 13 · 용어 대응표

| 국문 (랜딩) | 영문 | 비고 |
|---|---|---|
| 비교하다 | **compare** | 제품 화면의 「대조」도 영문은 compare — 갈리지 않음 |
| 다른 부분을 표시하다 | mark where they differ | `flag`·`highlight` 금지(판정 함의) |
| 제출하다 | submit | |
| 정리하다 | lay it out | §3·§5 공통 |
| 공개된 서식 | a public standard form | |
| 기준 서식 | reference form | |
| 확인 항목 비교표 | Item comparison sheet | |
| 거래 절차 트래킹 | Trade procedure tracking | |
| 거래 문서 | trade documents | 「계약서」는 contract로 구분 |
| 거래를 시작하기 전 / 후 | before the deal starts / after | |
| 판단이 남는 사안 | where judgment remains | |
| 어디에 물어보시면 되는지 | where to ask | §5·§9·§11 공통 |
| 근거 다섯 가지 | five fields | jurisdiction · statute · article · effective date · date checked |
| 수출을 앞두고 | BEFORE YOU EXPORT | eyebrow·푸터 공통 |
| 협정 세율 | agreement tariff rate | |
| 비용 처리 | expense it | tax invoices issued와 세트 |

**금지어 최종 점검 — 전 섹션 0건**
`assess` `evaluate` `review` `diagnose` `determine` `advise` `recommend` `ensure` `guarantee` `protect` `comply` `required` `necessary` `must` `risk` `compliance` `issue` `opinion` `ICC` `international standard` `accuracy` `%`

---

# 14 · 확인 필요 3건

| # | 항목 | 상태 |
|---|---|---|
| 1 | **헤더가 버튼인가 텍스트 링크인가** | 5지점 ②A는 강등이었는데 v3.1 국문은 「버튼」. 국문 기준으로 버튼으로 뒀습니다 — 강등이 유효하면 한/영 함께 정정 |
| 2 | **마감 CTA 영문 헤딩** | `One more look before you ask.` 채택. 대안 2종은 §9 |
| 3 | **법인명·대표자 영문 표기** | 등기 기준 공식 표기 확인 필요 |

이전에 올렸던 6건 중 CEPA·마감CTA 국문·출처명·체크박스·QnA 문항 수는 **v3.1로 전부 해소**됐습니다.
