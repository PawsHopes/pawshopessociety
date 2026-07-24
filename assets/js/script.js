/* ==========================================================================
   Paws Hopes Society - Master Interactive Script
   Handles UI, Navigation, Counter Animations, Forms & Lightbox
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
      offset: 100
    });
  }

  // 3. Scroll Progress Bar & Header Scroll Effect
  const scrollProgress = document.getElementById('scroll-progress');
  const header = document.getElementById('site-header');

  window.addEventListener('scroll', () => {
    const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = (window.scrollY / totalHeight) * 100;
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

    // Back To Top Button Visiblity
    const backToTopBtn = document.getElementById('backToTop');
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
  });

  // 4. Mobile Menu Toggle
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');

  if (mobileMenuBtn && mobileMenu) {
    mobileMenuBtn.addEventListener('click', () => {
      mobileMenu.classList.toggle('hidden');
      const expanded = mobileMenuBtn.getAttribute('aria-expanded') === 'true' || false;
      mobileMenuBtn.setAttribute('aria-expanded', !expanded);
    });
  }

  // 5. Dark Mode Toggle
  const darkModeToggle = document.getElementById('dark-mode-toggle');
  const currentTheme = localStorage.getItem('theme');

  if (currentTheme === 'dark') {
    document.body.classList.add('dark');
  }

  if (darkModeToggle) {
    darkModeToggle.addEventListener('click', () => {
      document.body.classList.toggle('dark');
      const theme = document.body.classList.contains('dark') ? 'dark' : 'light';
      localStorage.setItem('theme', theme);
    });
  }

  // 6. Animated Counter Strategy
  const counters = document.querySelectorAll('.counter-val');
  let animated = false;

  function runCounters() {
    counters.forEach(counter => {
      const target = +counter.getAttribute('data-target');
      const duration = 2000;
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

  // Trigger counters when counter section is in viewport
  const counterSection = document.getElementById('statistics-section');
  if (counterSection) {
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
    galleryItems.forEach(item => {
      item.addEventListener('click', () => {
        const imgSrc = item.getAttribute('data-src') || item.querySelector('img').src;
        const caption = item.getAttribute('data-caption') || item.querySelector('img').alt;
        
        lightboxImg.src = imgSrc;
        lightboxCaption.innerText = caption;
        lightbox.classList.remove('hidden');
        lightbox.classList.add('flex');
      });
    });

    lightboxClose.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) closeLightbox();
    });

    function closeLightbox() {
      lightbox.classList.add('hidden');
      lightbox.classList.remove('flex');
    }
  }

  // 8. Back to Top Smooth Scroll
  const backToTopBtn = document.getElementById('backToTop');
  if (backToTopBtn) {
    backToTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // 9. Generic Dynamic Form Submission Handlers
  const forms = document.querySelectorAll('form');
  forms.forEach(form => {
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
});