/**
 * Facet Allowlists - Known-good IDs for validation
 * 
 * These allowlists ensure that only valid, verified IDs are included in generated URLs.
 * IDs not in these lists will be dropped during validation with warnings.
 */

/**
 * SENIORITY_LEVEL facet allowlist
 * Source: facet-store.json SENIORITY_LEVEL section
 */
export const SENIORITY_LEVEL_ALLOWLIST = new Set<number | string>([
  100,  // In Training
  110,  // Entry Level
  120,  // Senior
  130,  // Strategic
  200,  // Entry Level Manager
  210,  // Experienced Manager
  220,  // Director
  300,  // Vice President
  310,  // CXO
  320,  // Owner / Partner
]);

/**
 * FUNCTION facet allowlist
 * Source: facet-store.json FUNCTION section
 */
export const FUNCTION_ALLOWLIST = new Set<number | string>([
  1,   // Accounting
  2,   // Administrative
  3,   // Arts and Design
  4,   // Business Development
  5,   // Community and Social Services
  6,   // Consulting
  7,   // Education
  8,   // Engineering
  9,   // Entrepreneurship
  10,  // Finance
  11,  // Healthcare Services
  12,  // Human Resources
  13,  // Information Technology
  14,  // Legal
  15,  // Marketing
  16,  // Media and Communication
  17,  // Military and Protective Services
  18,  // Operations
  19,  // Program and Project Management
  20,  // Product Management
  21,  // Purchasing
  22,  // Quality Assurance
  23,  // Real Estate
  24,  // Research
  25,  // Sales
  26,  // Customer Success and Support
]);

/**
 * COMPANY_HEADCOUNT facet allowlist
 * Source: facet-store.json COMPANY_HEADCOUNT section
 */
export const COMPANY_HEADCOUNT_ALLOWLIST = new Set<string>([
  "A",  // Self-employed
  "B",  // 1-10
  "C",  // 11-50
  "D",  // 51-200
  "E",  // 201-500
  "F",  // 501-1,000
  "G",  // 1,001-5,000
  "H",  // 5,001-10,000
  "I",  // 10,001+
]);

/**
 * COMPANY_TYPE facet allowlist
 * Source: facet-store.json COMPANY_TYPE section
 */
export const COMPANY_TYPE_ALLOWLIST = new Set<string>([
  "C",  // Public Company
  "P",  // Privately Held
  "D",  // Educational Institution
  "N",  // Non Profit
  "E",  // Self Employed
  "S",  // Partnership
  "G",  // Government Agency
  "O",  // Self Owned
]);

/**
 * REGION_ID_MAP - State and city mappings for accurate region resolution
 * CRITICAL: This map ensures correct region IDs are used
 * 
 * Key: normalized location text (lowercase)
 * Value: LinkedIn region ID (as string)
 */
export const REGION_ID_MAP = new Map<string, string>([
  // STATE-LEVEL (most important for broad searches)
  ['massachusetts', '101098412'],
  ['ma', '101098412'],
  ['connecticut', '106914527'],
  ['ct', '106914527'],
  ['rhode island', '104877241'],  // CRITICAL FIX
  ['ri', '104877241'],
  ['new hampshire', '103532695'],
  ['nh', '103532695'],
  
  // Major metro areas
  ['san francisco', '100901743'],
  ['sf', '100901743'],
  ['san francisco bay area', '102277331'],
  ['bay area', '102277331'],
  ['silicon valley', '102277331'],
  ['new york', '105080838'],
  ['nyc', '105080838'],
  ['new york city', '105080838'],
  ['los angeles', '103644278'],
  ['la', '103644278'],
  ['boston', '105214831'],
  ['seattle', '104116928'],
  ['chicago', '103112676'],
  ['austin', '102748797'],
  ['denver', '104757945'],
]);

/**
 * Get allowlist for a specific facet type
 * Returns null if no allowlist exists for the facet type
 */
export function getFacetAllowlist(facetType: string): Set<number | string> | null {
  switch (facetType) {
    case 'SENIORITY_LEVEL':
      return SENIORITY_LEVEL_ALLOWLIST;
    case 'FUNCTION':
      return FUNCTION_ALLOWLIST;
    case 'COMPANY_HEADCOUNT':
      return COMPANY_HEADCOUNT_ALLOWLIST;
    case 'COMPANY_TYPE':
      return COMPANY_TYPE_ALLOWLIST;
    default:
      return null;
  }
}

/**
 * Validate if an ID is in the allowlist for a given facet type
 */
export function isValidFacetId(facetType: string, id: number | string): boolean {
  const allowlist = getFacetAllowlist(facetType);
  if (!allowlist) return true; // No allowlist = assume valid
  
  // Try as-is and as string/number conversions
  return allowlist.has(id) || 
         allowlist.has(String(id)) || 
         allowlist.has(Number(id));
}




