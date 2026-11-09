const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const hasFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

function setupMenu() {
  const menuButton = document.querySelector('.menu-toggle');
  const nav = document.querySelector('#primary-nav');
  if (!menuButton || !nav) return;

  const closeMenu = () => {
    nav.classList.remove('open');
    menuButton.setAttribute('aria-expanded', 'false');
  };

  menuButton.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('open');
    menuButton.setAttribute('aria-expanded', String(isOpen));
  });
  nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && nav.classList.contains('open')) {
      closeMenu();
      menuButton.focus();
    }
  });
  document.addEventListener('pointerdown', (event) => {
    if (!nav.contains(event.target) && !menuButton.contains(event.target)) closeMenu();
  });
}

function createRafPointerEffect(element, onFrame, onLeave) {
  let frame = 0;
  let rect;
  let pointer = { x: 0, y: 0 };

  const enter = () => {
    rect = element.getBoundingClientRect();
    element.classList.add('is-pointer-active');
  };
  const move = (event) => {
    pointer = { x: event.clientX, y: event.clientY };
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      onFrame(pointer, rect || element.getBoundingClientRect());
    });
  };
  const leave = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    element.classList.remove('is-pointer-active');
    onLeave?.();
  };

  element.addEventListener('pointerenter', enter, { passive: true });
  element.addEventListener('pointermove', move, { passive: true });
  element.addEventListener('pointerleave', leave, { passive: true });
}

function setupInteractiveSurfaces() {
  if (!hasFinePointer.matches || prefersReducedMotion.matches) return;

  document.querySelectorAll('.service-card').forEach((card) => {
    createRafPointerEffect(card, ({ x, y }, rect) => {
      const localX = x - rect.left;
      const localY = y - rect.top;
      const normalizedX = localX / rect.width - .5;
      const normalizedY = localY / rect.height - .5;
      card.style.setProperty('--mx', `${localX}px`);
      card.style.setProperty('--my', `${localY}px`);
      card.style.setProperty('--ry', `${clamp(normalizedX * 6, -3, 3)}deg`);
      card.style.setProperty('--rx', `${clamp(normalizedY * -6, -3, 3)}deg`);
    }, () => {
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    });
  });

  document.querySelectorAll('.map-card').forEach((surface) => {
    createRafPointerEffect(surface, ({ x, y }, rect) => {
      surface.style.setProperty('--mx', `${x - rect.left}px`);
      surface.style.setProperty('--my', `${y - rect.top}px`);
    });
  });
}

function setupMagneticTargets() {
  if (!hasFinePointer.matches || prefersReducedMotion.matches) return;
  const targets = [...document.querySelectorAll('.button, .nav-cta, .map-actions a, .arrow-link, .text-link, .contact-primary, .copy-button')];
  let rects = [];
  let geometryDirty = true;
  let frame = 0;
  let pointer = { x: -1000, y: -1000 };

  const refreshGeometry = () => {
    rects = targets.map((target) => target.getBoundingClientRect());
    geometryDirty = false;
  };
  const resetTarget = (target) => {
    target.classList.remove('is-pointer-active');
    target.style.setProperty('--magnetic-x', '0px');
    target.style.setProperty('--magnetic-y', '0px');
  };
  const update = () => {
    frame = 0;
    if (geometryDirty) refreshGeometry();
    targets.forEach((target, index) => {
      const rect = rects[index];
      const nearestX = clamp(pointer.x, rect.left, rect.right);
      const nearestY = clamp(pointer.y, rect.top, rect.bottom);
      const outsideDistance = Math.hypot(pointer.x - nearestX, pointer.y - nearestY);
      if (outsideDistance > 20) {
        resetTarget(target);
        return;
      }
      const strength = outsideDistance === 0 ? 1 : 1 - outsideDistance / 20;
      const dx = pointer.x - (rect.left + rect.width / 2);
      const dy = pointer.y - (rect.top + rect.height / 2);
      target.classList.add('is-pointer-active');
      target.style.setProperty('--magnetic-x', `${clamp(dx * .08, -6, 6) * strength}px`);
      target.style.setProperty('--magnetic-y', `${clamp(dy * .08, -6, 6) * strength}px`);
    });
  };
  document.addEventListener('pointermove', (event) => {
    pointer = { x: event.clientX, y: event.clientY };
    if (!frame) frame = requestAnimationFrame(update);
  }, { passive: true });
  window.addEventListener('scroll', () => { geometryDirty = true; }, { passive: true });
  window.addEventListener('resize', () => { geometryDirty = true; }, { passive: true });
  window.addEventListener('blur', () => targets.forEach(resetTarget));
}

function setupPressFeedback() {
  document.querySelectorAll('a, button').forEach((target) => {
    const release = () => target.classList.remove('is-pressed');
    target.addEventListener('pointerdown', () => target.classList.add('is-pressed'));
    target.addEventListener('pointerup', release);
    target.addEventListener('pointercancel', release);
    target.addEventListener('pointerleave', release);
  });
}

