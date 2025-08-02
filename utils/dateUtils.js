/**
 * Date Utilities for IST (Indian Standard Time) handling using Luxon
 */
const { DateTime, Interval } = require('luxon');

const IST_ZONE = 'Asia/Kolkata';

/**
 * Get current date in IST
 * @returns {DateTime} Current date in IST
 */
function getCurrentIST() {
  return DateTime.now().setZone(IST_ZONE);
}

/**
 * Convert any date to IST DateTime
 * @param {Date|string|DateTime} date - Date to convert
 * @returns {DateTime} DateTime in IST
 */
function toIST(date) {
  if (date instanceof DateTime) {
    return date.setZone(IST_ZONE);
  }
  if (date instanceof Date) {
    return DateTime.fromJSDate(date, { zone: IST_ZONE });
  }
  if (typeof date === 'string') {
    // Try parsing as ISO or YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return DateTime.fromISO(date, { zone: IST_ZONE });
    }
    return DateTime.fromJSDate(new Date(date), { zone: IST_ZONE });
  }
  return DateTime.now().setZone(IST_ZONE);
}

/**
 * Get start of day in IST
 * @param {Date|string|DateTime} date - Date to process
 * @returns {DateTime} Start of day in IST
 */
function getISTStartOfDay(date = null) {
  return (date ? toIST(date) : getCurrentIST()).startOf('day');
}

/**
 * Get end of day in IST
 * @param {Date|string|DateTime} date - Date to process
 * @returns {DateTime} End of day in IST
 */
function getISTEndOfDay(date = null) {
  return (date ? toIST(date) : getCurrentIST()).endOf('day');
}

/**
 * Parse date string to IST DateTime object
 * @param {string} dateString - Date string in various formats (YYYY-MM-DD, DD-MM-YYYY, etc.)
 * @returns {DateTime} DateTime in IST
 */
function parseISTDate(dateString) {
  // Try different date formats
  let parsedDate;
  
  // Try ISO format first (YYYY-MM-DD)
  parsedDate = DateTime.fromISO(dateString);
  if (parsedDate.isValid) {
    return parsedDate.setZone(IST_ZONE);
  }
  
  // Try DD-MM-YYYY format
  parsedDate = DateTime.fromFormat(dateString, 'dd-MM-yyyy');
  if (parsedDate.isValid) {
    return parsedDate.setZone(IST_ZONE);
  }
  
  // Try DD/MM/YYYY format
  parsedDate = DateTime.fromFormat(dateString, 'dd/MM/yyyy');
  if (parsedDate.isValid) {
    return parsedDate.setZone(IST_ZONE);
  }
  
  // Try MM-DD-YYYY format
  parsedDate = DateTime.fromFormat(dateString, 'MM-dd-yyyy');
  if (parsedDate.isValid) {
    return parsedDate.setZone(IST_ZONE);
  }
  
  // Try MM/DD/YYYY format
  parsedDate = DateTime.fromFormat(dateString, 'MM/dd/yyyy');
  if (parsedDate.isValid) {
    return parsedDate.setZone(IST_ZONE);
  }
  
  // If none work, try the original ISO format and let it fail
  return DateTime.fromISO(dateString).setZone(IST_ZONE);
}

/**
 * Format date for IST display
 * @param {Date|DateTime|string} date - Date to format
 * @param {string} locale - Locale for formatting (default: 'en-IN')
 * @returns {string} Formatted date string
 */
function formatISTDate(date, locale = 'en-IN') {
  return toIST(date).setLocale(locale).toLocaleString(DateTime.DATE_MED);
}

/**
 * Format date for HTML date input (YYYY-MM-DD)
 * @param {Date|DateTime|string} date - Date to format
 * @returns {string} Date string in YYYY-MM-DD format
 */
function formatDateForInput(date) {
  return toIST(date).toFormat('yyyy-MM-dd');
}

/**
 * Get IST date range
 * @param {Date|DateTime|string} startDate - Start date
 * @param {Date|DateTime|string} endDate - End date
 * @returns {Array<Date>} Array of JS Dates in IST
 */
function getISTDateRange(startDate, endDate) {
  const start = getISTStartOfDay(startDate);
  const end = getISTStartOfDay(endDate);
  const days = [];
  let current = start;
  while (current <= end) {
    days.push(current.toJSDate());
    current = current.plus({ days: 1 });
  }
  return days;
}

/**
 * Check if date is today in IST
 * @param {Date|DateTime|string} date - Date to check
 * @returns {boolean} True if date is today in IST
 */
function isToday(date) {
  const today = getISTStartOfDay();
  const checkDate = getISTStartOfDay(date);
  return today.hasSame(checkDate, 'day');
}

/**
 * Check if date is in the past in IST
 * @param {Date|DateTime|string} date - Date to check
 * @returns {boolean} True if date is in the past
 */
function isPastDate(date) {
  const today = getISTStartOfDay();
  const checkDate = getISTStartOfDay(date);
  return checkDate < today;
}

/**
 * Check if date is in the future in IST
 * @param {Date|DateTime|string} date - Date to check
 * @returns {boolean} True if date is in the future
 */
function isFutureDate(date) {
  const today = getISTStartOfDay();
  const checkDate = getISTStartOfDay(date);
  return checkDate > today;
}

/**
 * Add days to a date in IST
 * @param {Date|DateTime|string} date - Base date
 * @param {number} days - Number of days to add
 * @returns {DateTime} New DateTime with days added
 */
function addDays(date, days) {
  return toIST(date).plus({ days });
}

/**
 * Subtract days from a date in IST
 * @param {Date|DateTime|string} date - Base date
 * @param {number} days - Number of days to subtract
 * @returns {DateTime} New DateTime with days subtracted
 */
function subtractDays(date, days) {
  return toIST(date).minus({ days });
}

/**
 * Get day name in IST
 * @param {Date|DateTime|string} date - Date to get day name for
 * @param {string} locale - Locale for formatting (default: 'en-IN')
 * @returns {string} Day name
 */
function getDayName(date, locale = 'en-IN') {
  return toIST(date).setLocale(locale).toFormat('ccc');
}

/**
 * Convert date to MongoDB query format for IST
 * @param {Date|DateTime|string} date - Date to convert
 * @returns {Object} MongoDB date range query
 */
function toMongoDateRange(date) {
  const startOfDay = getISTStartOfDay(date).toJSDate();
  const endOfDay = getISTEndOfDay(date).toJSDate();
  return {
    $gte: startOfDay,
    $lt: endOfDay
  };
}

module.exports = {
  getCurrentIST,
  toIST,
  getISTStartOfDay,
  getISTEndOfDay,
  parseISTDate,
  formatISTDate,
  formatDateForInput,
  getISTDateRange,
  isToday,
  isPastDate,
  isFutureDate,
  addDays,
  subtractDays,
  getDayName,
  toMongoDateRange
};