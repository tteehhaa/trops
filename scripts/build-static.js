#!/usr/bin/env node
'use strict';

/**
 * 배포용 정적 산출물을 dist/ 로 만듭니다.
 *
 * 하는 일은 둘입니다 — 사업자정보 토큰 치환, 그리고 주석 제거
 * (HTML · CSS · JS 세 종류 전부).
 *
 * 치환은 2026-08-11 에 들어왔습니다. 그전에는 사업자정보 6항목이 6개 HTML 에
 * 각자 하드코딩돼 있었고, 통신판매업신고번호가 확정되면 6곳을 손으로 고쳐야 하는
 * 상태였습니다. 이제 site.config.json 한 곳이 원본입니다.
 *
 * 이 저장소는 주석을 인수인계 수단으로 씁니다(정본 조항 번호 · 미결 항목 · 왜 이렇게
 * 했는지). 그건 소스에 남아야 하지만, 세 종류 전부 브라우저로 전송됩니다 —
 * HTML 주석은 「소스 보기」로, <style>·<script> 안의 주석은 그 파일 자체로 읽힙니다.
 * 「8/20 캡처 대기」·「미결 L-1」·승인 이력 같은 문장이 trops.kr 에서 공개적으로
 * 읽히던 상태였습니다.
 *
 * ⚠️ 주석만 뗍니다. 압축·난독화·공백 정리를 하지 않습니다.
 *    렌더링이 한 픽셀도 바뀌면 안 되는 페이지라 최소 개입만 합니다.
 *    (collapseWhitespace 를 켜면 한글 인라인 요소 간격이 바뀝니다)
 *
 * 소스 파일은 건드리지 않습니다. 읽어서 dist/ 에 쓰기만 합니다 —
 * 로컬에서 `vercel build` 를 돌려도 작업 중인 .html 이 바뀌지 않습니다.
 *
 * ⚠️ 루트에 새 정적 파일·폴더를 추가하면 이 스크립트가 빌드를 실패시킵니다.
 *    아래 STATIC 과 NOT_DEPLOYED 중 어디에 속하는지 적어 주십시오.
 *    조용히 빠뜨리는 것보다 빌드가 깨지는 편이 낫습니다.
 *
 * 🔴 **미추적 임시 사본은 «등재하지 않고 지웁니다»** 〔2026-08-30 · 대표 승인〕.
 *    NOT_DEPLOYED 는 「배포는 안 하지만 저장소의 일부인 것」입니다(api · docs · scripts).
 *    손으로 옆에 치워 둔 백업을 여기 넣으면 그 뜻이 무뎌지고, 다음 사람이 같은 자리에
 *    또 넣습니다. 빌드가 깨진 것은 이 표가 제 일을 한 것입니다.
 *    ⚠️ 실제 사례 — `en-old.html`(213KB · 미추적)이 2026-08-30 랜딩 정리 도중 남아
 *       빌드를 막았고, 앞선 두 세션이 그것을 비켜 갔습니다. 지웠습니다.
 *       그 파일은 커밋 `e514388f` 의 `en.html` 과 **바이트 단위로 같았습니다**
 *       (sha256 `e344a74b6adb2829…`) — 필요하면 되살릴 수 있습니다:
 *         git show e514388f:en.html > en-old.html
 */

const fs = require('fs');
const path = require('path');
const { minify } = require('html-minifier-terser');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'dist');

/**
 * 배포되는 정적 자산. 루트 기준.
 *
 * locale 은 site.config.json 의 어느 묶음(biz.ko / biz.en)으로 토큰을 채울지 정합니다.
 * 토큰 자체에는 언어가 없습니다 — 같은 푸터 블록이 두 언어에서 구조가 같고 값만
 * 다르기 때문입니다. 토큰에 언어를 박으면 en 파일에 ko 토큰을 붙여넣는 실수가
 * 조용히 통과합니다. 여기서 파일 단위로 한 번만 정합니다.
 *
 * ⚠️ 평면 목록입니다. 하위 폴더(en/privacy.html)를 넣지 마십시오 —
 *    폴더는 STATIC.dirs 로 가야 하는데 dirs 는 주석 제거 없이 통째 복사입니다.
 *    영문 페이지는 형제 파일(en.html · en-privacy.html)로 둡니다.
 */
