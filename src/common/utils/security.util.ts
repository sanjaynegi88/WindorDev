/**
 * Sanitizes HTML content to prevent XSS attacks
 * @param input - The input string to sanitize
 * @returns Sanitized string safe for HTML output
 */
export function sanitizeHtml(input: string | null | undefined): string {
  if (!input) {
    return '';
  }
  
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Sanitizes log input to prevent log injection attacks
 * @param input - The input to sanitize for logging
 * @returns Sanitized string safe for logging
 */
export function sanitizeLogInput(input: any): string {
  if (input === null || input === undefined) {
    return 'null';
  }
  
  return String(input).replace(/[\r\n]/g, '');
}