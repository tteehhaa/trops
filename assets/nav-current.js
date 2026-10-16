/*
 * 맨 위 메뉴의 «지금 보는 구획» 표시 〔신설 2026-10-16 · IA 점검 4차 개선 7 · 대표 승인〕
 * 메뉴의 같은 문서 고리(`#…`)마다 그 구획이 화면 가운데 띠를 지나는 동안 `aria-current="location"` 을 단다.
 * 표시 모양은 각 랜딩의 `<style id="navigation-layout">` 이 갖는다(글자색 · 밑줄).
 * ⚠️ 대상은 메뉴에서 파생한다 — 구획 id 를 여기 따로 적지 않는다(메뉴 순서가 바뀌어도 이 파일은 그대로).
 */
(() => {
  const links = [...document.querySelectorAll('nav .m a[href^="#"]')];
  const targets = links.map(link => document.querySelector(link.getAttribute('href'))).filter(Boolean);
  if (!targets.length || !('IntersectionObserver' in window)) return;
  const inView = new Set();
  const update = () => {
    const current = targets.filter(target => inView.has(target)).pop();
    links.forEach(link => {
      if (current && link.getAttribute('href') === '#' + current.id) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  };
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => entry.isIntersecting ? inView.add(entry.target) : inView.delete(entry.target));
    update();
  }, { rootMargin: '-45% 0px -50% 0px' });
  targets.forEach(target => observer.observe(target));
})();
