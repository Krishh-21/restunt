/**
 * Utility types and helpers for Dinely Restaurant Operating System
 * Common type utilities, pagination, filtering, and data transformation helpers
 */

import type { DecimalValue, DateString } from './database.js';

// ========== Pagination Utilities ==========
export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

export const createPaginationMeta = (
  page: number,
  pageSize: number,
  totalItems: number
): PaginationMeta => ({
  page,
  pageSize,
  totalItems,
  totalPages: Math.ceil(totalItems / pageSize),
  hasNextPage: page * pageSize < totalItems,
  hasPreviousPage: page > 1,
});

// ========== Date & Time Utilities ==========
export interface DateRange {
  startDate?: DateString;
  endDate?: DateString;
}

export interface TimeRange {
  startTime: string; // HH:mm
  endTime: string; // HH:mm
}

export const isValidDateRange = (range: DateRange): boolean => {
  if (!range.startDate || !range.endDate) return true;
  return new Date(range.startDate) <= new Date(range.endDate);
};

export const formatDateForAPI = (date: Date): DateString => date.toISOString();

export const parseAPIDate = (dateString: DateString): Date => new Date(dateString);

export const isToday = (dateString: DateString): boolean => {
  const date = new Date(dateString);
  const today = new Date();
  return date.toDateString() === today.toDateString();
};

export const isBetweenDates = (date: DateString, start?: DateString, end?: DateString): boolean => {
  const dateObj = new Date(date);
  const startObj = start ? new Date(start) : null;
  const endObj = end ? new Date(end) : null;

  if (startObj && dateObj < startObj) return false;
  if (endObj && dateObj > endObj) return false;
  return true;
};

// ========== Currency & Decimal Utilities ==========
export const formatCurrency = (
  amount: DecimalValue,
  currency = 'INR',
  locale = 'en-IN'
): string => {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numAmount);
};

export const parseDecimal = (value: DecimalValue): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return parseFloat(value);
  return Number(value);
};

export const roundDecimal = (value: DecimalValue, decimals = 2): number => {
  const num = parseDecimal(value);
  return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
};

// ========== Search & Filter Utilities ==========
export interface SearchParams {
  search?: string;
  searchFields?: string[];
}

