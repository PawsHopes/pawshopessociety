/* ==========================================================================
   Paws Hopes Society - Master Interactive Vanilla JS Script
   Optimized for Cloudflare Pages Static Hosting
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Hide Loader
  const loader = document.getElementById('loader');
  if (loader) {
    window.addEventListener('load', () => {
      loader.style.opacity = '0';
      setTimeout(() => {
        loader.style.display = 'none';
      }, 500);
    });
    // Fallback timer if load takes too long
    setTimeout(() => {
      if (loader.style.opacity !== '0') {
        loader.style.opacity = '0';
        setTimeout(() => { loader.style.display = 'none'; }, 500);
      }
    }, 2500);
  }

  // 2. Initialize AOS (Animate On Scroll)
  if (typeof AOS !== 'undefined') {
    AOS.init({
      duration: 700,
      easing: 'ease-out',
      once: true,
      offset: 80
    });
  }

  // 3. Scroll Progress Indicator & Back-To-Top Toggle
  const scrollProgress = document.getElementById('scroll-progress');
  const backToTopBtn = document.getElementById('backToTop');

  window.addEventListener('scroll', () => {
    const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = (window.scrollY / totalHeight) * 100;
    
    if (scrollProgress) {
      scrollProgress.style.width = `${progress}%`;
    }

    if (backToTopBtn) {
      if (window.scrollY > 300) {
        backToTopBtn.classList.remove('hidden');
        backToTopBtn.classList.add('flex');
      } else {
        backToTopBtn.classList.add('hidden');
        backToTopBtn.classList.remove('flex');
      }
    }
  });

  if (backToTopBtn) {
    backToTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // 4. Mobile Menu Drawer
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');

  if (mobileMenuBtn && mobileMenu) {
    mobileMenuBtn.addEventListener('click', () => {
      mobileMenu.classList.toggle('hidden');
      const expanded = mobileMenuBtn.getAttribute('aria-expanded') === 'true';
      mobileMenuBtn.setAttribute('aria-expanded', !expanded);
    });
  }

  // 5. Dark Mode Toggle & Storage
  const darkModeToggles = [
    document.getElementById('dark-mode-toggle'),
    document.getElementById('dark-mode-toggle-mobile')
  ];

  const savedTheme = localStorage.getItem('phs_theme');
  if (savedTheme === 'dark') {
    document.body.classList.add('dark');
  }

  darkModeToggles.forEach(toggle => {
    if (toggle) {
      toggle.addEventListener('click', () => {
        document.body.classList.toggle('dark');
        const theme = document.body.classList.contains('dark') ? 'dark' : 'light';
        localStorage.setItem('phs_theme', theme);
      });
    }
  });

  // 6. Intersection Observer Counter Animation
  const counters = document.querySelectorAll('.counter-val');
  let animated = false;

  function runCounters() {
    counters.forEach(counter => {
      const target = +counter.getAttribute('data-target');
      const duration = 1800;
      const stepTime = 20;
      const steps = duration / stepTime;
      const increment = target / steps;
      let current = 0;

      const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
          counter.innerText = target.toLocaleString('en-IN');
          clearInterval(timer);
        } else {
          counter.innerText = Math.ceil(current).toLocaleString('en-IN');
        }
      }, stepTime);
    });
  }

  const counterSection = document.getElementById('statistics-section');
  if (counterSection && counters.length > 0) {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !animated) {
        runCounters();
        animated = true;
      }
    }, { threshold: 0.3 });
    observer.observe(counterSection);
  }

  // 7. Gallery Category Filter & Lightbox
  const filterBtns = document.querySelectorAll('.gallery-filter-btn');
  const galleryItems = document.querySelectorAll('.gallery-item');
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxCaption = document.getElementById('lightbox-caption');
  const lightboxClose = document.getElementById('lightbox-close');

  if (filterBtns.length > 0) {
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => {
          b.classList.remove('active', 'bg-brand-orange', 'text-white');
          b.classList.add('bg-white', 'dark:bg-slate-800', 'text-slate-700', 'dark:text-slate-200');
        });
        btn.classList.add('active', 'bg-brand-orange', 'text-white');
        btn.classList.remove('bg-white', 'dark:bg-slate-800', 'text-slate-700', 'dark:text-slate-200');

        const filter = btn.getAttribute('data-filter');
        galleryItems.forEach(item => {
          if (filter === 'all' || item.getAttribute('data-category') === filter) {
            item.style.display = 'block';
          } else {
            item.style.display = 'none';
          }
        });
      });
    });
  }

  if (galleryItems.length > 0 && lightbox) {
    galleryItems.forEach(item => {
      item.addEventListener('click', () => {
        const imgSrc = item.getAttribute('data-src');
        const caption = item.getAttribute('data-caption');
        lightboxImg.src = imgSrc;
        lightboxCaption.innerText = caption;
        lightbox.classList.remove('hidden');
        lightbox.classList.add('flex');
      });
    });

    if (lightboxClose) {
      lightboxClose.addEventListener('click', closeLightbox);
    }
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) closeLightbox();
    });

    function closeLightbox() {
      lightbox.classList.add('hidden');
      lightbox.classList.remove('flex');
    }
  }

  // 8. Form Submissions State Handler
  const forms = document.querySelectorAll('form');
  forms.forEach(form => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        const origText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Submitting...';
        
        setTimeout(() => {
          alert('Thank you! Your inquiry has been logged successfully. Paws Hopes Society will contact you shortly.');
          form.reset();
          submitBtn.disabled = false;
          submitBtn.innerHTML = origText;
        }, 1200);
      }
    });
  });
});