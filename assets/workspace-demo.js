(() => {
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const demo = document.querySelector('.workspace-demo');
  const text = demo?.querySelector('.workspace-demo-text');
  let frame;
  let typingObserver;
  const finish = () => {
    cancelAnimationFrame(frame);
    if (!demo || !text) return;
    text.textContent = demo.dataset.request;
    demo.dataset.state = 'complete';
    typingObserver?.disconnect();
  };
  if (demo && text) {
    if (motion.matches || !('IntersectionObserver' in window)) finish();
    else {
      text.textContent = '';
      typingObserver = new IntersectionObserver(entries => {
        if (!entries.some(entry => entry.isIntersecting)) return;
        typingObserver.disconnect();
        const characters = Array.from(demo.dataset.request);
        const start = performance.now() + 250;
        demo.dataset.state = 'typing';
        const type = now => {
          if (motion.matches) return finish();
          const progress = Math.max(0, Math.min(1, (now - start) / 2000));
          text.textContent = characters.slice(0, Math.floor(progress * characters.length)).join('');
          if (progress < 1) frame = requestAnimationFrame(type);
          else finish();
        };
        frame = requestAnimationFrame(type);
      }, { threshold: .65 });
      typingObserver.observe(demo);
    }
  }
  const steps = document.querySelector('.workspace-flow ol');
  if (steps && !motion.matches && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      steps.dataset.revealed = 'true';
      Array.from(steps.children).forEach((step, index) => {
        step.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'translateY(0)' }], {
          duration: 550, delay: index * 160, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards'
        });
      });
    }, { threshold: .2 });
    observer.observe(steps);
  }
  motion.addEventListener('change', event => { if (event.matches) finish(); });
})();