export interface SortParams {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface FilterParams extends PaginationParams, SearchParams, SortParams {}

export const normalizeSearchTerm = (term: string): string =>
  term.toLowerCase().trim().replace(/\s+/g, ' ');

export const createSearchRegex = (term: string): RegExp =>
  new RegExp(normalizeSearchTerm(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

// ========== Array Utilities ==========
export const chunk = <T>(array: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

export const groupBy = <T, K extends keyof T>(array: T[], key: K): Record<string, T[]> => {
  return array.reduce(
    (groups, item) => {
      const groupKey = String(item[key]);
      groups[groupKey] = groups[groupKey] || [];
      groups[groupKey].push(item);
      return groups;
    },
    {} as Record<string, T[]>
  );
};

export const uniqueBy = <T, K extends keyof T>(array: T[], key: K): T[] => {
  const seen = new Set();
  return array.filter((item) => {
    const keyValue = item[key];
    if (seen.has(keyValue)) return false;
    seen.add(keyValue);
    return true;
  });
};

export const sortBy = <T>(array: T[], key: keyof T, order: 'asc' | 'desc' = 'asc'): T[] => {
  return [...array].sort((a, b) => {
    const aVal = a[key];
    const bVal = b[key];

    if (aVal < bVal) return order === 'asc' ? -1 : 1;
    if (aVal > bVal) return order === 'asc' ? 1 : -1;
    return 0;
  });
};

// ========== Object Utilities ==========
export const pick = <T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> => {
  const picked = {} as Pick<T, K>;
  keys.forEach((key) => {
    if (key in obj) {
      picked[key] = obj[key];
    }
  });
  return picked;
};

export const omit = <T, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> => {
  const omitted = { ...obj };
  keys.forEach((key) => {
    delete omitted[key];
  });
  return omitted;
};

export const isEmptyObject = (obj: Record<string, unknown>): boolean => {
  return Object.keys(obj).length === 0;
};

export const deepMerge = <T extends Record<string, unknown>>(target: T, source: Partial<T>): T => {
  const result: Record<string, unknown> = { ...target };

  Object.keys(source).forEach((key) => {
    const sourceValue = source[key];
    const targetValue = target[key];

    if (
      sourceValue &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      targetValue &&
      typeof targetValue === 'object' &&
      !Array.isArray(targetValue)
    ) {
      result[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>
      ) as T[Extract<keyof T, string>];
    } else if (sourceValue !== undefined) {
      result[key] = sourceValue as T[Extract<keyof T, string>];
    }
  });

  return result as T;
};

// ========== Validation Utilities ==========
export const isValidID = (id: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const isValidPhone = (phone: string): boolean => {
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(phone);
};

export const isValidGSTIN = (gstin: string): boolean => {
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return gstinRegex.test(gstin);
};

// ========== String Utilities ==========
export const slugify = (text: string): string => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
};

export const capitalize = (text: string): string => {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
};

export const truncate = (text: string, length: number, suffix = '...'): string => {
  if (text.length <= length) return text;
  return text.substring(0, length - suffix.length) + suffix;
};

export const maskPhone = (phone: string): string => {
  if (phone.length < 4) return phone;
  const visibleDigits = 2;
  const masked = '*'.repeat(phone.length - visibleDigits * 2);
  return phone.slice(0, visibleDigits) + masked + phone.slice(-visibleDigits);
};

export const maskEmail = (email: string): string => {
  const [username = '', domain = ''] = email.split('@');
  if (username.length <= 2) return email;

  const visibleChars = Math.min(2, Math.floor(username.length / 2));
  const masked = '*'.repeat(username.length - visibleChars * 2);
  return username.slice(0, visibleChars) + masked + username.slice(-visibleChars) + '@' + domain;
};

// ========== Business Logic Utilities ==========
export const calculateTax = (
  amount: DecimalValue,
  taxRate: number
): { taxAmount: number; totalAmount: number } => {
  const baseAmount = parseDecimal(amount);
  const taxAmount = roundDecimal(baseAmount * (taxRate / 100));
  const totalAmount = roundDecimal(baseAmount + taxAmount);

  return { taxAmount, totalAmount };
};

export const calculateDiscount = (
  amount: DecimalValue,
  discountRate: number,
  maxDiscount?: DecimalValue
): { discountAmount: number; finalAmount: number } => {
  const baseAmount = parseDecimal(amount);
  let discountAmount = roundDecimal(baseAmount * (discountRate / 100));

  if (maxDiscount && discountAmount > parseDecimal(maxDiscount)) {
    discountAmount = parseDecimal(maxDiscount);
  }

  const finalAmount = roundDecimal(baseAmount - discountAmount);
  return { discountAmount, finalAmount };
};

export const calculateServiceCharge = (
  amount: DecimalValue,
  serviceChargeRate: number
): { serviceCharge: number; totalAmount: number } => {
  const baseAmount = parseDecimal(amount);
  const serviceCharge = roundDecimal(baseAmount * (serviceChargeRate / 100));
  const totalAmount = roundDecimal(baseAmount + serviceCharge);

  return { serviceCharge, totalAmount };
};

export const generateOrderNumber = (
  outletPrefix: string,
  year: number,
  sequence: number
): string => {
  const paddedSequence = sequence.toString().padStart(6, '0');
  return `${outletPrefix}-${year}-${paddedSequence}`;
};

export const generateBillNumber = (
  outletPrefix: string,
  year: number,
  sequence: number
): string => {
  const paddedSequence = sequence.toString().padStart(6, '0');
  return `${outletPrefix}-${year}-${paddedSequence}`;
};

// ========== Performance Utilities ==========
export const debounce = <T extends (...args: unknown[]) => void>(func: T, delay: number): T => {
  let timeoutId: NodeJS.Timeout;

  return ((...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  }) as T;
};

export const throttle = <T extends (...args: unknown[]) => void>(func: T, delay: number): T => {
  let lastCall = 0;

  return ((...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      func(...args);
    }
  }) as T;
};

// ========== Error Utilities ==========
export class DinelyError extends Error {
  constructor(
    public code: string,
    message: string,
    public field?: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'DinelyError';
  }
}

export const createErrorResponse = (
  code: string,
  message: string,
  field?: string,
  details?: Record<string, unknown>
) => ({
  success: false,
  error: { code, message, field, details },
});

// ========== Type Guards ==========
export const isDefined = <T>(value: T | undefined | null): value is T => {
  return value !== undefined && value !== null;
};

export const isString = (value: unknown): value is string => {
  return typeof value === 'string';
};

export const isNumber = (value: unknown): value is number => {
  return typeof value === 'number' && !isNaN(value);
};

export const isBoolean = (value: unknown): value is boolean => {
  return typeof value === 'boolean';
};

export const isArray = <T>(value: unknown): value is T[] => {
  return Array.isArray(value);
};

export const isObject = (value: unknown): value is Record<string, unknown> => {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
};

// ========== Analytics Utilities ==========
export interface MetricData {
  timestamp: DateString;
  value: number;
  label?: string;
}

export const calculateGrowthRate = (current: number, previous: number): number => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return roundDecimal(((current - previous) / previous) * 100);
};

export const calculateAverage = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sum = values.reduce((acc, val) => acc + val, 0);
  return roundDecimal(sum / values.length);
};

export const calculateMedian = (values: number[]): number => {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return roundDecimal((sorted[mid - 1]! + sorted[mid]!) / 2);
  } else {
    return sorted[mid]!;
  }
};

export const calculatePercentile = (values: number[], percentile: number): number => {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const index = (percentile / 100) * (sorted.length - 1);
  const floor = Math.floor(index);
  const ceil = Math.ceil(index);

  if (floor === ceil) {
    return sorted[floor]!;
  } else {
    const fraction = index - floor;
    return roundDecimal(sorted[floor]! * (1 - fraction) + sorted[ceil]! * fraction);
  }
};

// ========== Export all utility functions ==========
export const Utils = {
  // Pagination
  createPaginationMeta,

  // Date & Time
  isValidDateRange,
  formatDateForAPI,
  parseAPIDate,
  isToday,
  isBetweenDates,

  // Currency & Decimals
  formatCurrency,
  parseDecimal,
  roundDecimal,

  // Search & Filter
  normalizeSearchTerm,
  createSearchRegex,

  // Arrays
  chunk,
  groupBy,
  uniqueBy,
  sortBy,

  // Objects
  pick,
  omit,
  isEmptyObject,
  deepMerge,

  // Validation
  isValidID,
  isValidEmail,
  isValidPhone,
  isValidGSTIN,

  // Strings
  slugify,
  capitalize,
  truncate,
  maskPhone,
  maskEmail,

  // Business Logic
  calculateTax,
  calculateDiscount,
  calculateServiceCharge,
  generateOrderNumber,
  generateBillNumber,

  // Performance
  debounce,
  throttle,

  // Errors
  createErrorResponse,

  // Type Guards
  isDefined,
  isString,
  isNumber,
  isBoolean,
  isArray,
  isObject,

  // Analytics
  calculateGrowthRate,
  calculateAverage,
  calculateMedian,
  calculatePercentile,
} as const;

export default Utils;
