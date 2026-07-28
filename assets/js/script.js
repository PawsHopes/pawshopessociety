/* ==========================================================================
   Paws Hopes Society — Global Main Script
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

  // 1. Mobile Menu Toggle
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  if (mobileMenuBtn && mobileMenu) {
    mobileMenuBtn.addEventListener('click', () => {
      const isExpanded = mobileMenuBtn.getAttribute('aria-expanded') === 'true';
      mobileMenuBtn.setAttribute('aria-expanded', !isExpanded);
      mobileMenu.classList.toggle('hidden');
    });
  }

  // 2. Dark Mode Toggle
  const darkModeToggles = [document.getElementById('dark-mode-toggle'), document.getElementById('dark-mode-toggle-mobile')];
  const htmlElement = document.documentElement;

  if (localStorage.getItem('theme') === 'dark' || (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    htmlElement.classList.add('dark');
    updateThemeIcons(true);
  }

  darkModeToggles.forEach(btn => {
    if (btn) {
      btn.addEventListener('click', () => {
        htmlElement.classList.toggle('dark');
        const isDark = htmlElement.classList.contains('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        updateThemeIcons(isDark);
      });
    }
  });

  function updateThemeIcons(isDark) {
    darkModeToggles.forEach(btn => {
      if (btn) {
        btn.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
        btn.setAttribute('aria-pressed', isDark);
      }
    });
  }

  // 3. Back to Top Button & Scroll Progress
  const backToTopBtn = document.getElementById('backToTop');
  const scrollProgress = document.getElementById('scroll-progress');

  window.addEventListener('scroll', () => {
    const totalHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const currentScroll = window.scrollY;
    
    if (scrollProgress && totalHeight > 0) {
      const progress = (currentScroll / totalHeight) * 100;
      scrollProgress.style.width = progress + '%';
    }

    if (backToTopBtn) {
      if (currentScroll > 400) {
        backToTopBtn.style.display = 'flex';
      } else {
        backToTopBtn.style.display = 'none';
      }
    }
  });

  if (backToTopBtn) {
    backToTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // 4. Live Visitor Counter (No commas, starting from 110520)
  const visitorCountEl = document.getElementById('visitor-count');
  if (visitorCountEl) {
    let baseCount = 110520;
    try {
      let storedCount = localStorage.getItem('phs_visitor_count');
      let hasVisitedSession = sessionStorage.getItem('phs_session_counted');

      if (!storedCount) {
        storedCount = baseCount;
        localStorage.setItem('phs_visitor_count', storedCount);
      } else {
        storedCount = parseInt(storedCount, 10);
      }

      if (!hasVisitedSession) {
        storedCount += 1;
        localStorage.setItem('phs_visitor_count', storedCount);
        sessionStorage.setItem('phs_session_counted', 'true');
      }

      visitorCountEl.textContent = storedCount;
    } catch (e) {
      visitorCountEl.textContent = "110520";
    }
  }

  // 5. Initialize AOS Animation Library
  if (typeof AOS !== 'undefined') {
    AOS.init({
      duration: 800,
      once: true,
      offset: 50
    });
  }
});