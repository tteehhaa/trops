/*
 * 제품 구획 화면 예시의 움직임 〔🔄 2026-10-16 · 대표 결정 — 탭 셋을 01·02·03 블록으로 펼쳤다〕
 * 종전에는 «선택된 탭 하나»만 움직였다. 지금은 세 화면이 한 번에 다 보이므로, 화면마다
 * 따로 «보이는 동안만» 움직인다(`demo-playing`) — 안 보이는 화면 · 숨은 탭 · 동작 줄이기 설정에서는 멈춘다.
 */
(() => {
  const product = document.querySelector('#product');
  if (!product) return;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const screens = [...product.querySelectorAll('.feature-screen')];
  const visible = new Set();
  const update = () => screens.forEach(screen => {
    screen.classList.toggle('demo-playing', visible.has(screen) && !document.hidden && !motion.matches);
  });
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => entry.isIntersecting ? visible.add(entry.target) : visible.delete(entry.target));
      update();
    }, { threshold: .15 });
    screens.forEach(screen => observer.observe(screen));
  }
  motion.addEventListener('change', update);
  document.addEventListener('visibilitychange', update);
})();
