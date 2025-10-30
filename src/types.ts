/**
 * Type definitions for Sales Navigator URL Generator
 */

// Facet match types
export type MatchType = "CONTAINS" | "EXACT";
export type SelectionType = "INCLUDED" | "EXCLUDED";

// Facet index for bi-directional lookups
export interface FacetIndex {
  byId: Map<number | string, string>;
  byText: Map<string, number | string>;
}

// Free-text facet (like TITLE)
export interface FreeTextValue {
  text: string;
  match: MatchType;
}

// Known facet types
export type FacetName =
  | "FUNCTION"
  | "INDUSTRY"
  | "REGION"
  | "GEOGRAPHY"
  | "SENIORITY_LEVEL"
  | "COMPANY_TYPE"
  | "COMPANY_HEADCOUNT"
  | "COMPANY_HEADQUARTERS"
  | "CURRENT_COMPANY"
  | "PAST_COMPANY"
  | "SCHOOL"
  | "YEARS_OF_EXPERIENCE"
  | "PROFILE_LANGUAGE"
  | "RELATIONSHIP"
  | "PERSONA"
  | "POSTAL_CODE"
  | "TITLE"
  | "FIRST_NAME"
  | "LAST_NAME"
  | "CURRENT_TITLE"
  | "YEARS_AT_CURRENT_COMPANY"
  | "YEARS_IN_CURRENT_POSITION"
  | "GROUP"
  | "FOLLOWS_YOUR_COMPANY"
  | "VIEWED_YOUR_PROFILE"
  | "CONNECTION_OF"
  | "PAST_COLLEAGUE"
  | "WITH_SHARED_EXPERIENCES"
  | "RECENTLY_CHANGED_JOBS"
  | "POSTED_ON_LINKEDIN"
  | "LEAD_INTERACTIONS"
  | "KEYWORD";

// Normalized facet store
export type NormalizedFacetStore = Record<FacetName, FacetIndex>;

// Raw format from JSON files
export interface RawFacetData {
  ids: Array<{ id: number; text: string }>;
  texts: Array<{
    text: string;
    records: Array<{
      text: string;
      match: string | null;
      selectionType: string;
      scope: string | null;
      operator: string | null;
    }>;
  }>;
}

// Matched facet value
export interface MatchedValue {
  id?: number | string;
  text: string;
  match?: MatchType;
  selectionType?: SelectionType;
}

// Result from NLP matching
export interface NLPMatches {
  FUNCTION: MatchedValue[];
  INDUSTRY: MatchedValue[];
  REGION: MatchedValue[];
  GEOGRAPHY: MatchedValue[];
  SENIORITY_LEVEL: MatchedValue[];
  TITLE: FreeTextValue[];
  CURRENT_COMPANY: MatchedValue[];
  PAST_COMPANY: MatchedValue[];
  SCHOOL: MatchedValue[];
  COMPANY_TYPE: MatchedValue[];
  COMPANY_HEADCOUNT: MatchedValue[];
  COMPANY_HEADQUARTERS: MatchedValue[];
  YEARS_OF_EXPERIENCE: MatchedValue[];
  PERSONA: MatchedValue[];
  CURRENT_TITLE: MatchedValue[];
  YEARS_AT_CURRENT_COMPANY: MatchedValue[];
  YEARS_IN_CURRENT_POSITION: MatchedValue[];
  GROUP: MatchedValue[];
  FOLLOWS_YOUR_COMPANY: MatchedValue[];
  VIEWED_YOUR_PROFILE: MatchedValue[];
  CONNECTION_OF: MatchedValue[];
  PAST_COLLEAGUE: MatchedValue[];
  WITH_SHARED_EXPERIENCES: MatchedValue[];
  RECENTLY_CHANGED_JOBS: MatchedValue[];
  POSTED_ON_LINKEDIN: MatchedValue[];
  LEAD_INTERACTIONS: MatchedValue[];
  KEYWORD: string[];
}

// URL generation options
export interface GeneratorOptions {
  resolveCompanies?: string[];
  resolveSchools?: string[];
  debug?: boolean;
  silent?: boolean; // Suppress console output (for JSON mode)
}

// URL generation result
export interface GeneratorResult {
  url: string;
  dslDecoded: string;
  matched: Partial<NLPMatches>;
  warnings: string[];
}

