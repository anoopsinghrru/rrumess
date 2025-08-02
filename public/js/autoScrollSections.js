// Auto-scroll between vertically stacked sections
const sections = Array.from(document.querySelectorAll('section[data-section]'));
let currentSection = 0;
let autoScrollTimer = null;
let inactivityTimer = null;
const autoScrollInterval = 10000; // 10 seconds
const inactivityTimeout = 30000; // 30 seconds

function scrollToSection(index) {
  if (sections[index]) {
    sections[index].scrollIntoView({ behavior: 'smooth' });
    currentSection = index;
  }
}

function startAutoScroll() {
  if (autoScrollTimer) clearInterval(autoScrollTimer);
  autoScrollTimer = setInterval(() => {
    currentSection = (currentSection + 1) % sections.length;
    scrollToSection(currentSection);
  }, autoScrollInterval);
}

function pauseAutoScroll() {
  if (autoScrollTimer) clearInterval(autoScrollTimer);
  if (inactivityTimer) clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => {
    // Find the section most in view
    let maxVisible = 0, bestIndex = 0;
    sections.forEach((section, i) => {
      const rect = section.getBoundingClientRect();
      const visible = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
      if (visible > maxVisible) {
        maxVisible = visible;
        bestIndex = i;
      }
    });
    currentSection = bestIndex;
    startAutoScroll();
  }, inactivityTimeout);
}

function handleFullscreenChange() {
  // Optionally, reset currentSection to the most visible section
  let maxVisible = 0, bestIndex = 0;
  sections.forEach((section, i) => {
    const rect = section.getBoundingClientRect();
    const visible = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
    if (visible > maxVisible) {
      maxVisible = visible;
      bestIndex = i;
    }
  });
  currentSection = bestIndex;
  startAutoScroll();
}

['wheel', 'touchstart', 'keydown', 'mousedown'].forEach(evt =>
  window.addEventListener(evt, pauseAutoScroll, { passive: true })
);

// Standard, Webkit (Safari), and MS (Edge/IE) fullscreen events
['fullscreenchange', 'webkitfullscreenchange', 'msfullscreenchange'].forEach(evt => {
  document.addEventListener(evt, handleFullscreenChange);
});

window.addEventListener('DOMContentLoaded', () => {
  startAutoScroll();
}); 