/**
 * 🔴 **푸터 티어** 〔신설 2026-09-04〕 — 「이 페이지가 푸터에 **무엇을 실어야 하는가**」를
 *    여기 한 곳에 선언합니다. 아래 `STATIC.html` 의 `footer:` 칸이 이 표를 가리킵니다.
 *
 * ⚠️ **왜 필요했나 — 이 축이 어디에도 없었습니다.** `test/site-config.test.js` 와
 *    `scripts/verify-deployment.js`(`법인명-ko`) 는 둘 다 「각 페이지가 **자기가 쓴**
 *    토큰의 값을 갖는가」를 봅니다. 그것은 «배선»(설정 → 산출물) 검사로 맞고, 두 주석이
 *    스스로 「푸터 구성이 바뀌어도 이 검사는 낡지 않습니다」라고 적어 두었습니다.
 *    바로 그래서 **푸터가 줄어드는 것을 볼 수 없었습니다** — 2026-09-04 실측에서
 *    `/precheck`·`/contact` 가 상호·대표·이메일 **한 줄만**(93px) 싣고 있었는데
 *    두 검사 모두 초록이었습니다(정책 4장 355~377px · 랜딩 363px).
 * 🔴 **두 사고 다 「파일을 새로 지으며 옛 푸터를 안 옮긴 것」입니다** —
 *    `ca47218`(옛 precheck.html 삭제) → `cbd233a`(새로 세움) ·
 *    `a962bf9`(check.html 삭제) → `90d95ec`(contact.html 신설).
 *    푸터 블록은 태어난 뒤 한 번도 고쳐지지 않았습니다(`git log -L` 결과가 생성 커밋 하나).
 *    선언을 두면 다음에 페이지를 새로 지을 때 `footer:` 가 없어 **빌드가 멈춥니다.**
 * ⛔ 티어를 늘리지 마십시오. 셋이면 충분하고, 넷째가 생기는 순간 「이 페이지는 어느
 *    쪽인가」가 다시 사람의 판단거리가 됩니다 — 새 페이지는 셋 중 하나를 고르십시오.
 */
const FOOTER_TIERS = {
  /** 정책 페이지 — 사업자정보 여섯을 전부 싣습니다. */
  full: {
    biz: ['companyName', 'ceo', 'registrationNo', 'ecommerceNo', 'address', 'phone'],
    policyLinks: true,
    copyright: true,
  },
  /*
   * 랜딩·전환 페이지 — 요약 넷입니다.
   * ⚠️ 통신판매업신고번호·전화가 **의도적으로** 빠져 있습니다. 신고번호는 신고 전이고
   *    (`site.config.json` 의 `ecommerceNo` 가 「신청 중」), 그 판단은 `index.html` 푸터
   *    주석과 `test/site-config.test.js` 주석이 이미 적어 두었습니다.
   *    ⛔ 여기에 그 둘을 넣지 마십시오 — 넣는 순간 랜딩 두 장이 red 가 됩니다.
   */
  summary: {
    biz: ['companyName', 'ceo', 'registrationNo', 'address'],
    policyLinks: true,
    copyright: true,
  },
  /*
   * 푸터가 **없는** 페이지. 지금은 0장입니다.
   * 🔴 이 값이 있는 이유 — 종전 `test/site-config.test.js` 의 `carriesBiz` 는 「소스가
   *    `{{biz.` 를 쓰는가」로 대상을 **추측**했고, 그 주석이 `sample.html`(푸터 없음)에서
   *    거짓 red 가 나는 것을 피하려고 그렇게 했다고 적고 있었습니다. 선언이 있으면
   *    추측할 이유가 없습니다 — 그런 페이지가 생기면 여기로 보내십시오.
   */
  none: null,
};