async function copyText(value) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Continue to the local fallback when permission or browser policy rejects.
    }
  }
  const field = document.createElement('textarea');
  field.value = value;
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.opacity = '0';
  document.body.appendChild(field);
  field.select();
  const copied = document.execCommand('copy');
  field.remove();
  if (!copied) throw new Error('Copy command was not available');
}

function setupCopyActions() {
  document.querySelectorAll('.copy-button[data-copy]').forEach((button) => {
    let feedbackTimer;
    button.addEventListener('click', async () => {
      const feedback = button.querySelector('.copy-feedback');
      button.classList.remove('is-copied');
      if (feedback) feedback.textContent = '';
      try {
        await copyText(button.dataset.copy);
        if (feedback) feedback.textContent = 'Copied';
        button.classList.add('is-copied');
        window.clearTimeout(feedbackTimer);
        feedbackTimer = window.setTimeout(() => button.classList.remove('is-copied'), 1600);
      } catch {
        if (feedback) feedback.textContent = 'Copy failed';
        button.classList.add('is-copied');
        window.clearTimeout(feedbackTimer);
        feedbackTimer = window.setTimeout(() => button.classList.remove('is-copied'), 1800);
      }
    });
  });
}

function setupServiceCarousel() {
  const grid = document.querySelector('.service-grid');
  if (!grid) return;
  const mobileQuery = window.matchMedia('(max-width: 700px)');
  const hint = document.createElement('p');
  hint.id = 'services-swipe-hint';
  hint.className = 'carousel-hint';
  hint.innerHTML = 'Swipe to explore <span>01—06</span>';
  grid.before(hint);
  grid.setAttribute('role', 'region');
  grid.setAttribute('aria-label', 'WAFID Cochin services');
  grid.setAttribute('aria-describedby', hint.id);
  const syncFocusability = () => { grid.tabIndex = mobileQuery.matches ? 0 : -1; };
  syncFocusability();
  mobileQuery.addEventListener?.('change', syncFocusability);
}

function setupHeroParallax() {
  const heroArt = document.querySelector('.hero-art');
  if (!heroArt || !hasFinePointer.matches || prefersReducedMotion.matches) return;

  createRafPointerEffect(heroArt, ({ x, y }, rect) => {
    const dx = clamp((x - (rect.left + rect.width / 2)) / rect.width, -.5, .5);
    const dy = clamp((y - (rect.top + rect.height / 2)) / rect.height, -.5, .5);
    heroArt.classList.add('is-interacting');
    heroArt.style.setProperty('--hero-x', `${dx * 20}px`);
    heroArt.style.setProperty('--hero-y', `${dy * 14}px`);
  }, () => {
    heroArt.style.setProperty('--hero-x', '0px');
    heroArt.style.setProperty('--hero-y', '0px');
  });
}

function setupMotionReveals() {
  const groups = [
    ['.section-kicker, .section-heading h2, .intro-grid h2, .process-grid > div:first-child, .country-copy, .contact-panel > div', 'up'],
    ['.large-copy, .section-heading > p, .steps, .fact-list, .country-list, .contact-details', 'right'],
  ];

  groups.forEach(([selector, direction]) => {
    document.querySelectorAll(selector).forEach((element) => { element.dataset.motionReveal = direction; });
  });
  document.querySelectorAll('.service-card').forEach((card) => { card.dataset.cardReveal = ''; });
  document.documentElement.classList.add('motion-ready');

  const sectionTargets = document.querySelectorAll('[data-motion-reveal]');
  const cardTargets = document.querySelectorAll('[data-card-reveal]');
  if (prefersReducedMotion.matches || !('IntersectionObserver' in window)) {
    sectionTargets.forEach((target) => target.classList.add('is-motion-visible'));
    cardTargets.forEach((target) => target.classList.add('is-visible'));
    return;
  }

  let lastY = window.scrollY;
  const sectionObserver = new IntersectionObserver((entries) => {
    const direction = window.scrollY >= lastY ? 1 : -1;
    lastY = window.scrollY;
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.style.setProperty('--section-reveal-y', `${direction * 26}px`);
      entry.target.classList.add('is-motion-visible');
      sectionObserver.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: .12 });

  const cardObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      cardObserver.unobserve(entry.target);
    });
  }, { threshold: .1 });

  sectionTargets.forEach((target) => sectionObserver.observe(target));
  cardTargets.forEach((target, index) => {
    target.style.transitionDelay = `${(index % 3) * 55}ms`;
    target.addEventListener('transitionend', () => target.style.removeProperty('transition-delay'), { once: true });
    cardObserver.observe(target);
  });
}

function setupLegacyReveals() {
  const items = document.querySelectorAll('.step, .fact-list article, .country-list span');
  if (prefersReducedMotion.matches || !('IntersectionObserver' in window)) {
    items.forEach((item) => item.classList.add('is-visible'));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: .12 });
  items.forEach((item, index) => {
    item.style.transitionDelay = `${(index % 3) * 55}ms`;
    item.addEventListener('transitionend', () => item.style.removeProperty('transition-delay'), { once: true });
    observer.observe(item);
  });
}

