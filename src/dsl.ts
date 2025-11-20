/**
 * Sales Navigator DSL construction and URL encoding
 */

import type { MatchedValue, FreeTextValue } from "./types.js";

/**
 * Simple parenthesis balance check.
 */
function isBalanced(s: string): boolean {
  let depth = 0;
  for (const ch of s) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (depth < 0) return false;
  }
  return depth === 0;
}

/**
 * Best-effort automatic parenthesis fixer.
 * - If more opens than closes → append closing parens.
 * - If more closes than opens → strip closing parens from the end.
 */
function autoFixParens(s: string): string {
  let open = 0;
  let close = 0;
  for (const ch of s) {
    if (ch === "(") open++;
    else if (ch === ")") close++;
  }

  if (open === close) return s;

  if (open > close) {
    return s + ")".repeat(open - close);
  }

  // close > open: trim extra ')' from the end
  let toDrop = close - open;
  const chars = s.split("");
  for (let i = chars.length - 1; i >= 0 && toDrop > 0; i--) {
    if (chars[i] === ")") {
      chars[i] = "";
      toDrop--;
    }
  }
  return chars.join("");
}

/**
 * Normalize and ensure DSL has balanced parentheses.
 */
function ensureBalancedDsl(dsl: string): string {
  const trimmed = dsl.trim();
  if (!trimmed) return trimmed;
  if (isBalanced(trimmed)) return trimmed;
  return autoFixParens(trimmed);
}

/**
 * Build a facet block for ID-based facets.
 *
 * CRITICAL: REGION facets ONLY include id (no text, no selectionType)
 * Other facets include id and selectionType.
 *
 * Example FUNCTION: (type:FUNCTION,values:List((id:25,selectionType:INCLUDED)))
 * Example REGION:   (type:REGION,values:List((id:102277331)))
 */
export function facetBlockIdBased(
  type: string,
  values: MatchedValue[]
): string {
  if (!values || values.length === 0) return "";

  const valueStrings = values
    .filter((v) => v && v.id !== undefined && v.id !== null)
    .map((v) => {
      if (type === "REGION") {
        // REGION: ID only
        return `(id:${v.id})`;
      }
      const selectionType = v.selectionType || "INCLUDED";
      return `(id:${v.id},selectionType:${selectionType})`;
    });

  if (valueStrings.length === 0) return "";
  return `(type:${type},values:List(${valueStrings.join(",")}))`;
}

/**
 * Build a facet block for text-based facets (like TITLE).
 * Example: (type:TITLE,values:List((text:Account Executive,match:EXACT)))
 */
export function facetBlockTextBased(
  type: string,
  values: FreeTextValue[]
): string {
  if (!values || values.length === 0) return "";

  const valueStrings = values
    .filter((v) => v && v.text)
    .map((v) => `(text:${v.text},match:${v.match})`);

  if (valueStrings.length === 0) return "";
  return `(type:${type},values:List(${valueStrings.join(",")}))`;
}

/**
 * Build the complete filters DSL *body*.
 *
 * IMPORTANT: This returns just:
 *   filters:List((type:FUNCTION,...),(type:INDUSTRY,...))
 * WITHOUT outer parentheses, so the caller can embed it cleanly as:
 *   (spellCorrectionEnabled:true,keywords:...,filters:List(...))
 */
export function buildFilters(blocks: string[]): string {
  const validBlocks = blocks.filter((b) => b && b.length > 0);
  if (validBlocks.length === 0) {
    return "";
  }
  return `filters:List(${validBlocks.join(",")})`;
}

/**
 * Build the complete Sales Navigator People search URL.
 *
 * ENCODING PROTOCOL:
 * - Keywords are already inner-encoded in buildDslFromMatches().
 * - Here we OUTER-ENCODE the entire DSL using encodeURIComponent.
 */
export function buildPeopleSearchUrl(dsl: string): string {
  const baseUrl = "https://www.linkedin.com/sales/search/people";

  const normalized = ensureBalancedDsl(dsl || "");
  if (!normalized) {
    // No DSL: just open the page with all filters.
    return `${baseUrl}?viewAllFilters=true`;
  }

  const encodedDsl = encodeURIComponent(normalized);
  return `${baseUrl}?query=${encodedDsl}&viewAllFilters=true`;
}