const STATIC = {
  // en.html 은 cleanUrls 로 /en 에 붙습니다 (vercel.json).
  /*
   * 🔄 **여섯 장을 내렸다** 〔2026-08-30 · 대표 지시 「nda·uae·precheck 안 씀 · 영문 동일」〕.
   *    `precheck.html` 은 **접수·결제 폼 자체**였다 — 그 흐름이 함께 내려간다.
   * 🔴 **이미 나간 링크는 살렸다** — 접수 확인 메일이 `/precheck?r=<token>` 을 가리키므로
   *    `vercel.json` 이 그 토큰을 **결과지**(`app.trops.kr/c/<token>`)로 넘긴다. 그냥 지우면
   *    그 메일의 링크가 전부 404 다.
   * ⚠️ 여기서 빼면 배포만 안 되고 파일은 남는 조용한 실패가 되므로 **파일도 함께 지웠다.**
   *
   * 🔄 **사전 확인 3문항도 내렸다** 〔2026-08-30 · 대표 지시〕 — `check.html` · `en-check.html`.
   *    3문항을 거쳐 접수 폼으로 보내던 구조 자체가 없어졌다(2026-08-24 랜딩 CTA 가 앱
   *    가입으로 바뀐 것이 의도된 폐기였다). 실측: 랜딩 인바운드 링크 0 · page_events 기준
   *    2026-08-24 이후 조회 0건.
   *    ⚠️ 두 장은 hreflang 짝이라 **함께** 내렸다. 한 장만 내리면 남은 쪽의 hreflang 이
   *       없는 상대를 가리킨다(검색엔진은 상호 지목이 아니면 무시한다).
   */
  html: [
    { file: 'index.html', locale: 'ko', footer: 'summary' },
    { file: 'en.html', locale: 'en', footer: 'summary' },
    /*
     * 🔄 **`precheck.html` 이 «다른 페이지»로 되돌아왔습니다** 〔2026-09-01 · 대표 지시〕.
     *
     * ⚠️ 이름이 같을 뿐 2026-08-30 에 내린 그 페이지가 아닙니다. 그것은 **접수·결제 폼**
     *    이었고(213KB · 글자층 감지 · 토스 결제), 이것은 **입력값만으로 점수를 내는 정적
     *    한 장**입니다(19.5KB · 서버 호출 0 · 저장 0). 되살린 것이 아니라 새로 쓴 것입니다.
     *    원본이 필요하면 `git show ca47218^:precheck.html` 입니다.
     *
     * 🔴 **`/tools/precheck` 이 아니라 `/precheck` 인 이유** — 하위 폴더는 `STATIC.dirs`
     *    로 가야 하는데 dirs 는 «통째 복사»라 토큰 치환도, 주석 제거도, 아래 A~D 검증도
     *    전부 건너뜁니다. 이 파일은 `{{biz.*}}` 를 쓰고 JS 주석에 내부 실측 메모를 답니다 —
     *    그 둘이 그대로 나가는 경로를 고를 이유가 없습니다. 평면 파일로 두어 나머지
     *    다섯 장과 같은 파이프라인을 태웁니다.
     *
     * ⚠️ 영문 짝이 «없습니다» 〔2026-09-01 · 대표 지시 「영문판 만들지 말 것」〕.
     *    hreflang 을 넣지 마십시오 — `test/i18n-parity.test.js` ③ 은 짝이 서로를 가리킬
     *    때만 인정하고, 한쪽만 선언하면 검색엔진이 무시합니다. 영문판을 세우는 날
     *    `en-precheck.html` 을 만들고 두 장에 hreflang 3줄씩 함께 넣으십시오.
     */
    { file: 'precheck.html', locale: 'ko', footer: 'summary' },
    /*
     * 문의 접수 한 장 〔2026-09-01 · 대표 지시〕. `?type=` 으로 칸 구성만 바뀝니다
     * (consult · quote · notify) — 페이지는 하나입니다.
     *
     * ⚠️ 영문 짝이 «없습니다». hreflang 을 넣지 마십시오(test/i18n-parity.test.js ③ 은
     *    짝이 서로를 가리킬 때만 인정합니다). 영문판을 세우는 날 `en-contact.html` 과
     *    함께 hreflang 3줄씩 넣으십시오.
     * 🔴 이 페이지는 **개인정보를 새로 받습니다** — 방침이 그것을 적고 있어야 합니다.
     *    〔2026-09-01 반영 완료〕 `privacy.html` §01 이 「받는 개인정보는 문의·견적 요청·
     *    출시 알림 신청 한 자리」로, §02 표와 §03 보관 문단이 그 셋을 함께 적습니다.
     *    ⚠️ 이 페이지가 받는 항목을 늘리면 **그 세 자리를 같은 배치에서 함께** 고치십시오
     *       (`privacy.html` §01 의 「2026-09-01」 주석이 그 대응을 들고 있습니다 —
     *       ⛔ 줄 번호로 가리키지 마십시오, 그 절은 계속 늘어납니다). 방침이 페이지보다
     *       늦으면 페이지 푸터가 «자기와 어긋나는 방침»을 가리킵니다.
     */
    { file: 'contact.html', locale: 'ko', footer: 'summary' },
    { file: 'refund.html', locale: 'ko', footer: 'full' },
    { file: 'privacy.html', locale: 'ko', footer: 'full' },
    { file: 'en-privacy.html', locale: 'en', footer: 'full' },
    // 영문 〔2026-08-16〕. en.html 의 형제 파일로 두고 cleanUrls 가 /en-refund 에 붙입니다.
    // 국문 짝은 refund 이고, 두 쌍 모두 <head> 에 hreflang 3줄이 서로를 가리킵니다.
    // ⚠️ 여기 빠뜨리면 파일은 있는데 배포만 안 되어 404 가 납니다 — 조용한 실패입니다.
    { file: 'en-refund.html', locale: 'en', footer: 'full' },
    // 영문 2종 추가 〔2026-08-20〕. en-nda.html 은 nda.html 의, en-uae.html 은 uae.html 의
    // 형제 파일이고 cleanUrls 가 /en-nda · /en-uae 에 붙입니다. hreflang 3줄이 각각
    // nda.html · uae.html 을 서로 가리킵니다.
    /*
     * 🔴 **샘플 리포트 2종을 내렸습니다** 〔2026-08-31 · 대표 결정 D-5 「유입 없으면 삭제」〕.
     *
     * `sample.html` · `en-sample.html` 은 2026-08-23 에 서면서 **히어로 CTA2 와 샘플 섹션이
     * 그 두 경로를 가리킨다**는 전제 위에 있었습니다(바로 위 종전 주석이 그렇게 적고
     * 있었습니다). 2026-08-29 랜딩 전면교체가 그 두 진입원을 함께 걷어냈고, 그래서
     * **배포는 되는데 랜딩에서 가는 길이 0건**인 상태로 남았습니다(실측 2026-08-31).
     *
     * ⚠️ **그 주석이 반대 방향으로 낡아 있었습니다** — 「여기서 빠지면 랜딩 첫 화면의 버튼이
     *    404」라고 경고했지만 그 버튼은 이미 없었습니다. 분류표의 주석도 늙습니다.
     * 🔴 **되살리려면 «링크부터»입니다** — 페이지만 다시 등재하면 같은 상태로 돌아갑니다.
     *    원본: `git show 95664ef:sample.html` · `git show 95664ef:en-sample.html`.
     * ⛔ 딸림으로 함께 내린 것: `test/landing-invariants.test.js` 의 샘플 3검사 ·
     *    `test/item-count.test.js` · `test/i18n-parity.test.js` 의 예외 목록.
     */
  ],
  // assets/ = track.js(2026-08-18 페이지 조회·클릭 익명 집계). 주석 제거 없이 통째 복사.
  dirs: ['data', 'img', 'assets'],
  /*
   * 🔴 **루트에 그대로 놓여야 하는 파일** 〔신설 2026-09-05〕 — 이름과 위치가 규약인 것만
   *    여기 옵니다. `favicon.ico` 가 그렇습니다: 링크 태그를 안 보고 `/favicon.ico` 를
   *    바로 찔러보는 브라우저·크롤러가 있어서, 하위 폴더로 내리면 그쪽에서 못 찾습니다.
   *
   * ⚠️ **아무 파일이나 여기 넣지 마십시오.** 정적 자산은 기본이 `dirs` 입니다. 이 칸은
   *    「루트가 아니면 뜻이 없어지는 것」 전용입니다(robots.txt · sitemap.xml 도 그 부류).
   * ⚠️ `html` 과 달리 **주석 제거도 토큰 치환도 하지 않습니다** — 바이너리를 그대로 옮깁니다.
   */
  files: ['favicon.ico'],
};

