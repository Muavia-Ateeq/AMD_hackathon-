// backend/src/utils/money.js
// Utility functions for monetary calculations. Owned by Ammar

/**
 * Normalizes a monetary string to a plain numeric string with '.' as decimal separator.
 * Handles:
 *   - "1,234.56" (US)
 *   - "1.234,56" (EU)
 *   - "EUR 1.234,56" or "USD 1,234.56"
 *   - "1234,56" (EU without thousands separator)
 *   - "1234.56" (US without thousands separator)
 */
function normalizeString(value) {
  if (typeof value !== 'string') return value;
  const withoutCurrency = value.replace(/^\p{Sc}|^[A-Z]{3}\s+/u, '').trim();
  const lastComma = withoutCurrency.lastIndexOf(',');
  const lastDot = withoutCurrency.lastIndexOf('.');
  let normalized = withoutCurrency;
  if (lastComma > lastDot) {
    // EU style: '.' thousands, ',' decimal
    normalized = withoutCurrency.replace(/\./g, '').replace(/,/g, '.');
  } else if (lastDot > lastComma) {
    // US style: ',' thousands, '.' decimal
    normalized = withoutCurrency.replace(/,/g, '');
  } else {
    // No clear decimal separator, just strip spaces and commas
    normalized = withoutCurrency.replace(/[ ,]/g, '');
  }
  return normalized;
}

/**
 * Parses a monetary value (string or number) and returns integer minor units (cents).
 * @param {string|number} value - The monetary amount.
 * @param {string} [currency='USD'] - Currency code (unused currently).
 * @returns {number} Minor units as integer.
 */
function toMinor(value, currency = 'USD') {
  if (value == null) return 0;
  if (typeof value === 'number') return Math.round(value * 100);
  const normalized = normalizeString(value);
  const floatVal = parseFloat(normalized);
  if (Number.isNaN(floatVal)) return 0;
  return Math.round(floatVal * 100);
}

/**
 * Converts integer minor units back to a string with two decimal places.
 * @param {number} minor - Minor unit integer.
 * @param {string} [currency='USD']
 * @returns {string}
 */
function fromMinor(minor, currency = 'USD') {
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(minor);
  const dollars = Math.trunc(abs / 100);
  const cents = abs % 100;
  return `${sign}${dollars}.${cents.toString().padStart(2, '0')}`;
}

/**
 * Determines whether two minor-unit amounts are within an allowed tolerance.
 * @param {number} aMinor
 * @param {number} bMinor
 * @param {number} toleranceMinor - Allowed difference in minor units (default 0).
 * @returns {boolean}
 */
function isCloseMinor(aMinor, bMinor, toleranceMinor = 0) {
  return Math.abs(aMinor - bMinor) <= toleranceMinor;
}

function roundMoney(value) {
  // Round to two decimal places (major units)
  if (typeof value !== 'number') return value;
  return Math.round(value * 100) / 100;
}

function isClose(a, b, tolerance = 0.01) {
  // Compare two numbers within a default tolerance of 0.01 (major units)
  if (typeof a !== 'number' || typeof b !== 'number') return false;
  return Math.abs(a - b) <= tolerance;
}

module.exports = { toMinor, fromMinor, normalizeString, isCloseMinor, roundMoney, isClose };