/**
 * Decode a Sales Navigator query string.
 * Reverses the encoding to extract the original DSL.
 */
export function decodeQuery(encodedQuery: string): string {
  return decodeURIComponent(encodedQuery);
}

/**
 * DEPRECATED: Use buildPeopleSearchUrl directly instead.
 * Kept for backward compatibility.
 */
export function encodeQuery(dsl: string): string {
  return dsl;
}

/**
 * Helper: normalize keyword array into a single Boolean string.
 * The upstream pipeline should usually provide a single Boolean string
 * in KEYWORD[0]; if multiple entries exist, we join them with spaces.
 */
function buildKeywordRaw(keywords: string[]): string {
  return keywords
    .map((k) => (k ?? "").trim())
    .filter((k) => k.length > 0)
    .join(" ");
}

/**
 * Helper: Build DSL from matched values.
 *
 * NEW: rawUserQuery is required so we can:
 * - Guarantee we never return an empty DSL for a non-empty user query.
 * - Always populate KEYWORD for non-empty user input.
 */
export function buildDslFromMatches(
  matches: {
    FUNCTION?: MatchedValue[];
    INDUSTRY?: MatchedValue[];
    REGION?: MatchedValue[];
    GEOGRAPHY?: MatchedValue[];
    SENIORITY_LEVEL?: MatchedValue[];
    TITLE?: FreeTextValue[];
    CURRENT_COMPANY?: MatchedValue[];
    PAST_COMPANY?: MatchedValue[];
    SCHOOL?: MatchedValue[];
    COMPANY_TYPE?: MatchedValue[];
    COMPANY_HEADCOUNT?: MatchedValue[];
    COMPANY_HEADQUARTERS?: MatchedValue[];
    YEARS_OF_EXPERIENCE?: MatchedValue[];
    PERSONA?: MatchedValue[]; // intentionally ignored when building DSL
    CURRENT_TITLE?: MatchedValue[];
    YEARS_AT_CURRENT_COMPANY?: MatchedValue[];
    YEARS_IN_CURRENT_POSITION?: MatchedValue[];
    GROUP?: MatchedValue[];
    FOLLOWS_YOUR_COMPANY?: MatchedValue[];
    VIEWED_YOUR_PROFILE?: MatchedValue[];
    CONNECTION_OF?: MatchedValue[];
    PAST_COLLEAGUE?: MatchedValue[];
    WITH_SHARED_EXPERIENCES?: MatchedValue[];
    RECENTLY_CHANGED_JOBS?: MatchedValue[];
    POSTED_ON_LINKEDIN?: MatchedValue[];
    LEAD_INTERACTIONS?: MatchedValue[];
    KEYWORD?: string[];
  },
  rawUserQuery: string
): string {
  const trimmedQuery = (rawUserQuery ?? "").trim();
  const hasUserQuery = trimmedQuery.length > 0;

  // Shallow clone so we can mutate KEYWORD safely
  const localMatches = { ...matches };

  // Ensure KEYWORD is always populated when the user query is non-empty.
  if ((!localMatches.KEYWORD || localMatches.KEYWORD.length === 0) && hasUserQuery) {
    localMatches.KEYWORD = [trimmedQuery];
  }

  const hasKeywords =
    Array.isArray(localMatches.KEYWORD) &&
    localMatches.KEYWORD.some((k) => k && k.trim().length > 0);

  if (hasKeywords) {
    // KEYWORDS path: we build full DSL:
    // (spellCorrectionEnabled:true,keywords:<innerEncoded>,filters:List(...))
    const keywordsRaw = buildKeywordRaw(localMatches.KEYWORD!);
    const keywordsEncoded = encodeURIComponent(keywordsRaw); // inner-encode

    const filtersPart = buildDslFromMatchesWithoutKeywords(localMatches);
    if (!filtersPart) {
      // No filters, just keywords.
      const dsl = `(spellCorrectionEnabled:true,keywords:${keywordsEncoded})`;
      return ensureBalancedDsl(dsl);
    }

    const dsl = `(spellCorrectionEnabled:true,keywords:${keywordsEncoded},${filtersPart})`;
    return ensureBalancedDsl(dsl);
  }

  // No KEYWORD but also no user query: fall back to pure filters (if any).
  const filtersOnlyDsl = buildDslFromMatchesWithoutKeywords(localMatches);
  if (filtersOnlyDsl) {
    return ensureBalancedDsl(filtersOnlyDsl);
  }

  // Worst-case safety: no filters and no keyword data.
  // Avoid returning an empty DSL: fall back to a generic keyword if user query exists.
  if (hasUserQuery) {
    const fallbackEncoded = encodeURIComponent(trimmedQuery);
    const dsl = `(spellCorrectionEnabled:true,keywords:${fallbackEncoded})`;
    return ensureBalancedDsl(dsl);
  }

  // Truly empty input (no user query, no matches).
  return "";
}

