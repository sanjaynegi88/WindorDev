import { BadRequestException } from '@nestjs/common';

/**
 * Validates and parses date string parameters
 * @param dateString - The date string to validate
 * @param paramName - The parameter name for error messages
 * @returns Parsed Date object or undefined if dateString is falsy
 * @throws BadRequestException if date format is invalid
 */
export function validateAndParseDate(dateString: string, paramName: string): Date | undefined {
  if (!dateString) {
    return undefined;
  }

  const parsedDate = new Date(dateString);
  
  if (isNaN(parsedDate.getTime())) {
    throw new BadRequestException(
      `Invalid ${paramName} format. Please use ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ)`
    );
  }

  return parsedDate;
}

/**
 * Validates date range ensuring fromDate is not later than toDate
 * @param fromDate - Start date
 * @param toDate - End date
 * @throws BadRequestException if fromDate is later than toDate
 */
export function validateDateRange(fromDate?: Date, toDate?: Date): void {
  if (fromDate && toDate && fromDate > toDate) {
    throw new BadRequestException('fromDate cannot be later than toDate');
  }
}

/**
 * Converts a date to end of day (23:59:59.999)
 * @param date - The date to convert
 * @returns New Date object set to end of day
 */
export function toEndOfDay(date: Date): Date {
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  return endOfDay;
}

/**
 * Formats date for display in filters
 * @param date - The date to format
 * @returns Formatted date string
 */
export function formatDateForDisplay(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}