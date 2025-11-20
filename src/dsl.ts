/**
 * Sales Navigator DSL construction and URL encoding
 */

import type { MatchedValue, FreeTextValue } from "./types.js";

/**
 * Build a facet block for ID-based facets
 * 
 * CRITICAL: REGION facets ONLY include id (no text, no selectionType)
 * Other facets include id and selectionType
 * 
 * Example FUNCTION: (type:FUNCTION,values:List((id:25,selectionType:INCLUDED)))
 * Example REGION: (type:REGION,values:List((id:102277331)))
 */
export function facetBlockIdBased(
  type: string,
  values: MatchedValue[]
): string {
  if (values.length === 0) return "";

  const valueStrings = values.map((v) => {
    // REGION facets: ONLY id field (per spec)
    if (type === "REGION") {
      return `(id:${v.id})`;
    }
    
    // All other facets: id + selectionType
    const selectionType = v.selectionType || "INCLUDED";
    return `(id:${v.id},selectionType:${selectionType})`;
  });

  return `(type:${type},values:List(${valueStrings.join(",")}))`;
}

/**
 * Build a facet block for text-based facets (like TITLE)
 * Example: (type:TITLE,values:List((text:Account Executive,match:EXACT)))
 */
export function facetBlockTextBased(
  type: string,
  values: FreeTextValue[]
): string {
  if (values.length === 0) return "";

  const valueStrings = values.map((v) => {
    return `(text:${v.text},match:${v.match})`;
  });

  return `(type:${type},values:List(${valueStrings.join(",")}))`;
}

/**
 * Build the complete filters DSL
 * Example: (filters:List((type:FUNCTION,...),(type:INDUSTRY,...)))
 */
export function buildFilters(blocks: string[]): string {
  const validBlocks = blocks.filter((b) => b.length > 0);
  if (validBlocks.length === 0) {
    return "";
  }
  return `(filters:List(${validBlocks.join(",")}))`;
}

/**
 * Build the complete Sales Navigator People search URL
 * 
 * ENCODING PROTOCOL (per spec):
 * This function performs STEP 3: Outer-encode the entire DSL
 * (Keywords were already inner-encoded in buildDslFromMatches)
 * 
 * Result: Double-encoded keywords
 * - Raw keyword: "Sales Development"
 * - After inner encode: "Sales%20Development"
 * - After outer encode: "Sales%2520Development" (in final URL)
 * 
 * Note: encodeURIComponent doesn't encode (), so we manually encode them
 */
export function buildPeopleSearchUrl(dsl: string): string {
  const baseUrl = "https://www.linkedin.com/sales/search/people";
  
  if (!dsl) {
    return `${baseUrl}?viewAllFilters=true`;
  }

  // STEP 3: Outer-encode entire DSL string (including already inner-encoded keywords)
  // encodeURIComponent doesn't encode parentheses, so we manually encode them
  const encodedDsl = encodeURIComponent(dsl)
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29');
  
  return `${baseUrl}?query=${encodedDsl}&viewAllFilters=true`;
}

/**
 * Decode a Sales Navigator query string
 * Reverses the encoding to extract the original DSL
 */
export function decodeQuery(encodedQuery: string): string {
  return decodeURIComponent(encodedQuery);
}

/**
 * DEPRECATED: Use buildPeopleSearchUrl directly instead
 * Kept for backward compatibility
 */
export function encodeQuery(dsl: string): string {
  return dsl;
}

/**
 * Helper: Build DSL from matched values
 */
