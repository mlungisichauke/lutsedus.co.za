/**
 * ==========================================================
 * Lutsedus Travels & Tours — script.js
 * Website: lutsedus.co.za
 * Features:
 *   - Sticky navbar with scroll detection
 *   - Mobile hamburger menu toggle
 *   - Smooth scrolling for anchor links
 *   - Scroll-reveal animations (IntersectionObserver)
 *   - Animated number counters
 *   - Gallery filter & lightbox
 *   - Destination tab switcher
 *   - Contact form validation & submission
 *   - Back-to-top button
 *   - Active nav link highlighting
 *   - Copyright year auto-update
 * ==========================================================
 */

/* ==========================================================
   WAIT FOR DOM TO FULLY LOAD BEFORE RUNNING ANY SCRIPTS
   ========================================================== */
document.addEventListener('DOMContentLoaded', function () {

  /* --------------------------------------------------------
     1. STICKY NAVBAR — changes style on scroll
     -------------------------------------------------------- */
  const navbar = document.getElementById('navbar');
    const hasHeroSection = Boolean(document.querySelector('.hero'));

  /**
   * Update navbar appearance based on scroll position.
   * When user scrolls past 60px, adds 'scrolled' class
   * which triggers the solid dark background style in CSS.
   */
  function updateNavbar() {
    if (!hasHeroSection || window.scrollY > 60) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  }

  // Run once on load (in case page is refreshed mid-scroll)
  updateNavbar();
  // Listen for scroll events
  window.addEventListener('scroll', updateNavbar, { passive: true });


  /* --------------------------------------------------------
     2. MOBILE HAMBURGER MENU
     -------------------------------------------------------- */
  const hamburger = document.getElementById('hamburger');
  const navLinks  = document.getElementById('nav-links');

  // Toggle mobile menu open/closed
  hamburger.addEventListener('click', function () {
    const isOpen = navLinks.classList.toggle('open');
    hamburger.classList.toggle('active');

    // Update ARIA attribute for screen readers
    hamburger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');

    // Prevent body scrolling when menu is open
    document.body.style.overflow = isOpen ? 'hidden' : '';
  });

  /**
   * Close the mobile menu when any nav link is clicked.
   * This allows users to tap a link and have the menu close
   * smoothly before the page scrolls to that section.
   */
  const allNavLinks = navLinks.querySelectorAll('a');
  allNavLinks.forEach(function (link) {
    link.addEventListener('click', closeMobileMenu);
  });

  function closeMobileMenu() {
    navLinks.classList.remove('open');
    hamburger.classList.remove('active');
    hamburger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  /**
   * Close menu when clicking outside the menu panel
   * (e.g., on the dark backdrop overlay).
   */
  document.addEventListener('click', function (event) {
    const clickedOutside = !navbar.contains(event.target);
    if (clickedOutside && navLinks.classList.contains('open')) {
      closeMobileMenu();
    }
  });

  /**
   * Handle ESC key to close menu (accessibility).
   */
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && navLinks.classList.contains('open')) {
      closeMobileMenu();
      hamburger.focus(); // Return focus to hamburger button
    }
  });


  /* --------------------------------------------------------
     3. SMOOTH SCROLLING — for all anchor (#) links
     -------------------------------------------------------- */
  /**
   * Intercept clicks on anchor links and smoothly scroll
   * to the target section, accounting for the sticky navbar height.
   */
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (event) {
      const href = this.getAttribute('href');

      // Ignore empty hashes (#) or inline JS links
      if (href === '#' || href === '#!') return;

      const targetElement = document.querySelector(href);
      if (!targetElement) return;

      event.preventDefault();

      // Calculate the offset position (account for sticky navbar)
      const navbarHeight = navbar.offsetHeight;
      const targetTop    = targetElement.getBoundingClientRect().top + window.pageYOffset - navbarHeight;

      window.scrollTo({
        top:      targetTop,
        behavior: 'smooth'
      });
    });
  });


  /* --------------------------------------------------------
     4. ACTIVE NAV LINK HIGHLIGHTING — using IntersectionObserver
     -------------------------------------------------------- */
  /**
   * Highlight the nav link corresponding to the section
   * currently visible in the viewport.
   */
  const sections     = document.querySelectorAll('section[id]');
  const navLinkItems = document.querySelectorAll('.nav-link');

  const sectionObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        const sectionId = entry.target.getAttribute('id');

        navLinkItems.forEach(function (link) {
          link.classList.remove('active');

          // Match nav link href to section id
          const linkHref = link.getAttribute('href');
          if (linkHref === '#' + sectionId) {
            link.classList.add('active');
          }
        });
      }
    });
  }, {
    // Section becomes "active" when 30% of it is visible
    threshold:  0.30,
    rootMargin: '-80px 0px 0px 0px'
  });

  sections.forEach(function (section) {
    sectionObserver.observe(section);
  });


  /* --------------------------------------------------------
     5. SCROLL-REVEAL ANIMATIONS
     -------------------------------------------------------- */
  /**
   * Elements with class 'reveal' are invisible by default (CSS).
   * When they scroll into view, 'visible' class is added,
   * triggering the CSS transition animation.
   */
  const revealElements = document.querySelectorAll('.reveal');

  const revealObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        // Once revealed, stop observing (no need to re-animate)
        revealObserver.unobserve(entry.target);
      }
    });
  }, {
    threshold:  0.1,       // Trigger when 10% of element is visible
    rootMargin: '0px 0px -40px 0px'
  });

  revealElements.forEach(function (el) {
    revealObserver.observe(el);
  });


  /* --------------------------------------------------------
     6. ANIMATED NUMBER COUNTERS
     -------------------------------------------------------- */
  /**
   * Animates number counters from 0 to their target value.
   * Used in the hero stats strip and Why Choose Us section.
   * 
   * Data attribute: data-count="123"
   */
  const counters = document.querySelectorAll('[data-count]');
  let countersStarted = false;

  function animateCounters() {
    if (countersStarted) return;

    // Only start when the stats section is roughly in view
    const statsSection = document.querySelector('.hero-stats, .stats-row');
    if (!statsSection) return;

    const rect = statsSection.getBoundingClientRect();
    if (rect.top < window.innerHeight) {
      countersStarted = true;
      runAllCounters();
    }
  }

  function runAllCounters() {
    counters.forEach(function (counter) {
      const target   = parseInt(counter.getAttribute('data-count'), 10);
      const duration = 2000; // animation duration in ms
      const step     = target / (duration / 16); // ~60fps
      let current    = 0;

      const timer = setInterval(function () {
        current += step;
        if (current >= target) {
          current = target;
          clearInterval(timer);
        }
        counter.textContent = Math.floor(current).toLocaleString();
      }, 16);
    });
  }

  // Trigger counter check on scroll
  window.addEventListener('scroll', animateCounters, { passive: true });
  // Also try on load (in case already in view)
  animateCounters();


  /* --------------------------------------------------------
     7. GALLERY FILTER
     -------------------------------------------------------- */
  /**
   * Filter gallery images by category.
   * Clicking a filter button hides/shows images based on
   * their data-category attribute.
   */
  const filterButtons  = document.querySelectorAll('.gallery-filter');
  const galleryItems   = document.querySelectorAll('.gallery-item');

  filterButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      const selectedFilter = this.getAttribute('data-filter');

      // Update active button state
      filterButtons.forEach(function (btn) {
        btn.classList.remove('active');
      });
      this.classList.add('active');

      // Show/hide gallery items based on category
      galleryItems.forEach(function (item) {
        const itemCategory = item.getAttribute('data-category');

        if (selectedFilter === 'all' || selectedFilter === itemCategory) {
          item.classList.remove('hidden');
          // Re-trigger reveal animation
          setTimeout(function () {
            item.classList.add('visible');
          }, 50);
        } else {
          item.classList.add('hidden');
          item.classList.remove('visible');
        }
      });
    });
  });


  /* --------------------------------------------------------
     8. LIGHTBOX — gallery image viewer
     -------------------------------------------------------- */
  /**
   * Full-screen image viewer when gallery items are clicked.
   * Supports keyboard navigation (left/right arrows, ESC to close).
   */
  const lightbox        = document.getElementById('lightbox');
  const lightboxImg     = document.getElementById('lightbox-img');
  const lightboxCaption = document.getElementById('lightbox-caption');
  const lightboxClose   = document.getElementById('lightbox-close');
  const lightboxPrev    = document.getElementById('lightbox-prev');
  const lightboxNext    = document.getElementById('lightbox-next');

  let currentLightboxIndex = 0;
  let visibleGalleryItems  = [];

  /**
   * Collect currently visible (non-hidden) gallery items.
   * Updates when filters change.
   */
  function getVisibleItems() {
    visibleGalleryItems = Array.from(galleryItems).filter(function (item) {
      return !item.classList.contains('hidden');
    });
    return visibleGalleryItems;
  }

  /**
   * Open the lightbox and display the image at the given index.
   */
  function openLightbox(index) {
    const items = getVisibleItems();
    if (!items.length) return;

    currentLightboxIndex = Math.max(0, Math.min(index, items.length - 1));
    const item = items[currentLightboxIndex];
    const img  = item.querySelector('img');
    const caption = item.querySelector('.gallery-overlay span');

    lightboxImg.src     = img.src;
    lightboxImg.alt     = img.alt;
    lightboxCaption.textContent = caption ? caption.textContent : '';

    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Focus the close button for accessibility
    lightboxClose.focus();
  }

  /**
   * Close the lightbox.
   */
  function closeLightbox() {
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
  }

  /**
   * Navigate to the next image.
   */
  function nextImage() {
    const items = getVisibleItems();
    currentLightboxIndex = (currentLightboxIndex + 1) % items.length;
    openLightbox(currentLightboxIndex);
  }

  /**
   * Navigate to the previous image.
   */
  function prevImage() {
    const items = getVisibleItems();
    currentLightboxIndex = (currentLightboxIndex - 1 + items.length) % items.length;
    openLightbox(currentLightboxIndex);
  }

  // Open lightbox when clicking a gallery item
  galleryItems.forEach(function (item, index) {
    item.addEventListener('click', function () {
      // Get the index in the visible items array
      const visibleItems = getVisibleItems();
      const visibleIndex = visibleItems.indexOf(item);
      if (visibleIndex !== -1) openLightbox(visibleIndex);
    });
  });

  // Close lightbox button
  lightboxClose.addEventListener('click', closeLightbox);

  // Next / Previous buttons
  lightboxNext.addEventListener('click', nextImage);
  lightboxPrev.addEventListener('click', prevImage);

  // Click outside image to close
  lightbox.addEventListener('click', function (event) {
    if (event.target === lightbox) closeLightbox();
  });

  // Keyboard navigation
  document.addEventListener('keydown', function (event) {
    if (!lightbox.classList.contains('active')) return;

    switch (event.key) {
      case 'Escape':
        closeLightbox();
        break;
      case 'ArrowRight':
      case 'ArrowDown':
        nextImage();
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        prevImage();
        break;
    }
  });


  /* --------------------------------------------------------
     9. DESTINATION TABS SWITCHER
     -------------------------------------------------------- */
  /**
   * Toggle between "African Destinations" and 
   * "International Destinations" tab panels.
   */
  const destTabs   = document.querySelectorAll('.dest-tab');
  const destPanels = document.querySelectorAll('.dest-panel');

  destTabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      const targetTabId = 'tab-' + this.getAttribute('data-tab');

      // Update active button
      destTabs.forEach(function (t) { t.classList.remove('active'); });
      this.classList.add('active');

      // Show/hide panels
      destPanels.forEach(function (panel) {
        if (panel.id === targetTabId) {
          panel.classList.add('active');
        } else {
          panel.classList.remove('active');
        }
      });
    });
  });


  /* --------------------------------------------------------
     10. CONTACT FORM VALIDATION & SUBMISSION
     -------------------------------------------------------- */
  /**
   * Client-side form validation with custom error messages.
   * Spam protection via honeypot field.
   * Shows success/error message after submission.
   * 
   * NOTE: This is a frontend-only validation. For production,
   * also validate on the server side (PHP/Node.js etc.) and
   * configure a proper email sending service or form handler.
   */
  const contactForm   = document.getElementById('contact-form');
  const submitBtn     = document.getElementById('submit-btn');
  const formMessage   = document.getElementById('form-message');
  const FORMSPREE_ENDPOINT = ''; // Example: https://formspree.io/f/your_form_id

  if (contactForm) {

    contactForm.addEventListener('submit', function (event) {
      event.preventDefault();

      // Check honeypot — if it has a value, it's likely a bot
      const honeypot = contactForm.querySelector('input[name="website_url"]');
      if (honeypot && honeypot.value.trim() !== '') {
        // Silently reject — don't alert the bot
        return;
      }

      // Run validation — stop if errors found
      if (!validateContactForm()) return;

      // Show loading state on button
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

      const formData = new FormData(contactForm);

      if (FORMSPREE_ENDPOINT.trim()) {
        fetch(FORMSPREE_ENDPOINT, {
          method: 'POST',
          body: formData,
          headers: { 'Accept': 'application/json' }
        })
          .then(function (response) {
            if (!response.ok) {
              throw new Error('Form submission failed.');
            }
            showFormSuccess();
          })
          .catch(function () {
            showFormError('Submission failed. Please try again or use WhatsApp.');
          })
          .finally(function () {
            resetSubmitButton();
          });
      } else {
        const mailtoUrl = buildMailtoEnquiry();
        window.location.href = mailtoUrl;

        formMessage.className = 'form-message success';
        formMessage.innerHTML =
          '<i class="fas fa-info-circle"></i> ' +
          'Your email app has been opened with your enquiry details. Please send the email to complete your request.';

        formMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
        resetSubmitButton();
      }

    }); // end form submit

  } // end if contactForm

  function resetSubmitButton() {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Send My Enquiry';
  }

  function buildMailtoEnquiry() {
    const firstName = (document.getElementById('first-name') || {}).value || '';
    const lastName = (document.getElementById('last-name') || {}).value || '';
    const email = (document.getElementById('email') || {}).value || '';
    const phone = (document.getElementById('phone') || {}).value || '';
    const service = (document.getElementById('service') || {}).value || 'general enquiry';
    const travelDate = (document.getElementById('travel-date') || {}).value || 'Not specified';
    const guests = (document.getElementById('guests') || {}).value || 'Not specified';
    const message = (document.getElementById('message') || {}).value || '';

    const subject = encodeURIComponent('Website Enquiry - Lutsedus Travels');
    const body = encodeURIComponent(
      'Name: ' + firstName + ' ' + lastName + '\n' +
      'Email: ' + email + '\n' +
      'Phone: ' + phone + '\n' +
      'Service: ' + service + '\n' +
      'Preferred Travel Date: ' + travelDate + '\n' +
      'Guests: ' + guests + '\n\n' +
      'Message:\n' + message
    );

    return 'mailto:monastourssafaris@gmail.com?subject=' + subject + '&body=' + body;
  }


  /**
   * Validates all required form fields.
   * Returns true if valid, false if errors found.
   * Displays inline error messages next to each invalid field.
   */
  function validateContactForm() {
    let isValid = true;

    // Helper: show an error for a specific field
    function showError(fieldId, errorId, message) {
      const field = document.getElementById(fieldId);
      const error = document.getElementById(errorId);
      if (field)  field.classList.add('error');
      if (error)  error.textContent = message;
      isValid = false;
    }

    // Helper: clear error for a field
    function clearError(fieldId, errorId) {
      const field = document.getElementById(fieldId);
      const error = document.getElementById(errorId);
      if (field)  field.classList.remove('error');
      if (error)  error.textContent = '';
    }

    // --- First Name ---
    const firstName = document.getElementById('first-name');
    if (!firstName || firstName.value.trim().length < 2) {
      showError('first-name', 'error-first-name', 'Please enter your first name (at least 2 characters).');
    } else {
      clearError('first-name', 'error-first-name');
    }

    // --- Last Name ---
    const lastName = document.getElementById('last-name');
    if (!lastName || lastName.value.trim().length < 2) {
      showError('last-name', 'error-last-name', 'Please enter your last name (at least 2 characters).');
    } else {
      clearError('last-name', 'error-last-name');
    }

    // --- Email Address ---
    const email = document.getElementById('email');
    // Simple but effective email regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email.value.trim())) {
      showError('email', 'error-email', 'Please enter a valid email address (e.g. name@example.com).');
    } else {
      clearError('email', 'error-email');
    }

    // --- Phone Number ---
    const phone = document.getElementById('phone');
    // Allow digits, spaces, +, -, ( ) — minimum 7 characters
    const phoneRegex = /^[\d\s\+\-\(\)]{7,20}$/;
    if (!phone || !phoneRegex.test(phone.value.trim())) {
      showError('phone', 'error-phone', 'Please enter a valid phone number (e.g. +27 72 949 0280).');
    } else {
      clearError('phone', 'error-phone');
    }

    // --- Service Selection ---
    const service = document.getElementById('service');
    if (!service || service.value === '') {
      showError('service', 'error-service', 'Please select a service you are interested in.');
    } else {
      clearError('service', 'error-service');
    }

    // --- Message ---
    const message = document.getElementById('message');
    if (!message || message.value.trim().length < 20) {
      showError('message', 'error-message', 'Please enter a message of at least 20 characters so we can assist you better.');
    } else {
      clearError('message', 'error-message');
    }

    // --- Consent Checkbox ---
    const consent = document.getElementById('consent');
    if (!consent || !consent.checked) {
      showError('consent', 'error-consent', 'Please agree to our contact terms to submit your enquiry.');
    } else {
      clearError('consent', 'error-consent');
    }

    // Scroll to first error if validation failed
    if (!isValid) {
      const firstError = contactForm.querySelector('.error');
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        firstError.focus();
      }
    }

    return isValid;
  }

  /**
   * Display success message after form is submitted.
   * Resets the form fields.
   */
  function showFormSuccess() {
    formMessage.className = 'form-message success';
    formMessage.innerHTML =
      '<i class="fas fa-check-circle"></i> ' +
      'Thank you! Your enquiry has been sent successfully. ' +
      'One of our travel specialists will contact you within 24 hours. ' +
      'For urgent enquiries, WhatsApp us on +27 72 949 0280.';

    contactForm.reset();

    // Scroll to message
    formMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Hide message after 10 seconds
    setTimeout(function () {
      formMessage.className = 'form-message';
      formMessage.innerHTML = '';
    }, 10000);
  }

  /**
   * Display error message if form submission fails.
   * @param {string} errorText - The error message to display.
   */
  function showFormError(errorText) {
    formMessage.className = 'form-message error';
    formMessage.innerHTML =
      '<i class="fas fa-exclamation-circle"></i> ' + errorText +
      ' You can also email us directly at <a href="mailto:monastourssafaris@gmail.com">monastourssafaris@gmail.com</a>.';

    formMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /**
   * Real-time validation — clear error as user types
   * (improves UX by giving immediate positive feedback).
   */
  const formInputs = contactForm ? contactForm.querySelectorAll('input, textarea, select') : [];
  formInputs.forEach(function (input) {
    input.addEventListener('input', function () {
      this.classList.remove('error');
      const errorId = 'error-' + this.id;
      const errorEl = document.getElementById(errorId);
      if (errorEl) errorEl.textContent = '';
    });
  });


  /* --------------------------------------------------------
     11. BACK TO TOP BUTTON
     -------------------------------------------------------- */
  const backToTopBtn = document.getElementById('back-to-top');

  /**
   * Show the back-to-top button after user scrolls down 400px.
   * Clicking it smoothly scrolls back to the top of the page.
   */
  window.addEventListener('scroll', function () {
    if (window.scrollY > 400) {
      backToTopBtn.classList.add('visible');
    } else {
      backToTopBtn.classList.remove('visible');
    }
  }, { passive: true });

  backToTopBtn.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });


  /* --------------------------------------------------------
     12. COPYRIGHT YEAR — auto-updates every year
     -------------------------------------------------------- */
  /**
   * Automatically keeps the copyright year in the footer
   * up to date without needing manual updates.
   */
  const copyrightYearEl = document.getElementById('copyright-year');
  if (copyrightYearEl) {
    copyrightYearEl.textContent = new Date().getFullYear();
  }


  /* --------------------------------------------------------
     13. IMAGE LAZY LOADING FALLBACK
     -------------------------------------------------------- */
  /**
   * For browsers that don't support native lazy loading,
   * use IntersectionObserver as a fallback.
   */
  if ('loading' in HTMLImageElement.prototype) {
    // Browser supports native lazy loading — nothing to do
  } else {
    // Fallback for older browsers
    const lazyImages = document.querySelectorAll('img[loading="lazy"]');
    const imageObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.getAttribute('data-src') || img.src;
          imageObserver.unobserve(img);
        }
      });
    });
    lazyImages.forEach(function (img) {
      imageObserver.observe(img);
    });
  }


  /* --------------------------------------------------------
     14. ANNOUNCEMENT STRIP — pause on hover
     -------------------------------------------------------- */
  /**
   * Pause the scrolling ticker animation when user hovers
   * over it (allows reading the full content).
   */
  const announceStrip = document.querySelector('.announce-strip');
  const announceTrack = document.querySelector('.announce-track');

  if (announceStrip && announceTrack) {
    announceStrip.addEventListener('mouseenter', function () {
      announceTrack.style.animationPlayState = 'paused';
    });
    announceStrip.addEventListener('mouseleave', function () {
      announceTrack.style.animationPlayState = 'running';
    });
  }


  /* --------------------------------------------------------
     15. SAFARI CARD — "Book This Safari" link handler
     -------------------------------------------------------- */
  /**
   * When "Book This Safari" is clicked, scroll to the contact
   * section and pre-select "Luxury Safari Package" in the dropdown.
   */
  document.querySelectorAll('.safari-card .btn-primary').forEach(function (btn) {
    btn.addEventListener('click', function (event) {
      // Only intercept if href points to #contact
      if (this.getAttribute('href') === '#contact') {
        event.preventDefault();

        const serviceSelect = document.getElementById('service');
        if (serviceSelect) {
          serviceSelect.value = 'safari';
        }

        const contactSection = document.getElementById('contact');
        if (contactSection) {
          const offsetTop = contactSection.getBoundingClientRect().top + window.pageYOffset - navbar.offsetHeight;
          window.scrollTo({ top: offsetTop, behavior: 'smooth' });
        }
      }
    });
  });


  /* --------------------------------------------------------
     16. NAVBAR DROPDOWN — keyboard accessibility
     -------------------------------------------------------- */
  /**
   * Allow keyboard users to open/close nav dropdowns
   * using the Enter or Space key.
   */
  document.querySelectorAll('.dropdown > .nav-link').forEach(function (dropdownTrigger) {
    dropdownTrigger.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        const dropdown = this.closest('.dropdown');
        dropdown.classList.toggle('open-kb');
        const dropdownMenu = dropdown.querySelector('.dropdown-menu');
        if (dropdownMenu) {
          dropdownMenu.style.opacity    = dropdown.classList.contains('open-kb') ? '1' : '';
          dropdownMenu.style.visibility = dropdown.classList.contains('open-kb') ? 'visible' : '';
        }
      }
    });
  });


  /* --------------------------------------------------------
     17. SMOOTH PARALLAX EFFECT — subtle hero parallax
     -------------------------------------------------------- */
  /**
   * Apply a subtle parallax effect to the hero background
   * as the user scrolls, creating a sense of depth.
   * 
   * Only runs if the user hasn't set "prefer-reduced-motion".
   * Respects accessibility preferences.
   */
  const heroBg = document.querySelector('.hero-bg');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (heroBg && !prefersReducedMotion) {
    window.addEventListener('scroll', function () {
      const scrollY = window.pageYOffset;
      // Move background slower than scroll speed (parallax effect)
      heroBg.style.transform = 'translateY(' + (scrollY * 0.35) + 'px)';
    }, { passive: true });
  }


  /* --------------------------------------------------------
     18. MOBILE TOUCH SWIPE — for gallery lightbox
     -------------------------------------------------------- */
  /**
   * Allow swiping left/right to navigate lightbox images
   * on touch devices (smartphones and tablets).
   */
  let touchStartX = 0;
  let touchEndX   = 0;

  if (lightbox) {
    lightbox.addEventListener('touchstart', function (event) {
      touchStartX = event.changedTouches[0].clientX;
    }, { passive: true });

    lightbox.addEventListener('touchend', function (event) {
      touchEndX = event.changedTouches[0].clientX;
      handleLightboxSwipe();
    }, { passive: true });
  }

  function handleLightboxSwipe() {
    const swipeDistance = touchStartX - touchEndX;
    const minSwipe      = 50; // Minimum pixels to count as a swipe

    if (swipeDistance > minSwipe) {
      nextImage(); // Swipe left → next image
    } else if (swipeDistance < -minSwipe) {
      prevImage(); // Swipe right → previous image
    }
  }


  /* --------------------------------------------------------
     19. PERFORMANCE — Throttle scroll events
     -------------------------------------------------------- */
  /**
   * The scroll event fires very frequently.
   * Throttling limits how often we process it to improve
   * performance (especially on mobile devices).
   * 
   * Note: We use { passive: true } on all scroll listeners
   * above which already improves performance significantly.
   */


  /* --------------------------------------------------------
     20. INITIALISE — Trigger reveal for already-visible elements
     -------------------------------------------------------- */
  /**
   * Elements near the top of the page may already be in view
   * when the page loads. Force a check so they don't wait
   * for a scroll event to become visible.
   */
  function checkInitialVisibility() {
    revealElements.forEach(function (el) {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.95) {
        el.classList.add('visible');
      }
    });
  }

  // Small delay to allow CSS to render first
  setTimeout(checkInitialVisibility, 150);


  /* --------------------------------------------------------
     DEBUG — Remove or comment out in production
     -------------------------------------------------------- */
  // console.log('✅ Lutsedus Travels & Tours — Script loaded successfully.');
  // console.log('   WhatsApp: +27 72 949 0280');
  // console.log('   Email: monastourssafaris@gmail.com');


}); // end DOMContentLoaded


/* ==========================================================
   ADDITIONAL UTILITY: Detect touch devices
   Adds 'touch-device' class to <body> for CSS targeting
   ========================================================== */
(function () {
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
    document.body.classList.add('touch-device');
  }
})();
