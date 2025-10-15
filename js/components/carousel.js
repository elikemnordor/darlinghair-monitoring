// Touch-enabled image carousel component

export function createCarousel(carouselId) {
  const carousel = document.getElementById(carouselId);
  if (!carousel) return;
  
  const track = carousel.querySelector('.carousel-track');
  const dots = carousel.querySelectorAll('.carousel-dot');
  const slides = carousel.querySelectorAll('.carousel-slide');
  
  if (!track || slides.length === 0) return;
  // Hint to the browser that we'll animate transform
  track.style.willChange = 'transform';
  
  let currentIndex = 0;
  let startX = 0;
  let currentX = 0;
  let isDragging = false;
  let startTime = 0;
  
  // Touch start
  track.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    currentX = startX;
    isDragging = true;
    startTime = Date.now();
    track.style.transition = 'none';
  }, { passive: true });
  
  // Touch move (non-passive so we can prevent page scroll while dragging)
  track.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    
    currentX = e.touches[0].clientX;
    let diff = currentX - startX;
    
    // Clamp overscroll at the edges to avoid getting stuck and page bounce
    const atFirst = currentIndex === 0 && diff > 0;
    const atLast = currentIndex === slides.length - 1 && diff < 0;
    if (atFirst || atLast) {
      const max = carousel.offsetWidth * 0.2; // allow up to 20% elastic drag
      if (Math.abs(diff) > max) {
        diff = Math.sign(diff) * max;
      }
    }
    
    const offset = -(currentIndex * 100);
    const transform = offset + (diff / carousel.offsetWidth * 100);
    
    track.style.transform = `translate3d(${transform}%, 0, 0)`;
    // Prevent the page from also scrolling/bouncing while swiping the carousel
    e.preventDefault();
  }, { passive: false });
  
  // Touch end
  track.addEventListener('touchend', () => {
    if (!isDragging) return;
    isDragging = false;
    
    const diff = currentX - startX;
    const threshold = carousel.offsetWidth * 0.2;
    const timeDiff = Date.now() - startTime;
    const velocity = Math.abs(diff) / timeDiff;
    
    track.style.transition = 'transform 0.3s ease';
    
    // Determine swipe direction
    if (Math.abs(diff) > threshold || velocity > 0.5) {
      if (diff > 0 && currentIndex > 0) {
        // Swipe right
        currentIndex--;
      } else if (diff < 0 && currentIndex < slides.length - 1) {
        // Swipe left
        currentIndex++;
      }
    }
    
    updateCarousel();
  });

  // Touch cancel (e.g., iOS bounce or gesture cancellation)
  track.addEventListener('touchcancel', () => {
    if (isDragging) {
      isDragging = false;
      track.style.transition = 'transform 0.3s ease';
      updateCarousel();
    }
  });
  
  // Mouse support for testing
  track.addEventListener('mousedown', (e) => {
    startX = e.clientX;
    currentX = startX;
    isDragging = true;
    startTime = Date.now();
    track.style.transition = 'none';
    e.preventDefault();
  });
  
  track.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    
    currentX = e.clientX;
    const diff = currentX - startX;
    const offset = -(currentIndex * 100);
    const transform = offset + (diff / carousel.offsetWidth * 100);
    
    track.style.transform = `translateX(${transform}%)`;
  });
  
  track.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    
    const diff = currentX - startX;
    const threshold = carousel.offsetWidth * 0.2;
    const timeDiff = Date.now() - startTime;
    const velocity = Math.abs(diff) / timeDiff;
    
    track.style.transition = 'transform 0.3s ease';
    
    if (Math.abs(diff) > threshold || velocity > 0.5) {
      if (diff > 0 && currentIndex > 0) {
        currentIndex--;
      } else if (diff < 0 && currentIndex < slides.length - 1) {
        currentIndex++;
      }
    }
    
    updateCarousel();
  });
  
  track.addEventListener('mouseleave', () => {
    if (isDragging) {
      isDragging = false;
      track.style.transition = 'transform 0.3s ease';
      updateCarousel();
    }
  });
  
  // Dot click handlers
  dots.forEach((dot, index) => {
    dot.addEventListener('click', (e) => {
      e.stopPropagation();
      currentIndex = index;
      updateCarousel();
    });
  });
  
  function updateCarousel() {
    track.style.transform = `translate3d(-${currentIndex * 100}%, 0, 0)`;
    
    dots.forEach((dot, index) => {
      if (index === currentIndex) {
        dot.classList.add('active');
      } else {
        dot.classList.remove('active');
      }
    });
  }
  
  // Initialize
  updateCarousel();
}