/** 배포되지 않는 것. api/ 는 Vercel 이 소스 루트에서 직접 함수로 잡습니다. */
const NOT_DEPLOYED = new Set([
  'api',                  // 서버리스 함수 — Vercel 이 별도로 처리
  // 라우팅 미들웨어 — Vercel 이 소스 루트에서 직접 집어간다(outputDirectory 와 무관).
  // dist/ 로 복사하면 정적 파일로 그냥 배포돼 버려서 아무 효과가 없다(2026-08-21).
  'middleware.js',
  'scripts', 'test',      // .vercelignore
  'docs',                 // 정본·와이어프레임. 공개되면 안 됩니다
  // 사용자 흐름·결정 문서(doc/s9/…). docs 와 별개 폴더이고 성격은 같습니다 —
  // 가격·채널 전략이 들어 있어 공개되면 안 됩니다. .vercelignore 도 함께 보십시오.
  'doc',
  'node_modules', 'dist',
  'package.json', 'package-lock.json',
  'precheck-schema.sql',  // .vercelignore
  'vercel.json',
  'site.config.json',     // 빌드 입력 — 값은 치환되어 HTML 안으로 들어갑니다
  'skills-lock.json',
  'README.md',
]);

/* ──────────────────────────────────────────────────────────────
 * 토큰 치환
 *
 * {{biz.ecommerceNo}} · {{precheck.itemCount}} 같은 자리를 site.config.json 값으로
 * 바꿉니다. 소스에는 값이 한 벌도 없고 토큰만 있습니다 —
 * 여러 곳 드리프트가 구조적으로 불가능합니다.
 *
 * 묶음(namespace)이 둘입니다. 한 벌로 뭉치지 않은 이유는 채우는 방식이 다르기 때문입니다:
 *
 *   biz       파일의 locale 에 따라 biz.ko / biz.en 중 하나로 채웁니다
 *   precheck  언어와 무관한 한 벌입니다 — 제품 사실(대조 항목 수)이라
 *             국·영문이 같은 숫자를 씁니다
 *
 * ⚠️ 토큰에 언어를 박지 마십시오({{biz.ko.…}}). 파일 단위로 한 번만 정하는 것이
 *    en 파일에 ko 토큰을 붙여넣는 실수를 막습니다 (STATIC.html 주석 참조).
 *
 * ⚠️ 치환은 아래 검증(D. 화면 문구 불변)보다 **앞**에서 끝나야 합니다.
 *    그 검증이 지키는 것은 「주석 제거가 문구를 바꾸지 않는다」이지
 *    「소스 파일과 산출물이 같다」가 아닙니다. 치환된 결과를 기준으로 비교합니다.
 * ────────────────────────────────────────────────────────────── */

