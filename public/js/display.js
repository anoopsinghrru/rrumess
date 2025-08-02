/**
 * Mess TV Display System - New JavaScript Architecture
 * Modern, modular, and responsive display system
 */

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Debounce function to limit function calls
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function to limit function calls
 */
function throttle(func, limit) {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Check if element is in viewport
 */
function isInViewport(element) {
  const rect = element.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

/**
 * Format date for display
 */
function formatDate(date) {
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata'
  }).format(date);
}

/**
 * Toggle fullscreen mode
 */
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    // Enter fullscreen
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().then(() => {
        // Restart auto-advance after entering fullscreen
        if (window.messTVDisplay && window.messTVDisplay.slideManager) {
          window.messTVDisplay.slideManager.startAutoAdvance();
        }
      });
    } else if (document.documentElement.webkitRequestFullscreen) {
      document.documentElement.webkitRequestFullscreen().then(() => {
        // Restart auto-advance after entering fullscreen
        if (window.messTVDisplay && window.messTVDisplay.slideManager) {
          window.messTVDisplay.slideManager.startAutoAdvance();
        }
      });
    } else if (document.documentElement.msRequestFullscreen) {
      document.documentElement.msRequestFullscreen().then(() => {
        // Restart auto-advance after entering fullscreen
        if (window.messTVDisplay && window.messTVDisplay.slideManager) {
          window.messTVDisplay.slideManager.startAutoAdvance();
        }
      });
    }
  } else {
    // Exit fullscreen
    if (document.exitFullscreen) {
      document.exitFullscreen().then(() => {
        // Restart auto-advance after exiting fullscreen
        if (window.messTVDisplay && window.messTVDisplay.slideManager) {
          window.messTVDisplay.slideManager.startAutoAdvance();
        }
      });
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen().then(() => {
        // Restart auto-advance after exiting fullscreen
        if (window.messTVDisplay && window.messTVDisplay.slideManager) {
          window.messTVDisplay.slideManager.startAutoAdvance();
        }
      });
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen().then(() => {
        // Restart auto-advance after exiting fullscreen
        if (window.messTVDisplay && window.messTVDisplay.slideManager) {
          window.messTVDisplay.slideManager.startAutoAdvance();
        }
      });
    }
  }
}

// ========================================
// RESPONSIVE GRID MANAGER
// ========================================

class ResponsiveGridManager {
  constructor() {
    this.breakpoints = {
      mobile: 480,
      tablet: 768,
      desktop: 1024,
      large: 1440
    };
    this.grids = new Map();
    this.resizeObserver = null;
    this.init();
  }

  init() {
    this.setupResizeObserver();
    this.registerGrids();
  }

  setupResizeObserver() {
    this.resizeObserver = new ResizeObserver(
      throttle(() => this.handleResize(), 100)
    );
  }

  registerGrids() {
    const grids = document.querySelectorAll('.menu-grid');
    grids.forEach(grid => {
      this.grids.set(grid.id, {
        element: grid,
        itemCount: 0,
        currentClass: ''
      });
      this.resizeObserver.observe(grid);
    });
  }

  handleResize() {
    this.grids.forEach((gridData, gridId) => {
      this.updateGridResponsiveness(gridData);
    });
  }

  updateGridResponsiveness(gridData) {
    const { element, itemCount } = gridData;
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    
    // Remove existing responsive classes (old and new)
    element.classList.remove(
      'menu-grid--compact',
      'menu-grid--dense',
      'menu-grid--ultra-dense',
      'menu-grid--2-cols',
      'menu-grid--3-cols',
      'menu-grid--4-cols',
      'menu-grid--5-cols',
      'menu-grid--6-cols'
    );

    // Determine optimal grid class based on content and screen size
    const optimalClass = this.calculateOptimalGridClass(
      itemCount,
      screenWidth,
      screenHeight
    );

    if (optimalClass) {
      element.classList.add(optimalClass);
      gridData.currentClass = optimalClass;
    }
  }

  calculateOptimalGridClass(itemCount, screenWidth, screenHeight) {
    // Calculate optimal columns for equal row distribution
    const optimalColumns = this.calculateOptimalColumns(itemCount, screenWidth);
    return `menu-grid--${optimalColumns}-cols`;
  }