/**
 * Internal helper to build DSL from matched values without keyword handling.
 *
 * Facets are assembled in a predictable order:
 * 1. TITLE
 * 2. FUNCTION
 * 3. REGION
 * 4. SENIORITY_LEVEL
 * 5. COMPANY_TYPE
 * 6. COMPANY_HEADCOUNT
 * 7. YEARS_OF_EXPERIENCE
 * 8. INDUSTRY
 * 9. Other supported facets (alphabetical-ish for consistency)
 *
 * This returns either:
 *   (filters:List(...))
 * or the empty string "" if no facets exist.
 */
function buildDslFromMatchesWithoutKeywords(matches: any): string {
  const blocks: string[] = [];

  // 1. TITLE (text-based facet)
  if (matches.TITLE && matches.TITLE.length > 0) {
    const block = facetBlockTextBased("TITLE", matches.TITLE);
    if (block) blocks.push(block);
  }

  // 2. FUNCTION
  if (matches.FUNCTION && matches.FUNCTION.length > 0) {
    const block = facetBlockIdBased("FUNCTION", matches.FUNCTION);
    if (block) blocks.push(block);
  }

  // 3. REGION
  if (matches.REGION && matches.REGION.length > 0) {
    const block = facetBlockIdBased("REGION", matches.REGION);
    if (block) blocks.push(block);
  }

  // 4. SENIORITY_LEVEL
  if (matches.SENIORITY_LEVEL && matches.SENIORITY_LEVEL.length > 0) {
    const block = facetBlockIdBased("SENIORITY_LEVEL", matches.SENIORITY_LEVEL);
    if (block) blocks.push(block);
  }

  // 5. COMPANY_TYPE
  if (matches.COMPANY_TYPE && matches.COMPANY_TYPE.length > 0) {
    const block = facetBlockIdBased("COMPANY_TYPE", matches.COMPANY_TYPE);
    if (block) blocks.push(block);
  }

  // 6. COMPANY_HEADCOUNT
  if (matches.COMPANY_HEADCOUNT && matches.COMPANY_HEADCOUNT.length > 0) {
    const block = facetBlockIdBased("COMPANY_HEADCOUNT", matches.COMPANY_HEADCOUNT);
    if (block) blocks.push(block);
  }

  // 7. YEARS_OF_EXPERIENCE
  if (matches.YEARS_OF_EXPERIENCE && matches.YEARS_OF_EXPERIENCE.length > 0) {
    const block = facetBlockIdBased("YEARS_OF_EXPERIENCE", matches.YEARS_OF_EXPERIENCE);
    if (block) blocks.push(block);
  }

  // 8. INDUSTRY
  if (matches.INDUSTRY && matches.INDUSTRY.length > 0) {
    const block = facetBlockIdBased("INDUSTRY", matches.INDUSTRY);
    if (block) blocks.push(block);
  }

  // 9. Other supported facets (kept, but PERSONA intentionally omitted)
  if (matches.COMPANY_HEADQUARTERS && matches.COMPANY_HEADQUARTERS.length > 0) {
    const block = facetBlockIdBased("COMPANY_HEADQUARTERS", matches.COMPANY_HEADQUARTERS);
    if (block) blocks.push(block);
  }
  if (matches.CONNECTION_OF && matches.CONNECTION_OF.length > 0) {
    const block = facetBlockIdBased("CONNECTION_OF", matches.CONNECTION_OF);
    if (block) blocks.push(block);
  }
  if (matches.CURRENT_COMPANY && matches.CURRENT_COMPANY.length > 0) {
    const block = facetBlockIdBased("CURRENT_COMPANY", matches.CURRENT_COMPANY);
    if (block) blocks.push(block);
  }
  if (matches.CURRENT_TITLE && matches.CURRENT_TITLE.length > 0) {
    const block = facetBlockIdBased("CURRENT_TITLE", matches.CURRENT_TITLE);
    if (block) blocks.push(block);
  }
  if (matches.FOLLOWS_YOUR_COMPANY && matches.FOLLOWS_YOUR_COMPANY.length > 0) {
    const block = facetBlockIdBased("FOLLOWS_YOUR_COMPANY", matches.FOLLOWS_YOUR_COMPANY);
    if (block) blocks.push(block);
  }
  if (matches.GEOGRAPHY && matches.GEOGRAPHY.length > 0) {
    const block = facetBlockIdBased("GEOGRAPHY", matches.GEOGRAPHY);
    if (block) blocks.push(block);
  }
  if (matches.GROUP && matches.GROUP.length > 0) {
    const block = facetBlockIdBased("GROUP", matches.GROUP);
    if (block) blocks.push(block);
  }
  if (matches.LEAD_INTERACTIONS && matches.LEAD_INTERACTIONS.length > 0) {
    const block = facetBlockIdBased("LEAD_INTERACTIONS", matches.LEAD_INTERACTIONS);
    if (block) blocks.push(block);
  }
  if (matches.PAST_COLLEAGUE && matches.PAST_COLLEAGUE.length > 0) {
    const block = facetBlockIdBased("PAST_COLLEAGUE", matches.PAST_COLLEAGUE);
    if (block) blocks.push(block);
  }
  if (matches.PAST_COMPANY && matches.PAST_COMPANY.length > 0) {
    const block = facetBlockIdBased("PAST_COMPANY", matches.PAST_COMPANY);
    if (block) blocks.push(block);
  }
  if (matches.POSTED_ON_LINKEDIN && matches.POSTED_ON_LINKEDIN.length > 0) {
    const block = facetBlockIdBased("POSTED_ON_LINKEDIN", matches.POSTED_ON_LINKEDIN);
    if (block) blocks.push(block);
  }
  if (matches.RECENTLY_CHANGED_JOBS && matches.RECENTLY_CHANGED_JOBS.length > 0) {
    const block = facetBlockIdBased("RECENTLY_CHANGED_JOBS", matches.RECENTLY_CHANGED_JOBS);
    if (block) blocks.push(block);
  }
  if (matches.SCHOOL && matches.SCHOOL.length > 0) {
    const block = facetBlockIdBased("SCHOOL", matches.SCHOOL);
    if (block) blocks.push(block);
  }
  if (matches.VIEWED_YOUR_PROFILE && matches.VIEWED_YOUR_PROFILE.length > 0) {
    const block = facetBlockIdBased("VIEWED_YOUR_PROFILE", matches.VIEWED_YOUR_PROFILE);
    if (block) blocks.push(block);
  }
  if (matches.WITH_SHARED_EXPERIENCES && matches.WITH_SHARED_EXPERIENCES.length > 0) {
    const block = facetBlockIdBased("WITH_SHARED_EXPERIENCES", matches.WITH_SHARED_EXPERIENCES);
    if (block) blocks.push(block);
  }
  if (matches.YEARS_AT_CURRENT_COMPANY && matches.YEARS_AT_CURRENT_COMPANY.length > 0) {
    const block = facetBlockIdBased("YEARS_AT_CURRENT_COMPANY", matches.YEARS_AT_CURRENT_COMPANY);
    if (block) blocks.push(block);
  }
  if (matches.YEARS_IN_CURRENT_POSITION && matches.YEARS_IN_CURRENT_POSITION.length > 0) {
    const block = facetBlockIdBased("YEARS_IN_CURRENT_POSITION", matches.YEARS_IN_CURRENT_POSITION);
    if (block) blocks.push(block);
  }

  const filtersBody = buildFilters(blocks);
  if (!filtersBody) return "";

  // Wrap filters body with outer parentheses:
  // (filters:List(...))
  return `(${filtersBody})`;
}