/** 아는 묶음 이름. 여기 없는 이름은 애초에 토큰으로 잡히지 않습니다(오타 = 빌드 실패). */
const TOKEN_NAMESPACES = ['biz', 'precheck'];

const TOKEN_RE = new RegExp(
  '\\{\\{\\s*(' + TOKEN_NAMESPACES.join('|') + ')\\.([A-Za-z0-9_]+)\\s*\\}\\}',
  'g'
);

function loadSiteConfig() {
  const file = path.join(ROOT, 'site.config.json');
  if (!fs.existsSync(file)) {
    console.error('✋ site.config.json 이 없습니다. 화면에 나가는 값의 원본입니다.');
    process.exit(1);
  }
  const config = JSON.parse(fs.readFileSync(file, 'utf8'));

  for (const locale of ['ko', 'en']) {
    if (!config.biz || !config.biz[locale]) {
      console.error(`✋ site.config.json 에 biz.${locale} 이 없습니다.`);
      process.exit(1);
    }
  }

  // 대조 항목 수. 화면에 「N개 항목」으로 찍히고 환불규정 04 의 근거가 되는 숫자라
  // 0 이나 문자열이 조용히 통과하면 안 됩니다.
  const count = config.precheck && config.precheck.itemCount;
  if (!Number.isInteger(count) || count <= 0) {
    console.error(
      '✋ site.config.json 의 precheck.itemCount 가 양의 정수가 아닙니다: ' +
        JSON.stringify(count) +
        '\n   trops_a 의 ICC_ITEM_IDS − V1_EXCLUDED_ITEM_IDS 개수와 맞추십시오.'
    );
    process.exit(1);
  }

  return config;
}

