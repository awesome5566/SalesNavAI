/**
 * Sales Navigator DSL construction and URL encoding
 */

import type { MatchedValue, FreeTextValue } from "./types.js";

/**
 * Build a facet block for ID-based facets
 * Example: (type:FUNCTION,values:List((id:25,text:Sales,selectionType:INCLUDED)))
 */
export function facetBlockIdBased(
  type: string,
  values: MatchedValue[]
): string {
  if (values.length === 0) return "";

  const valueStrings = values.map((v) => {
    const selectionType = v.selectionType || "INCLUDED";
    return `(id:${v.id},text:${v.text},selectionType:${selectionType})`;
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
    return "(filters:List())";
  }
  return `(filters:List(${validBlocks.join(",")}))`;
}

/**
 * Encode the DSL query for URL
 * Uses encodeURIComponent for proper URL encoding
 */
export function encodeQuery(dsl: string): string {
  return encodeURIComponent(dsl);
}

/**
 * Build the complete Sales Navigator People search URL
 */
export function buildPeopleSearchUrl(encodedQuery: string): string {
  return `https://www.linkedin.com/sales/search/people?query=${encodedQuery}&viewAllFilters=true`;
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
}): string {
  const blocks: string[] = [];

  // ID-based facets
  if (matches.FUNCTION && matches.FUNCTION.length > 0) {
    blocks.push(facetBlockIdBased("FUNCTION", matches.FUNCTION));
  }
  if (matches.INDUSTRY && matches.INDUSTRY.length > 0) {
    blocks.push(facetBlockIdBased("INDUSTRY", matches.INDUSTRY));
  }
  if (matches.REGION && matches.REGION.length > 0) {
    blocks.push(facetBlockIdBased("REGION", matches.REGION));
  }
  if (matches.GEOGRAPHY && matches.GEOGRAPHY.length > 0) {
    blocks.push(facetBlockIdBased("GEOGRAPHY", matches.GEOGRAPHY));
  }
  if (matches.SENIORITY_LEVEL && matches.SENIORITY_LEVEL.length > 0) {
    blocks.push(facetBlockIdBased("SENIORITY_LEVEL", matches.SENIORITY_LEVEL));
  }
  if (matches.CURRENT_COMPANY && matches.CURRENT_COMPANY.length > 0) {
    blocks.push(facetBlockIdBased("CURRENT_COMPANY", matches.CURRENT_COMPANY));
  }
  if (matches.PAST_COMPANY && matches.PAST_COMPANY.length > 0) {
    blocks.push(facetBlockIdBased("PAST_COMPANY", matches.PAST_COMPANY));
  }
  if (matches.SCHOOL && matches.SCHOOL.length > 0) {
    blocks.push(facetBlockIdBased("SCHOOL", matches.SCHOOL));
  }
  if (matches.COMPANY_TYPE && matches.COMPANY_TYPE.length > 0) {
    blocks.push(facetBlockIdBased("COMPANY_TYPE", matches.COMPANY_TYPE));
  }
  if (matches.COMPANY_HEADCOUNT && matches.COMPANY_HEADCOUNT.length > 0) {
    blocks.push(facetBlockIdBased("COMPANY_HEADCOUNT", matches.COMPANY_HEADCOUNT));
  }
  if (matches.COMPANY_HEADQUARTERS && matches.COMPANY_HEADQUARTERS.length > 0) {
    blocks.push(facetBlockIdBased("COMPANY_HEADQUARTERS", matches.COMPANY_HEADQUARTERS));
  }
  if (matches.YEARS_OF_EXPERIENCE && matches.YEARS_OF_EXPERIENCE.length > 0) {
    blocks.push(facetBlockIdBased("YEARS_OF_EXPERIENCE", matches.YEARS_OF_EXPERIENCE));
  }
  if (matches.PERSONA && matches.PERSONA.length > 0) {
    blocks.push(facetBlockIdBased("PERSONA", matches.PERSONA));
  }

  // Text-based facets
  if (matches.TITLE && matches.TITLE.length > 0) {
    blocks.push(facetBlockTextBased("TITLE", matches.TITLE));
  }

  return buildFilters(blocks);
}