export function buildDslFromMatches(matches: {
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
  PERSONA?: MatchedValue[];
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
}): string {
  // Handle keyword search - special case that modifies the entire query structure
  if (matches.KEYWORD && matches.KEYWORD.length > 0) {
    // Keywords create a different DSL structure: (spellCorrectionEnabled:true,keywords:encoded_keywords,filters:...)
    // CRITICAL ENCODING PROTOCOL (per spec):
    // 1. Inner-encode keywords first (this step)
    // 2. Embed inner-encoded keywords into raw DSL
    // 3. Outer-encode entire DSL in buildPeopleSearchUrl()
    // Result: spaces become %2520 in final URL (inner %20 → outer %2520)
    // 
    // NOTE: If multiple Keyword: lines exist, they are joined with space.
    // Future enhancement: Consider using AND/OR logic if multiple keyword lines have different semantics.
    const keywordsRaw = matches.KEYWORD.join(' ');
    const keywordsEncoded = encodeURIComponent(keywordsRaw); // STEP 1: Inner-encode keywords
    const filtersPart = buildDslFromMatchesWithoutKeywords(matches);
    
    // If there are no filters, just return the keyword query
    if (!filtersPart) {
      return `(spellCorrectionEnabled:true,keywords:${keywordsEncoded})`;
    }
    
    // Otherwise, combine keywords with filters
    // Remove leading '(' from filtersPart if present (filtersPart always starts with '(' when non-empty)
    const filtersWithoutParen = filtersPart.startsWith('(') 
      ? filtersPart.substring(1) 
      : filtersPart;
    
    return `(spellCorrectionEnabled:true,keywords:${keywordsEncoded},${filtersWithoutParen})`;
  }
  
  // Normal flow without keywords
  return buildDslFromMatchesWithoutKeywords(matches);
}

/**
 * Internal helper to build DSL from matched values without keyword handling
 * 
 * Facets are assembled in a predictable order per spec:
 * 1. TITLE
 * 2. FUNCTION
 * 3. REGION
 * 4. SENIORITY_LEVEL
 * 5. COMPANY_TYPE
 * 6. COMPANY_HEADCOUNT
 * 7. YEARS_OF_EXPERIENCE
 * 8. INDUSTRY
 * 9. Other supported facets (alphabetical)
 */