function setupScrollProgress() {
  const root = document.documentElement;
  let frame = 0;
  const update = () => {
    frame = 0;
    const max = root.scrollHeight - window.innerHeight;
    root.style.setProperty('--scroll-progress', String(max > 0 ? window.scrollY / max : 0));
  };
  window.addEventListener('scroll', () => {
    if (!frame) frame = requestAnimationFrame(update);
  }, { passive: true });
  update();
}

function setupSectionTransitions() {
  const stack = document.querySelector('[data-portal-stack]');
  const pinned = stack?.querySelector('.intro');
  const incoming = stack?.querySelector('.services');
  const trust = document.querySelector('.trust-strip');
  const process = document.querySelector('.process');
  const contact = document.querySelector('.contact');
  const ambient = document.createElement('div');
  ambient.className = 'ambient-wash';
  ambient.setAttribute('aria-hidden', 'true');
  document.body.appendChild(ambient);
  if (!stack || !pinned || !incoming || prefersReducedMotion.matches) return;

  let frame = 0;
  let cleanupTimer;
  const desktopPortal = window.matchMedia('(min-width: 901px)');
  const proximity = (element) => {
    if (!element) return 0;
    const rect = element.getBoundingClientRect();
    const distance = Math.abs((rect.top + rect.height / 2) - window.innerHeight / 2);
    return clamp(1 - distance / window.innerHeight, 0, 1);
  };
  const update = () => {
    frame = 0;
    const viewport = window.innerHeight;
    if (desktopPortal.matches) {
      const incomingRect = incoming.getBoundingClientRect();
      const progress = clamp(1 - incomingRect.top / viewport, 0, 1);
      pinned.style.setProperty('--portal-scale', String(1 - progress * .06));
      pinned.style.setProperty('--portal-opacity', String(1 - progress * .38));
      incoming.style.setProperty('--portal-y', `${(1 - progress) * 44}px`);
    } else {
      pinned.style.removeProperty('--portal-scale');
      pinned.style.removeProperty('--portal-opacity');
      incoming.style.removeProperty('--portal-y');
    }
    if (trust) {
      const trustProgress = clamp(1 - trust.getBoundingClientRect().top / viewport, 0, 1);
      trust.style.setProperty('--horizon-y', `${(1 - trustProgress) * 24}px`);
    }
    document.documentElement.style.setProperty('--ambient-warm', String(proximity(process) * .1));
    document.documentElement.style.setProperty('--ambient-cool', String(proximity(contact) * .08));
    [pinned, incoming, trust].filter(Boolean).forEach((element) => element.classList.add('is-scroll-active'));
    window.clearTimeout(cleanupTimer);
    cleanupTimer = window.setTimeout(() => {
      [pinned, incoming, trust].filter(Boolean).forEach((element) => element.classList.remove('is-scroll-active'));
    }, 180);
  };
  const requestUpdate = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };
  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate, { passive: true });
  desktopPortal.addEventListener?.('change', requestUpdate);
  update();
}

function setupChapterProgress() {
  const chapterConfig = [
    ['why', 'Why'],
    ['services', 'Services'],
    ['process', 'Process'],
    ['about-wafid', 'WAFID'],
    ['gcc', 'Countries'],
    ['contact', 'Contact'],
  ];
  const countries = document.querySelector('.countries');
  if (countries && !countries.id) countries.id = 'gcc';
  const chapters = chapterConfig
    .map(([id, label], index) => ({ id, label, index, element: document.getElementById(id) }))
    .filter((chapter) => chapter.element);
  if (!chapters.length) return;

  const nav = document.createElement('nav');
  nav.className = 'chapter-progress';
  nav.setAttribute('aria-label', 'Page chapters');
  nav.innerHTML = chapters.map(({ id, label, index }) => `<a href="#${id}"><span>${String(index + 1).padStart(2, '0')}</span><b>${label}</b></a>`).join('');
  document.body.appendChild(nav);
  const links = [...nav.querySelectorAll('a')];
  const setActive = (id) => {
    links.forEach((link) => {
      const active = link.getAttribute('href') === `#${id}`;
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'step');
      else link.removeAttribute('aria-current');
    });
  };
  setActive(chapters[0].id);

  if (!('IntersectionObserver' in window)) return;
  const observer = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting);
    if (!visible.length) return;
    visible.sort((a, b) => Math.abs(a.boundingClientRect.top) - Math.abs(b.boundingClientRect.top));
    setActive(visible[0].target.id);
  }, { rootMargin: '-42% 0px -42% 0px', threshold: 0 });
  chapters.forEach(({ element }) => observer.observe(element));
}

setupMenu();
setupInteractiveSurfaces();
setupMagneticTargets();
setupPressFeedback();
setupCopyActions();
setupServiceCarousel();
setupHeroParallax();
setupMotionReveals();
setupLegacyReveals();
setupScrollProgress();
setupSectionTransitions();
setupChapterProgress();
