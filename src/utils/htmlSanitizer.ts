const DANGEROUS_TAGS = /<\s*\/?\s*(script|iframe|object|embed|link|meta|base|form|input|button|textarea|select|option|svg|math)[^>]*>/gi;
const EVENT_HANDLER_ATTRIBUTES = /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const DANGEROUS_URLS = /\s+(href|src|xlink:href)\s*=\s*(["'])\s*(javascript:|data:text\/html|vbscript:)[^"']*\2/gi;
const STYLE_EXPRESSIONS = /\s+style\s*=\s*(["'])[^"']*(expression\s*\(|javascript:|url\s*\(\s*["']?\s*javascript:)[^"']*\1/gi;

export function sanitizeHtml(html: string): string {
  return html
    .replace(DANGEROUS_TAGS, '')
    .replace(EVENT_HANDLER_ATTRIBUTES, '')
    .replace(DANGEROUS_URLS, '')
    .replace(STYLE_EXPRESSIONS, '');
}
