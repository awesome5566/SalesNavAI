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
  if (matches.CURRENT_TITLE && matches.CURRENT_TITLE.length > 0) {
    blocks.push(facetBlockIdBased("CURRENT_TITLE", matches.CURRENT_TITLE));
  }
  if (matches.YEARS_AT_CURRENT_COMPANY && matches.YEARS_AT_CURRENT_COMPANY.length > 0) {
    blocks.push(facetBlockIdBased("YEARS_AT_CURRENT_COMPANY", matches.YEARS_AT_CURRENT_COMPANY));
  }
  if (matches.YEARS_IN_CURRENT_POSITION && matches.YEARS_IN_CURRENT_POSITION.length > 0) {
    blocks.push(facetBlockIdBased("YEARS_IN_CURRENT_POSITION", matches.YEARS_IN_CURRENT_POSITION));
  }
  if (matches.GROUP && matches.GROUP.length > 0) {
    blocks.push(facetBlockIdBased("GROUP", matches.GROUP));
  }
  if (matches.FOLLOWS_YOUR_COMPANY && matches.FOLLOWS_YOUR_COMPANY.length > 0) {
    blocks.push(facetBlockIdBased("FOLLOWS_YOUR_COMPANY", matches.FOLLOWS_YOUR_COMPANY));
  }
  if (matches.VIEWED_YOUR_PROFILE && matches.VIEWED_YOUR_PROFILE.length > 0) {
    blocks.push(facetBlockIdBased("VIEWED_YOUR_PROFILE", matches.VIEWED_YOUR_PROFILE));
  }
  if (matches.CONNECTION_OF && matches.CONNECTION_OF.length > 0) {
    blocks.push(facetBlockIdBased("CONNECTION_OF", matches.CONNECTION_OF));
  }
  if (matches.PAST_COLLEAGUE && matches.PAST_COLLEAGUE.length > 0) {
    blocks.push(facetBlockIdBased("PAST_COLLEAGUE", matches.PAST_COLLEAGUE));
  }
  if (matches.WITH_SHARED_EXPERIENCES && matches.WITH_SHARED_EXPERIENCES.length > 0) {
    blocks.push(facetBlockIdBased("WITH_SHARED_EXPERIENCES", matches.WITH_SHARED_EXPERIENCES));
  }
  if (matches.RECENTLY_CHANGED_JOBS && matches.RECENTLY_CHANGED_JOBS.length > 0) {
    blocks.push(facetBlockIdBased("RECENTLY_CHANGED_JOBS", matches.RECENTLY_CHANGED_JOBS));
  }
  if (matches.POSTED_ON_LINKEDIN && matches.POSTED_ON_LINKEDIN.length > 0) {
    blocks.push(facetBlockIdBased("POSTED_ON_LINKEDIN", matches.POSTED_ON_LINKEDIN));
  }
  if (matches.LEAD_INTERACTIONS && matches.LEAD_INTERACTIONS.length > 0) {
    blocks.push(facetBlockIdBased("LEAD_INTERACTIONS", matches.LEAD_INTERACTIONS));
  }

  // Text-based facets
  if (matches.TITLE && matches.TITLE.length > 0) {
    blocks.push(facetBlockTextBased("TITLE", matches.TITLE));
  }

  return buildFilters(blocks);
}

