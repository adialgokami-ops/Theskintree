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
  // Navbar scroll
  const navbar = document.querySelector('.navbar');
  if (navbar) {
    const heroEl = document.querySelector('.section-hero');
    const heroThreshold = heroEl ? (heroEl.offsetHeight - 80) : 160;
    // apply hero class initially when on the hero section
    if (heroEl) navbar.classList.add('navbar--hero');
    const onScroll = () => {
      const scrolled = window.scrollY > 40;
      navbar.classList.toggle('is-scrolled', scrolled);
      if (heroEl) {
        // remove hero styling once the user scrolls past the hero
        if (window.scrollY > heroThreshold) navbar.classList.remove('navbar--hero');
        else navbar.classList.add('navbar--hero');
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // Hamburger
  const btn = document.getElementById('nav-hamburger');
  const menu = document.getElementById('nav-mobile-menu');
  if (btn && menu) {
    btn.addEventListener('click', () => {
      const open = menu.classList.toggle('is-open');
      btn.classList.toggle('is-open', open);
      document.body.style.overflow = open ? 'hidden' : '';
      btn.setAttribute('aria-expanded', open);
    });
    menu.querySelectorAll('.nav-link').forEach(l => l.addEventListener('click', () => {
      menu.classList.remove('is-open');
      btn.classList.remove('is-open');
      document.body.style.overflow = '';
    }));
  }

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

  // Smooth anchor
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const target = document.querySelector(a.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      const navH = document.querySelector('.navbar')?.offsetHeight || 80;
      window.scrollTo({ top: target.offsetTop - navH - 16, behavior: 'smooth' });
    });
  });

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
