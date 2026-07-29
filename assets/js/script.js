/* ==========================================================================
   Paws Hopes Society — Global Main Script
   ========================================================================== */

// 0. Instant Preloader Injector (Paws Only, No Text)
(function() {
  if (!document.getElementById('page-preloader')) {
    const preloader = document.createElement('div');
    preloader.id = 'page-preloader';
    preloader.innerHTML = `
      <div class="paw-loader">
        <i class="fas fa-paw"></i>
        <i class="fas fa-paw"></i>
        <i class="fas fa-paw"></i>
      </div>
    `;
    document.body.prepend(preloader);
  }
})();

window.addEventListener('load', () => {
  const preloader = document.getElementById('page-preloader');
  if (preloader) {
    setTimeout(() => {
      preloader.classList.add('fade-out');
    }, 300);
  }
});

document.addEventListener('click', (e) => {
  const link = e.target.closest('a');
  if (link && link.href && link.href.startsWith(window.location.origin) && !link.href.includes('#') && !link.getAttribute('target')) {
    const preloader = document.getElementById('page-preloader');
    if (preloader) {
      preloader.classList.remove('fade-out');
    }
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  if (mobileMenuBtn && mobileMenu) {
    mobileMenuBtn.addEventListener('click', () => {
      const isExpanded = mobileMenuBtn.getAttribute('aria-expanded') === 'true';
      mobileMenuBtn.setAttribute('aria-expanded', !isExpanded);
      mobileMenu.classList.toggle('hidden');
    });
  }

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

  // Live Visitor Counter (Starting from 110,520)
  const visitorCountEl = document.getElementById('visitor-count');
  if (visitorCountEl) {
    let baseCount = 110520;
    try {
      let currentCount = localStorage.getItem('phs_visitor_count');
      if (!currentCount || parseInt(currentCount, 10) < baseCount) {
        currentCount = baseCount;
      } else {
        currentCount = parseInt(currentCount, 10);
      }

      if (!sessionStorage.getItem('phs_counted_session')) {
        currentCount += 1;
        localStorage.setItem('phs_visitor_count', currentCount);
        sessionStorage.setItem('phs_counted_session', 'true');
      }

      visitorCountEl.textContent = currentCount.toLocaleString('en-IN');
    } catch (e) {
      visitorCountEl.textContent = "110,520";
    }
  }

  // Number Counting Calculation Effect for Stats
  const statNumbers = document.querySelectorAll('.stat-counter');
  if (statNumbers.length > 0) {
    const observer = new IntersectionObserver((entries, observerInstance) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const target = parseInt(el.getAttribute('data-target'), 10);
          const suffix = el.getAttribute('data-suffix') || '';
          let current = 0;
          const duration = 1200;
          const step = Math.ceil(target / (duration / 40));
          
          const timer = setInterval(() => {
            current += step;
            if (current >= target) {
              current = target;
              clearInterval(timer);
            }
            el.textContent = current + suffix;
          }, 40);

          observerInstance.unobserve(el);
        }
      });
    }, { threshold: 0.5 });

    statNumbers.forEach(num => observer.observe(num));
  }

  if (typeof AOS !== 'undefined') {
    AOS.init({ duration: 800, once: true, offset: 50 });
  }
});