/** 파일 하나를 채울 사전 — 묶음 이름 → 값 묶음. locale 은 biz 에만 걸립니다. */
function tokenValues(config, locale) {
  return { biz: config.biz[locale], precheck: config.precheck };
}

/**
 * 토큰을 값으로 바꿉니다. 사전에 없는 키를 만나면 바꾸지 않고 그대로 둡니다 —
 * 남은 토큰은 호출한 쪽이 빌드 실패로 처리합니다(조용히 빈 문자열로 만들지 않습니다).
 */
function resolveTokens(html, dicts) {
  return html.replace(TOKEN_RE, (whole, ns, key) => {
    const values = dicts[ns];
    return values && Object.prototype.hasOwnProperty.call(values, key)
      ? String(values[key])
      : whole;
  });
}

/**
 * 주석만 제거하는 설정. 나머지 최적화는 전부 꺼 둡니다.
 * html-minifier-terser 는 기본값이 「아무것도 안 함」이라 켠 것만 동작합니다.
 */
const MINIFY_OPTS = {
  // HTML 주석. <!--! 로 시작하는 것은 남깁니다(법적 고지·저작권용).
  removeComments: true,
  // <style> 안 CSS 주석. level 1 의 나머지 최적화는 안전하지만(공백·색 표기 정규화)
  // 렌더링을 바꾸지 않는 선을 지키려고 주석 제거만 씁니다.
  minifyCSS: { level: { 1: { all: false, specialComments: 0 } } },
  // <script> 안 JS 주석. compress·mangle 을 끄면 terser 가 코드를 재구성하지 않고
  // 주석만 떼고 다시 출력합니다. 문자열·정규식 리터럴 안의 // 를 오인하지 않는 것이
  // 직접 정규식을 쓰지 않고 이 도구를 쓰는 이유입니다.
  minifyJS: { compress: false, mangle: false, format: { comments: false } },
};

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name === '.DS_Store') continue;
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

/** 태그 이름 순서열 — 구조가 보존됐는지 비교하는 데 씁니다. */
function tagSequence(html) {
  const withoutComments = html.replace(/<!--[\s\S]*?-->/g, '');
  const stripped = withoutComments.replace(
    /<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
    (m) => m.replace(/[\s\S]*/, '<$1></$1>')
  );
  return (stripped.match(/<\/?([a-zA-Z][a-zA-Z0-9]*)/g) || [])
    .map((t) => t.toLowerCase())
    .join(',');
}

