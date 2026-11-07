/** Whitespace-, case- and quote-insensitive form, so a quote matches the scheme however the PDF broke its lines. */
export function normForQuote(s: string): string {
  return s
    .normalize('NFKC')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, '')
    .toLowerCase();
}
