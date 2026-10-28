/* Global site behaviors ported from original main.js */
/* - navbar scroll toggle
   - mobile hamburger toggle
   - scroll reveal (IntersectionObserver)
   - counters
   - smooth anchor scrolling
   - lazy image loader for img[data-src]
   - simple parallax for .hero__bg
*/
(() => {
  // Scroll reveal
  const els = document.querySelectorAll('.reveal');
  if (els.length) {
    const io = new IntersectionObserver((entries, ioRef) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-visible'); ioRef.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
    els.forEach(el => io.observe(el));
  }

  // Counters
  const counters = document.querySelectorAll('[data-count]');
  if (counters.length) {
    const animateCount = (el) => {
      const target = parseInt(el.dataset.count, 10) || 0;
      const suffix = el.dataset.suffix || '';
      const duration = 1800;
      const step = 16;
      const increment = target / (duration / step);
      let current = 0;
      const timer = setInterval(() => {
        current = Math.min(current + increment, target);
        el.textContent = Math.floor(current).toLocaleString() + suffix;
        if (current >= target) clearInterval(timer);
      }, step);
    };
    const io = new IntersectionObserver((entries, ioRef) => {
      entries.forEach(e => { if (e.isIntersecting) { animateCount(e.target); ioRef.unobserve(e.target); } });
    }, { threshold: 0.5 });
    counters.forEach(c => io.observe(c));
  }

  // Lazy images
  const imgs = document.querySelectorAll('img[data-src]');
  if (imgs.length) {
    const io = new IntersectionObserver((entries, ioRef) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.src = e.target.dataset.src;
          e.target.removeAttribute('data-src');
          ioRef.unobserve(e.target);
        }
      });
    }, { rootMargin: '200px' });
    imgs.forEach(img => io.observe(img));
  }

  // Parallax (simple)
  const hero = document.querySelector('.hero__bg');
  if (hero && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    window.addEventListener('scroll', () => {
      hero.style.transform = `translateY(${window.scrollY * 0.35}px)`;
    }, { passive: true });
  }
})();