  calculateOptimalColumns(itemCount, screenWidth) {
    // Mobile devices (up to 768px)
    if (screenWidth <= 768) {
      if (itemCount <= 4) return 2;
      if (itemCount <= 6) return 3;
      return 3; // Max 3 columns on mobile
    }
    
    // Tablet devices (768px - 1024px)
    if (screenWidth <= 1024) {
      if (itemCount <= 3) return 3;
      if (itemCount <= 6) return 3;
      if (itemCount <= 8) return 4;
      return 4; // Max 4 columns on tablet
    }
    
    // Desktop and larger screens (1024px+)
    if (itemCount <= 3) return 3;
    if (itemCount <= 6) return 3; // 2 rows of 3
    if (itemCount <= 8) return 4; // 2 rows of 4
    if (itemCount <= 10) return 5; // 2 rows of 5
    if (itemCount <= 12) return 6; // 2 rows of 6
    if (itemCount <= 15) return 5; // 3 rows of 5
    if (itemCount <= 18) return 6; // 3 rows of 6
    return 6; // Default for large counts
  }

  updateItemCount(gridId, count) {
    const gridData = this.grids.get(gridId);
    if (gridData) {
      gridData.itemCount = count;
      this.updateGridResponsiveness(gridData);
    }
  }

  destroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    this.grids.clear();
  }
}

// ========================================
// DATA MANAGER
// ========================================

class DataManager {
  constructor() {
    this.apiBase = '/api/display';
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    this.retryAttempts = 0;
    this.maxRetries = 3;
    this.retryDelay = 2000;
  }

