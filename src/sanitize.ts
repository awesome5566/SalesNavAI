/**
 * Sanitize text by removing invisible characters
 */

export function sanitizeText(text: string): string {
  return text
    .replace(/^\uFEFF/, "") // BOM
    .replace(/\u00A0/g, " ") // NBSP → space
    .replace(/\u200B/g, "") // Zero-width space
    .replace(/\u200C/g, "") // Zero-width non-joiner
    .replace(/\u200D/g, "") // Zero-width joiner
    .replace(/\uFEFF/g, "") // Zero-width no-break space
    .replace(/\r\n/g, "\n") // CR+LF → LF
    .replace(/\r/g, "\n") // CR → LF
    .replace(/[\u2018\u2019]/g, "'") // Smart single quotes → straight
    .replace(/[\u201C\u201D]/g, '"') // Smart double quotes → straight
    .trim();
}

export function normalizeForLookup(text: string): string {
  return sanitizeText(text).toLowerCase().trim();
}

