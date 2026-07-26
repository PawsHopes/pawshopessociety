/* ==========================================================================
   Paws Hopes Society — Master Interactive Script
   Handles UI, Navigation, Counter Animations, Forms & Lightbox
   Version 2.0
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Preloader
  const loader = document.getElementById('loader');
  if (loader) {
    window.addEventListener('load', () => {
      loader.style.opacity = '0';
      setTimeout(() => {
        loader.style.visibility = 'hidden';
      }, 500);
    });
  }

  // 2. Initialize AOS (Animate On Scroll)
  if (typeof AOS !== 'undefined') {
    AOS.init({
      duration: 800,
      easing: 'ease-in-out',
      once: true,
      offset: 100,
      disable: window.matchMedia('(prefers-reduced-motion: reduce)').matches
    });
  }

  // 3. Scroll Progress Bar & Header Scroll Effect
  const scrollProgress = document.getElementById('scroll-progress');
  const header = document.getElementById('site-header');
  const backToTopBtn = document.getElementById('backToTop');

  function onScroll() {
    const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = totalHeight > 0 ? (window.scrollY / totalHeight) * 100 : 0;
    if (scrollProgress) {
      scrollProgress.style.width = `${progress}%`;
    }

    if (header) {
      if (window.scrollY > 50) {
        header.classList.add('scrolled', 'shadow-md', 'bg-white', 'text-slate-800');
        header.classList.remove('bg-transparent', 'text-white');
      } else {
        header.classList.remove('scrolled', 'shadow-md', 'bg-white', 'text-slate-800');
        header.classList.add('bg-transparent', 'text-white');
      }
    }

    // Back To Top Button Visibility
    if (backToTopBtn) {
      if (window.scrollY > 300) {
        backToTopBtn.classList.remove('hidden', 'opacity-0');
        backToTopBtn.classList.add('flex', 'opacity-100');
      } else {
        backToTopBtn.classList.add('opacity-0');
        backToTopBtn.classList.remove('opacity-100');
        setTimeout(() => {
          if (window.scrollY <= 300) backToTopBtn.classList.add('hidden');
        }, 300);
      }
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  // 4. Mobile Menu Toggle (works on any page that includes these elements)
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');

  if (mobileMenuBtn && mobileMenu) {
    mobileMenuBtn.addEventListener('click', () => {
      const isHidden = mobileMenu.classList.toggle('hidden');
      mobileMenuBtn.setAttribute('aria-expanded', String(!isHidden));
    });

    // Close mobile menu with Escape key for accessibility
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !mobileMenu.classList.contains('hidden')) {
        mobileMenu.classList.add('hidden');
        mobileMenuBtn.setAttribute('aria-expanded', 'false');
        mobileMenuBtn.focus();
      }
    });
  }

  // 5. Dark Mode Toggle (supports desktop + mobile buttons on every page)
  const darkModeToggles = document.querySelectorAll('#dark-mode-toggle, #dark-mode-toggle-mobile');
  const currentTheme = localStorage.getItem('theme');

  if (currentTheme === 'dark') {
    document.body.classList.add('dark');
  }

  function updateDarkModeIcons() {
    const isDark = document.body.classList.contains('dark');
    darkModeToggles.forEach((btn) => {
      const icon = btn.querySelector('i');
      if (icon) {
        icon.classList.toggle('fa-moon', !isDark);
        icon.classList.toggle('fa-sun', isDark);
      }
      btn.setAttribute('aria-pressed', String(isDark));
    });
  }

  darkModeToggles.forEach((btn) => {
    btn.addEventListener('click', () => {
      document.body.classList.toggle('dark');
      const theme = document.body.classList.contains('dark') ? 'dark' : 'light';
      localStorage.setItem('theme', theme);
      updateDarkModeIcons();
    });
  });
  updateDarkModeIcons();

  // 6. Animated Counter (only runs on stat blocks with a real data-target > 0)
  const counters = document.querySelectorAll('.counter-val[data-target]');
  let animated = false;

  function runCounters() {
    counters.forEach((counter) => {
      const target = +counter.getAttribute('data-target');
      if (!target) return;
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
  if (counterSection && counters.length) {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !animated) {
        runCounters();
        animated = true;
      }
    }, { threshold: 0.3 });
    observer.observe(counterSection);
  }

  // 7. Lightbox Gallery Logic
  const galleryItems = document.querySelectorAll('.gallery-item');
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxCaption = document.getElementById('lightbox-caption');
  const lightboxClose = document.getElementById('lightbox-close');

  if (galleryItems.length > 0 && lightbox) {
    galleryItems.forEach((item) => {
      item.addEventListener('click', () => {
        const imgEl = item.querySelector('img');
        const imgSrc = item.getAttribute('data-src') || (imgEl && imgEl.src);
        const caption = item.getAttribute('data-caption') || (imgEl && imgEl.alt) || '';

        if (lightboxImg && imgSrc) lightboxImg.src = imgSrc;
        if (lightboxCaption) lightboxCaption.innerText = caption;
        lightbox.classList.remove('hidden');
        lightbox.classList.add('flex');
      });
    });

    if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) closeLightbox();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !lightbox.classList.contains('hidden')) closeLightbox();
    });

    function closeLightbox() {
      lightbox.classList.add('hidden');
      lightbox.classList.remove('flex');
    }
  }

  // 8. Back to Top Smooth Scroll
  if (backToTopBtn) {
    backToTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // 9. Generic Dynamic Form Submission Handlers
  const forms = document.querySelectorAll('form[data-async-form]');
  forms.forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        const origText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Processing...';

        setTimeout(() => {
          alert('Thank you! Your submission has been received successfully. Our team at Paws Hopes Society will contact you shortly.');
          form.reset();
          submitBtn.disabled = false;
          submitBtn.innerHTML = origText;
        }, 1500);
      }
    });
  });

  // Run once on load in case the page is already scrolled (e.g. anchor link)
  onScroll();
});
