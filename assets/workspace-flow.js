(() => {
  const flow = document.querySelector('.workspace-flow');
  if (!flow) return;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let visible = false;
  const update = () => flow.classList.toggle('is-flowing', visible && !document.hidden && !motion.matches);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      visible = entries.some(entry => entry.isIntersecting);
      update();
    }, { threshold: .25 }).observe(flow.querySelector('ol'));
  }
  motion.addEventListener('change', update);
  document.addEventListener('visibilitychange', update);
})();
