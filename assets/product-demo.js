(() => {
  const product = document.querySelector('#product');
  if (!product) return;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const panes = [...product.querySelectorAll('[role="tabpanel"]')];
  let visible = false;
  const update = () => panes.forEach(pane => {
    pane.classList.toggle('demo-playing', visible && !document.hidden && !motion.matches && pane.classList.contains('on'));
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      visible = entries.some(entry => entry.isIntersecting);
      update();
    }, { threshold: .15 }).observe(product.querySelector('.screen'));
  }
  new MutationObserver(update).observe(product.querySelector('[role="tablist"]'), {
    subtree: true, attributes: true, attributeFilter: ['aria-selected']
  });
  motion.addEventListener('change', update);
  document.addEventListener('visibilitychange', update);
})();