/** 눈에 보이는 텍스트 — 주석·스크립트·스타일을 뺀 나머지. */
function visibleText(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  const config = loadSiteConfig();

  // 1. 루트에 분류되지 않은 것이 있으면 실패시킵니다 (조용한 누락 방지)
  const known = new Set([
    ...STATIC.html.map((h) => h.file),
    ...STATIC.dirs,
    ...STATIC.files,
    ...NOT_DEPLOYED,
  ]);
  const unknown = fs
    .readdirSync(ROOT, { withFileTypes: true })
    .map((e) => e.name)
    .filter((n) => !n.startsWith('.') && !known.has(n));

  if (unknown.length) {
    console.error(
      '\n✋ 루트에 분류되지 않은 항목이 있습니다:\n' +
        unknown.map((n) => '     ' + n).join('\n') +
        '\n\n   scripts/build-static.js 의 STATIC(배포됨) 또는 NOT_DEPLOYED(배포 안 됨)에\n' +
        '   추가해 주십시오. 정적 자산이면 STATIC, 아니면 NOT_DEPLOYED 입니다.\n'
    );
    process.exit(1);
  }

  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  let totalBytes = 0;

  for (const { file: name, locale, footer } of STATIC.html) {
    const src = path.join(ROOT, name);
    if (!fs.existsSync(src)) {
      console.error(`✋ ${name} 이 없습니다. STATIC.html 목록과 실제 파일이 어긋납니다.`);
      process.exit(1);
    }
    /*
     * 🔴 **푸터 티어 선언이 없으면 여기서 멈춥니다** 〔2026-09-04〕. 이 한 줄이 이번 사고의
     *    재발 방지입니다 — 페이지를 새로 지으면서 푸터를 «새로 쓰는» 순간, 어느 티어인지
     *    적지 않고는 배포까지 갈 수 없습니다. 실을 것이 없는 페이지는 `footer: 'none'`.
     * ⛔ 이 검사를 「없으면 summary 로 본다」 같은 기본값으로 바꾸지 마십시오 —
     *    기본값은 «적지 않아도 통과하는 길»이고, 그것이 두 번 새게 한 구멍입니다.
     */
    if (!Object.prototype.hasOwnProperty.call(FOOTER_TIERS, String(footer))) {
      console.error(
        `✋ ${name} 에 footer 티어 선언이 없습니다(값: ${JSON.stringify(footer)}). ` +
        `STATIC.html 항목에 footer: '${Object.keys(FOOTER_TIERS).join("' | '")}' 중 하나를 적으십시오.`
      );
      process.exit(1);
    }

    const fail = (msg) => {
      console.error(`✋ ${name}: ${msg}\n   배포를 중단합니다.`);
      process.exit(1);
    };

    const raw = fs.readFileSync(src, 'utf8');
    const before = resolveTokens(raw, tokenValues(config, locale));

    // 사전에 없는 키(오타)가 남아 있으면 화면에 {{...}} 가 그대로 찍힙니다.
    // 조용히 나가는 것보다 빌드가 깨지는 편이 낫습니다 — 루트 미분류와 같은 태도입니다.
    const unresolved = before.match(TOKEN_RE);
    if (unresolved) {
      fail(
        `치환되지 않은 토큰이 남았습니다: ${[...new Set(unresolved)].join(', ')}\n` +
          `   site.config.json 에 해당 키가 있는지 확인하십시오` +
          ` (biz 는 biz.${locale} 아래, precheck 는 precheck 아래).`
      );
    }

    const after = await minify(before, MINIFY_OPTS);

    // ── 검증 ──────────────────────────────────────────────────────────────
    // A. 주석이 남지 않았는지 (세 종류 전부)
    const htmlComments = (after.match(/<!--(?!!)/g) || []).length;
    if (htmlComments) fail(`HTML 주석 ${htmlComments}개가 남았습니다`);

    const inBlocks = (s, tag) =>
      (s.match(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}\\s*>`, 'gi')) || []).join('');
    const cssLeft = (inBlocks(after, 'style').match(/\/\*/g) || []).length;
    if (cssLeft) fail(`CSS 주석 ${cssLeft}개가 남았습니다`);
    const jsLeft = (inBlocks(after, 'script').match(/\/\*|(?:^|\s)\/\//g) || []).length;
    if (jsLeft) fail(`JS 주석 ${jsLeft}개가 남았습니다`);

    // B. DOCTYPE
    if (!/^<!DOCTYPE html>/i.test(after.trim())) fail('DOCTYPE 이 사라졌습니다');

    // C. 태그 구조가 그대로인지 — 주석 안의 태그처럼 보이는 글자에 속지 않도록
    //    양쪽 모두 주석을 뺀 상태로 비교합니다.
    if (tagSequence(before) !== tagSequence(after)) fail('태그 구조가 변했습니다');

    // D. 눈에 보이는 텍스트가 한 글자도 안 바뀌었는지.
    //    문구는 한 글자도 바뀌면 안 되는 것이 이 프로젝트의 첫 규칙입니다(정본 §0 · §8).
    //    ⚠️ 기준은 치환이 끝난 before 입니다. 여기서 지키는 것은 「주석 제거가 문구를
    //       바꾸지 않는다」이고, 치환이 문구를 바꾸는지는 test/site-config.test.js 몫입니다.
    if (visibleText(before) !== visibleText(after)) fail('화면에 보이는 문구가 변했습니다');

    fs.writeFileSync(path.join(OUT, name), after);
    const saved = raw.length - after.length;
    totalBytes += saved;
    console.log(
      `  ${name.padEnd(15)} ${String(before.length).padStart(6)} → ` +
        `${String(after.length).padStart(6)}자  (−${saved.toLocaleString()})`
    );
  }

  for (const dir of STATIC.dirs) {
    const src = path.join(ROOT, dir);
    if (!fs.existsSync(src)) {
      console.error(`✋ ${dir}/ 이 없습니다. STATIC.dirs 목록과 실제 폴더가 어긋납니다.`);
      process.exit(1);
    }
    copyDir(src, path.join(OUT, dir));
    console.log(`  ${(dir + '/').padEnd(15)} 복사`);
  }

  for (const name of STATIC.files) {
    const src = path.join(ROOT, name);
    if (!fs.existsSync(src)) {
      console.error(`✋ ${name} 이 없습니다. STATIC.files 목록과 실제 파일이 어긋납니다.`);
      process.exit(1);
    }
    fs.copyFileSync(src, path.join(OUT, name));
    console.log(`  ${name.padEnd(15)} 복사`);
  }

  console.log(`\n  주석 ${totalBytes.toLocaleString()}자 제거 → dist/\n`);
}

/*
 * 직접 실행할 때만 빌드합니다 〔2026-08-17〕.
 *
 * 이 파일을 `require` 하는 곳이 생겼기 때문입니다 — test/naming-consistency.test.js 가
 * 「배포되는 전 페이지」 목록을 손으로 적는 대신 아래 STATIC 을 읽습니다. 목록을 두 곳에
 * 두면 페이지를 새로 만들 때 한쪽만 늘고, 검사가 조용히 그 페이지를 건너뜁니다 —
 * 푸터 태그라인이 네 페이지에서 갈라진 것이 정확히 그 방식이었습니다.
 *
 * ⚠️ 가드를 빼지 마십시오. 빼면 테스트를 돌릴 때마다 dist/ 를 지우고 다시 씁니다.
 *    `npm run build` 는 이 파일을 직접 실행하므로 그대로 동작합니다.
 */
if (require.main === module) {
  main().catch((err) => {
    console.error('✋ 빌드 실패:', err && err.message ? err.message : err);
    process.exit(1);
  });
}

module.exports = { STATIC: STATIC, NOT_DEPLOYED: NOT_DEPLOYED, FOOTER_TIERS: FOOTER_TIERS };