  async fetchData(endpoint = '/all') {
    const cacheKey = endpoint;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    try {
      const response = await fetch(`${this.apiBase}${endpoint}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'API request failed');
      }

      // Cache the successful response
      this.cache.set(cacheKey, {
        data: data.data,
        timestamp: Date.now()
      });

      this.retryAttempts = 0; // Reset retry attempts on success
      return data.data;

    } catch (error) {
      if (this.retryAttempts < this.maxRetries) {
        this.retryAttempts++;
        await this.delay(this.retryDelay * this.retryAttempts);
        return this.fetchData(endpoint);
      }
      
      throw error;
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  clearCache() {
    this.cache.clear();
  }

  async fetchAllData() {
    return this.fetchData('/all');
  }

  async fetchMenuData() {
    return this.fetchData('/menu');
  }

  async fetchWasteData() {
    return this.fetchData('/waste');
  }

  async fetchSpecialMenuData() {
    return this.fetchData('/special-menu');
  }

  async fetchQuoteData() {
    return this.fetchData('/quote');
  }
}

// ========================================
// SLIDE MANAGER
// ========================================

// SlideManager and all related logic removed for new section-based auto-scroll layout.

// ========================================
// UI MANAGER
// ========================================

class UIManager {
  constructor() {
    this.loadingIndicator = document.getElementById('loadingIndicator');
    this.errorMessage = document.getElementById('errorMessage');
    this.statusTime = document.getElementById('statusTime');
    this.statusConnection = document.getElementById('statusConnection');
    this.init();
  }

  init() {
    this.updateStatusBar();
    setInterval(() => this.updateStatusBar(), 1000);
  }

  showLoading() {
    if (this.loadingIndicator) {
      this.loadingIndicator.classList.add('show');
      this.loadingIndicator.setAttribute('aria-hidden', 'false');
    }
  }

  hideLoading() {
    if (this.loadingIndicator) {
      this.loadingIndicator.classList.remove('show');
      this.loadingIndicator.setAttribute('aria-hidden', 'true');
    }
  }

  showError(message = 'Unable to load data. Retrying...') {
    if (this.errorMessage) {
      const errorText = this.errorMessage.querySelector('.error-text');
      if (errorText) {
        errorText.textContent = message;
      }
      this.errorMessage.classList.add('show');
      this.errorMessage.setAttribute('aria-hidden', 'false');
    }
  }

  hideError() {
    if (this.errorMessage) {
      this.errorMessage.classList.remove('show');
      this.errorMessage.setAttribute('aria-hidden', 'true');
    }
  }

  updateStatusBar() {
    // Update time
    if (this.statusTime) {
      this.statusTime.textContent = formatDate(new Date());
    }

    // Update connection status and add fullscreen functionality
    if (this.statusConnection) {
      const isOnline = navigator.onLine;
      this.statusConnection.textContent = isOnline ? 'Connected' : 'Offline';
      this.statusConnection.style.color = isOnline ? 'var(--color-success)' : 'var(--color-error)';
      
      // Add click event for fullscreen toggle
      this.statusConnection.style.cursor = 'pointer';
      this.statusConnection.title = 'Click to toggle fullscreen';
      
      // Remove existing event listener to prevent duplicates
      this.statusConnection.removeEventListener('click', toggleFullscreen);
      // Add new event listener
      this.statusConnection.addEventListener('click', toggleFullscreen);
    }
  }

  showNavigationControls() {
    const navControls = document.querySelector('.nav-controls');
    const progressIndicators = document.querySelector('.progress-indicators');
    
    if (navControls) {
      navControls.setAttribute('aria-hidden', 'false');
      navControls.style.opacity = '1';
    }
    
    if (progressIndicators) {
      progressIndicators.setAttribute('aria-hidden', 'false');
      progressIndicators.style.opacity = '1';
    }
  }

  hideNavigationControls() {
    const navControls = document.querySelector('.nav-controls');
    const progressIndicators = document.querySelector('.progress-indicators');
    
    if (navControls) {
      navControls.setAttribute('aria-hidden', 'true');
      navControls.style.opacity = '0';
    }
    
    if (progressIndicators) {
      progressIndicators.setAttribute('aria-hidden', 'true');
      progressIndicators.style.opacity = '0';
    }
  }
}

// ========================================
// CONTENT RENDERER
// ========================================

class ContentRenderer {
  constructor(gridManager) {
    this.gridManager = gridManager;
  }

  renderMenuItems(gridId, items, mealType) {
    const grid = document.getElementById(gridId);
    if (!grid) {
      return;
    }

    if (!items || items.length === 0) {
      grid.innerHTML = this.createNoDataCard(mealType);
      this.gridManager.updateItemCount(gridId, 0);
      return;
    }

    // Pass mealType to createMenuCard
    const cardsHTML = items.map(item => this.createMenuCard(item, mealType)).join('');
    grid.innerHTML = cardsHTML;
    
    this.gridManager.updateItemCount(gridId, items.length);
    
    // Add animation classes
    const cards = grid.querySelectorAll('.menu-card');
    cards.forEach((card, index) => {
      setTimeout(() => {
        card.classList.add('fade-in');
      }, index * 100);
    });
  }

  createMenuCard(item, mealType) {
    const nutrition = item.nutritionalInfo || {};
    const imageEmoji = this.getFoodEmoji(item.name);

    // Hide nutrition info for special menu
    if (mealType === 'special') {
      return `
      <div class="menu-card" tabindex="0">
        <div class="menu-card__image">${imageEmoji}</div>
        <h3 class="menu-card__title">${this.escapeHtml(item.name)}</h3>
        <p class="menu-card__description">${this.escapeHtml(item.description || '')}</p>
      </div>
      `;
    }

    return `
      <div class="menu-card" tabindex="0">
        <div class="menu-card__image">${imageEmoji}</div>
        <h3 class="menu-card__title">${this.escapeHtml(item.name)}</h3>
        <p class="menu-card__description">${this.escapeHtml(item.description || '')}</p>
        <div class="menu-card__nutrition">
          <div class="menu-card__nutrition-title">Nutrition Info</div>
          ${this.createNutritionRows(nutrition)}
        </div>
      </div>
    `;
  }

  createNutritionRows(nutrition) {
    const nutritionData = [
      { label: 'Calories', value: nutrition.calories, unit: 'kcal' },
      { label: 'Protein', value: nutrition.protein, unit: 'g' },
      { label: 'Carbs', value: nutrition.carbohydrates, unit: 'g' },
      { label: 'Fat', value: nutrition.fat, unit: 'g' }
    ];

    return nutritionData
      .filter(item => item.value !== undefined && item.value !== null)
      .map(item => `
        <div class="menu-card__nutrition-row">
          <span>${item.label}</span>
          <span class="menu-card__nutrition-value">${item.value}${item.unit}</span>
        </div>
      `).join('');
  }

  createNoDataCard(mealType) {
    const mealEmojis = {
      breakfast: '🍳',
      lunch: '🍽️',
      snacks: '🍿',
      dinner: '🌙',
      special: '🍛'
    };

                        return `
      <div class="menu-card error-card">
        <div class="menu-card__image">${mealEmojis[mealType] || '❌'}</div>
        <h3 class="menu-card__title">No Data Available</h3>
        <p class="menu-card__description">No ${mealType} items available at the moment</p>
        <div class="menu-card__nutrition">
          <div class="menu-card__nutrition-title">Status</div>
          <div class="menu-card__nutrition-row">
            <span>Status</span>
            <span class="menu-card__nutrition-value">No Data</span>
                                </div>
                        </div>
                    </div>
                `;
            }

  renderWasteData(wasteData) {
    if (!wasteData) {
      this.showNoWasteData();
      return;
    }

    // Update breakfast waste
    const breakfastWaste = document.getElementById('breakfast-waste');
    if (breakfastWaste) {
      breakfastWaste.innerHTML = `
        <span class="amount">${wasteData.breakfast?.wasteAmount || 0} kg</span>
        <span class="percentage">(${wasteData.breakfast?.wastePercentage || 0}% of prepared)</span>
      `;
    }

    // Update lunch waste
    const lunchWaste = document.getElementById('lunch-waste');
    if (lunchWaste) {
      lunchWaste.innerHTML = `
        <span class="amount">${wasteData.lunch?.wasteAmount || 0} kg</span>
        <span class="percentage">(${wasteData.lunch?.wastePercentage || 0}% of prepared)</span>
      `;
    }

    // Update snacks waste
    const snacksWaste = document.getElementById('snacks-waste');
    if (snacksWaste) {
      snacksWaste.innerHTML = `
        <span class="amount">${wasteData.snacks?.wasteAmount || 0} kg</span>
        <span class="percentage">(${wasteData.snacks?.wastePercentage || 0}% of prepared)</span>
      `;
    }

    // Update dinner waste
    const dinnerWaste = document.getElementById('dinner-waste');
    if (dinnerWaste) {
      dinnerWaste.innerHTML = `
        <span class="amount">${wasteData.dinner?.wasteAmount || 0} kg</span>
        <span class="percentage">(${wasteData.dinner?.wastePercentage || 0}% of prepared)</span>
      `;
    }

    // Update total waste
    const totalWaste = document.getElementById('total-waste');
    if (totalWaste) {
      totalWaste.textContent = `${wasteData.totalWaste || 0} kg`;
    }
  }

  showNoWasteData() {
    const wasteElements = ['breakfast-waste', 'lunch-waste', 'dinner-waste', 'snacks-waste', 'total-waste'];
    wasteElements.forEach(id => {
      const element = document.getElementById(id);
            if (element) {
        element.innerHTML = '<span class="amount">-- kg</span><span class="percentage">(--% of prepared)</span>';
      }
    });
  }

  renderSpecialMenu(specialMenuData) {
    const grid = document.getElementById('special-menu-grid');
    const banner = document.getElementById('special-menu-banner');
    
    if (!specialMenuData || !specialMenuData.items || specialMenuData.items.length === 0) {
      if (grid) {
        grid.innerHTML = this.createNoDataCard('special');
      }
      if (banner) {
        banner.textContent = 'State Special Menu';
      }
      return;
    }

    // Update banner with date range
    if (banner) {
      const startDate = new Date(specialMenuData.startDate).toLocaleDateString('en-IN');
      const endDate = new Date(specialMenuData.endDate).toLocaleDateString('en-IN');
      banner.textContent = `${specialMenuData.state} Special Menu (${startDate} - ${endDate})`;
    }

    // Render special menu items
    if (grid) {
      const items = specialMenuData.items.map(item => ({
        ...item,
        nutritionalInfo: {
          calories: 'Special',
          protein: specialMenuData.state,
          carbohydrates: 'Traditional',
          fat: 'Regional'
        }
      }));

      this.renderMenuItems('special-menu-grid', items, 'special');
    }
  }

  renderQuote(quoteData) {
    const quoteText = document.getElementById('quote-text');
    const quoteAuthor = document.getElementById('quote-author');

    if (!quoteData) {
      if (quoteText) quoteText.textContent = '"Loading inspirational quote..."';
      if (quoteAuthor) quoteAuthor.textContent = '- Author';
      return;
    }

    if (quoteText) {
      quoteText.textContent = `"${this.escapeHtml(quoteData.text)}"`;
    }

    if (quoteAuthor) {
      quoteAuthor.textContent = `- ${this.escapeHtml(quoteData.author)}`;
    }
  }

  getFoodEmoji(foodName) {
    const foodEmojis = {
      'rice': '🍚',
      'bread': '🍞',
      'chicken': '🍗',
      'fish': '🐟',
      'vegetables': '🥬',
      'fruits': '🍎',
      'milk': '🥛',
      'eggs': '🥚',
      'tea': '☕',
      'coffee': '☕',
      'soup': '🍲',
      'salad': '🥗',
      'pasta': '🍝',
      'pizza': '🍕',
      'burger': '🍔',
      'sandwich': '🥪',
      'cake': '🍰',
      'ice cream': '🍦',
      'chocolate': '🍫',
      'candy': '🍬'
    };

    const lowerName = foodName.toLowerCase();
    for (const [food, emoji] of Object.entries(foodEmojis)) {
      if (lowerName.includes(food)) {
        return emoji;
      }
    }

    // Default emojis based on meal type
    return '🍽️';
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// ========================================
// MAIN DISPLAY CONTROLLER
// ========================================

class MessTVDisplay {
  constructor() {
    this.dataManager = new DataManager();
    this.gridManager = new ResponsiveGridManager();
    // SlideManager removed
    this.uiManager = new UIManager();
    this.contentRenderer = new ContentRenderer(this.gridManager);
    this.refreshInterval = 5 * 60 * 1000; // 5 minutes
    this.refreshTimer = null;
    this.isInitialized = false;
    this.init();
  }

  async init() {
    try {
      this.uiManager.showLoading();
      await this.loadAllData();
      this.startAutoRefresh();
      this.isInitialized = true;
      this.uiManager.hideLoading();
      // Show navigation controls briefly on first load (removed)
    } catch (error) {
      this.uiManager.showError('Failed to initialize display system');
      this.uiManager.hideLoading();
    }
  }

  async loadAllData() {
    try {
      const data = await this.dataManager.fetchAllData();
      // Render menu data
      const meals = ['breakfast', 'lunch', 'snacks', 'dinner'];
      meals.forEach(meal => {
        const items = data.menu?.[meal] || [];
        this.contentRenderer.renderMenuItems(`${meal}-menu-grid`, items, meal);
      });
      // Render other data
      this.contentRenderer.renderWasteData(data.waste);
      this.contentRenderer.renderSpecialMenu(data.specialMenu);
      this.contentRenderer.renderQuote(data.quote);
    } catch (error) {
      this.uiManager.showError('Failed to load display data');
      throw error;
    }
  }

  startAutoRefresh() {
    this.refreshTimer = setInterval(() => {
      this.loadAllData().catch(error => {
        // Auto refresh failed silently
      });
    }, this.refreshInterval);
  }

  stopAutoRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  isUserInteracting() {
    // Check if user is actively interacting with the display
    return document.querySelector(':hover') !== null || 
           document.activeElement !== document.body;
  }

  destroy() {
    this.stopAutoRefresh();
    // SlideManager destroy removed
    this.gridManager.destroy();
    this.dataManager.clearCache();
  }
}

// ========================================
// INITIALIZATION
// ========================================

document.addEventListener('DOMContentLoaded', () => {
  window.messTVDisplay = new MessTVDisplay();
});

document.addEventListener('visibilitychange', () => {
  if (window.messTVDisplay) {
    if (document.hidden) {
      window.messTVDisplay.stopAutoRefresh();
    } else {
      window.messTVDisplay.startAutoRefresh();
    }
  }
});

window.addEventListener('beforeunload', () => {
  if (window.messTVDisplay) {
    window.messTVDisplay.destroy();
  }
});

// Remove fullscreen/slideManager event listeners

// Export for potential external use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    MessTVDisplay,
    DataManager,
    // SlideManager removed
    UIManager,
    ContentRenderer,
    ResponsiveGridManager
  };
} 