function buildDslFromMatchesWithoutKeywords(matches: any): string {
  const blocks: string[] = [];

  // 1. TITLE (text-based facet)
  if (matches.TITLE && matches.TITLE.length > 0) {
    blocks.push(facetBlockTextBased("TITLE", matches.TITLE));
  }

  // 2. FUNCTION
  if (matches.FUNCTION && matches.FUNCTION.length > 0) {
    blocks.push(facetBlockIdBased("FUNCTION", matches.FUNCTION));
  }

  // 3. REGION
  if (matches.REGION && matches.REGION.length > 0) {
    blocks.push(facetBlockIdBased("REGION", matches.REGION));
  }

  // 4. SENIORITY_LEVEL
  if (matches.SENIORITY_LEVEL && matches.SENIORITY_LEVEL.length > 0) {
    blocks.push(facetBlockIdBased("SENIORITY_LEVEL", matches.SENIORITY_LEVEL));
  }

  // 5. COMPANY_TYPE
  if (matches.COMPANY_TYPE && matches.COMPANY_TYPE.length > 0) {
    blocks.push(facetBlockIdBased("COMPANY_TYPE", matches.COMPANY_TYPE));
  }

  // 6. COMPANY_HEADCOUNT
  if (matches.COMPANY_HEADCOUNT && matches.COMPANY_HEADCOUNT.length > 0) {
    blocks.push(facetBlockIdBased("COMPANY_HEADCOUNT", matches.COMPANY_HEADCOUNT));
  }

  // 7. YEARS_OF_EXPERIENCE
  if (matches.YEARS_OF_EXPERIENCE && matches.YEARS_OF_EXPERIENCE.length > 0) {
    blocks.push(facetBlockIdBased("YEARS_OF_EXPERIENCE", matches.YEARS_OF_EXPERIENCE));
  }

  // 8. INDUSTRY
  if (matches.INDUSTRY && matches.INDUSTRY.length > 0) {
    blocks.push(facetBlockIdBased("INDUSTRY", matches.INDUSTRY));
  }

  // Other supported facets (alphabetical order for consistency)
  if (matches.COMPANY_HEADQUARTERS && matches.COMPANY_HEADQUARTERS.length > 0) {
    blocks.push(facetBlockIdBased("COMPANY_HEADQUARTERS", matches.COMPANY_HEADQUARTERS));
  }
  if (matches.CONNECTION_OF && matches.CONNECTION_OF.length > 0) {
    blocks.push(facetBlockIdBased("CONNECTION_OF", matches.CONNECTION_OF));
  }
  if (matches.CURRENT_COMPANY && matches.CURRENT_COMPANY.length > 0) {
    blocks.push(facetBlockIdBased("CURRENT_COMPANY", matches.CURRENT_COMPANY));
  }
  if (matches.CURRENT_TITLE && matches.CURRENT_TITLE.length > 0) {
    blocks.push(facetBlockIdBased("CURRENT_TITLE", matches.CURRENT_TITLE));
  }
  if (matches.FOLLOWS_YOUR_COMPANY && matches.FOLLOWS_YOUR_COMPANY.length > 0) {
    blocks.push(facetBlockIdBased("FOLLOWS_YOUR_COMPANY", matches.FOLLOWS_YOUR_COMPANY));
  }
  if (matches.GEOGRAPHY && matches.GEOGRAPHY.length > 0) {
    blocks.push(facetBlockIdBased("GEOGRAPHY", matches.GEOGRAPHY));
  }
  if (matches.GROUP && matches.GROUP.length > 0) {
    blocks.push(facetBlockIdBased("GROUP", matches.GROUP));
  }
  if (matches.LEAD_INTERACTIONS && matches.LEAD_INTERACTIONS.length > 0) {
    blocks.push(facetBlockIdBased("LEAD_INTERACTIONS", matches.LEAD_INTERACTIONS));
  }
  if (matches.PAST_COLLEAGUE && matches.PAST_COLLEAGUE.length > 0) {
    blocks.push(facetBlockIdBased("PAST_COLLEAGUE", matches.PAST_COLLEAGUE));
  }
  if (matches.PAST_COMPANY && matches.PAST_COMPANY.length > 0) {
    blocks.push(facetBlockIdBased("PAST_COMPANY", matches.PAST_COMPANY));
  }
  if (matches.POSTED_ON_LINKEDIN && matches.POSTED_ON_LINKEDIN.length > 0) {
    blocks.push(facetBlockIdBased("POSTED_ON_LINKEDIN", matches.POSTED_ON_LINKEDIN));
  }
  if (matches.RECENTLY_CHANGED_JOBS && matches.RECENTLY_CHANGED_JOBS.length > 0) {
    blocks.push(facetBlockIdBased("RECENTLY_CHANGED_JOBS", matches.RECENTLY_CHANGED_JOBS));
  }
  if (matches.SCHOOL && matches.SCHOOL.length > 0) {
    blocks.push(facetBlockIdBased("SCHOOL", matches.SCHOOL));
  }
  if (matches.VIEWED_YOUR_PROFILE && matches.VIEWED_YOUR_PROFILE.length > 0) {
    blocks.push(facetBlockIdBased("VIEWED_YOUR_PROFILE", matches.VIEWED_YOUR_PROFILE));
  }
  if (matches.WITH_SHARED_EXPERIENCES && matches.WITH_SHARED_EXPERIENCES.length > 0) {
    blocks.push(facetBlockIdBased("WITH_SHARED_EXPERIENCES", matches.WITH_SHARED_EXPERIENCES));
  }
  if (matches.YEARS_AT_CURRENT_COMPANY && matches.YEARS_AT_CURRENT_COMPANY.length > 0) {
    blocks.push(facetBlockIdBased("YEARS_AT_CURRENT_COMPANY", matches.YEARS_AT_CURRENT_COMPANY));
  }
  if (matches.YEARS_IN_CURRENT_POSITION && matches.YEARS_IN_CURRENT_POSITION.length > 0) {
    blocks.push(facetBlockIdBased("YEARS_IN_CURRENT_POSITION", matches.YEARS_IN_CURRENT_POSITION));
  }

  // PERSONA facet is NOT supported (per spec) and is omitted

  return buildFilters(blocks);
}

