/**
 * NLP-style rule-based text matching for Sales Navigator facets
 */

import type { FacetIndex, MatchedValue, FreeTextValue, NormalizedFacetStore } from "./types.js";
import { normalizeForLookup } from "./sanitize.js";

/**
 * Calculate Levenshtein distance for fuzzy matching
 */
function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Strict matcher for companies/schools - requires exact phrase or whole-word matches
 * Does not use aggressive partial word matching
 */
export function matchFacetStrict(
  text: string,
  index: FacetIndex | undefined,
  options: { minLength?: number } = {}
): MatchedValue[] {
  if (!index) return [];

  const { minLength = 3 } = options;
  const normalizedText = normalizeForLookup(text);
  const matches: MatchedValue[] = [];
  const seenIds = new Set<number | string>();

  // Only exact matches - no partial consecutive word matching
  for (const [lookupKey, id] of index.byText.entries()) {
    if (seenIds.has(id)) continue;

    // Exact whole phrase match with word boundaries
    const regex = new RegExp(`\\b${lookupKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (regex.test(normalizedText)) {
      matches.push({
        id,
        text: index.byId.get(id)!,
        selectionType: "INCLUDED",
      });
      seenIds.add(id);
      continue;
    }

    // Contains match for longer keys (substring match)
    if (lookupKey.length >= minLength && normalizedText.includes(lookupKey)) {
      matches.push({
        id,
        text: index.byId.get(id)!,
        selectionType: "INCLUDED",
      });
      seenIds.add(id);
    }
  }

  return matches;
}

/**
 * Generic matcher that searches for facet values in text
 * For REGION facets (locations), only matches exact location entries
 * For other facets, uses partial consecutive word matching
 */
function matchFacet(
  text: string,
  index: FacetIndex | undefined,
  options: { fuzzyThreshold?: number; minLength?: number; isRegion?: boolean } = {}
): MatchedValue[] {
  if (!index) return [];

  const { fuzzyThreshold = 0, minLength = 3, isRegion = false } = options;
  const normalizedText = normalizeForLookup(text);
  const matches: MatchedValue[] = [];
  const seenIds = new Set<number | string>();

  // Exact matches first (whole word or substring)
  for (const [lookupKey, id] of index.byText.entries()) {
    if (seenIds.has(id)) continue;

    // Split both the lookup key and text into words for partial matching
    // Clean up commas and other punctuation for better matching
    const lookupWords = lookupKey.split(/\s+/).map(word => word.replace(/[,\-]/g, ''));
    const textWords = normalizedText.split(/\s+/).map(word => word.replace(/[,\-]/g, ''));
    
    // Check if the first N words of the lookup key match consecutively in the text
    // This handles "san francisco" matching "san francisco bay area"
    let matched = false;
    
    // Try to find a consecutive match of lookup words in the text
    for (let i = 0; i <= textWords.length - lookupWords.length; i++) {
      let allMatch = true;
      for (let j = 0; j < lookupWords.length; j++) {
        if (textWords[i + j].toLowerCase() !== lookupWords[j].toLowerCase()) {
          allMatch = false;
          break;
        }
      }
      if (allMatch) {
        matched = true;
        break;
      }
    }
    
    // For REGION facets, only match if text words match at the START of lookup key
    // For other facets, match if lookup starts with text words
    if (!matched && lookupWords.length > 1 && !isRegion) {
      let matchCount = 0;
      for (let j = 0; j < textWords.length && j < lookupWords.length; j++) {
        if (textWords[j].toLowerCase() === lookupWords[j].toLowerCase()) {
          matchCount++;
        } else {
          break;
        }
      }
      // For non-region facets: allow partial matches at the beginning
      if (matchCount === textWords.length && matchCount >= 1) {
        matched = true;
      }
    }
    
    // For REGION facets, only match if lookup key STARTS with ALL text words in order
    // This prevents "charlotte" from matching "north carolina" or "united states"
    if (!matched && isRegion && lookupWords.length >= 1) {
      let matchCount = 0;
      for (let j = 0; j < textWords.length && j < lookupWords.length; j++) {
        if (textWords[j].toLowerCase() === lookupWords[j].toLowerCase()) {
          matchCount++;
        } else {
          break;
        }
      }
      // Only match if ALL text words match at the start and in the correct order
      if (matchCount === textWords.length && matchCount >= 1) {
        matched = true;
      }
    }

    if (matched) {
      matches.push({
        id,
        text: index.byId.get(id)!,
        selectionType: "INCLUDED",
      });
      seenIds.add(id);
      continue;
    }

    // Exact whole phrase match
    const regex = new RegExp(`\\b${lookupKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (regex.test(normalizedText)) {
      matches.push({
        id,
        text: index.byId.get(id)!,
        selectionType: "INCLUDED",
      });
      seenIds.add(id);
      continue;
    }

    // Contains match for longer keys (skip for REGION facets to avoid over-matching)
    if (!isRegion && lookupKey.length >= minLength && normalizedText.includes(lookupKey)) {
      matches.push({
        id,
        text: index.byId.get(id)!,
        selectionType: "INCLUDED",
      });
      seenIds.add(id);
      continue;
    }
  }

  // Fuzzy matches for remaining (skip for REGION facets)
  if (fuzzyThreshold > 0 && !isRegion) {
    const words = normalizedText.split(/\s+/);
    for (const word of words) {
      if (word.length < minLength) continue;

      for (const [lookupKey, id] of index.byText.entries()) {
        if (seenIds.has(id)) continue;

        const distance = levenshtein(word, lookupKey);
        if (distance <= fuzzyThreshold && distance < lookupKey.length / 2) {
          matches.push({
            id,
            text: index.byId.get(id)!,
            selectionType: "INCLUDED",
          });
          seenIds.add(id);
        }
      }
    }
  }

  return matches;
}

/**
 * Match functions using structured syntax (e.g., "Function: Accounting", "Function: Sales, Marketing")
 * Supports exclude logic: "Function: Exclude Sales, Exclude Marketing"
 */
export function matchFunctions(
  text: string,
  store: Partial<NormalizedFacetStore>
): MatchedValue[] {
  // Use facet store data for functions
  if (!store.FUNCTION) {
    return [];
  }
  
  // Pattern: "Function: X" (case-insensitive)
  // Stop at newline or start of another facet keyword to prevent cross-contamination
  const functionPattern = /function\s*:\s*([^\n]+?)(?=\s*(?:\n|industry|location|title|seniority|company|keyword|current|past|school|years|group|follows|viewed|connection|relationship|lead|posted|$))/gis;
  let match;

  // Reset regex state to avoid issues between test runs
  functionPattern.lastIndex = 0;

  const allMatches: MatchedValue[] = [];

  while ((match = functionPattern.exec(text)) !== null) {
    const functionList = match[1].trim();
    
    // Split by comma and process each function value
    const functionValues = functionList.split(',').map(value => value.trim()).filter(value => value.length > 0);
    
    for (const functionValue of functionValues) {
      const isExclude = functionValue.toLowerCase().startsWith('exclude ');
      const actualValue = isExclude ? functionValue.substring(8).trim() : functionValue;
      
      // Map text values to facet store values (case-insensitive)
      const normalizedValue = actualValue.toLowerCase();
      let facetText: string;
      
      // Add common synonym mappings
      if (normalizedValue === "sales" || normalizedValue === "salespeople") {
        facetText = "Sales";
      } else if (normalizedValue === "engineering" || normalizedValue === "engineers") {
        facetText = "Engineering";
      } else if (normalizedValue === "operations" || normalizedValue === "ops") {
        facetText = "Operations";
      } else if (normalizedValue === "marketing" || normalizedValue === "marketing managers") {
        facetText = "Marketing";
      } else if (normalizedValue === "finance" || normalizedValue === "financial") {
        facetText = "Finance";
      } else if (normalizedValue === "accounting" || normalizedValue === "accountants") {
        facetText = "Accounting";
      } else if (normalizedValue === "hr" || normalizedValue === "human resources") {
        facetText = "Human Resources";
      } else if (normalizedValue === "it" || normalizedValue === "information technology") {
        facetText = "Information Technology";
      } else if (normalizedValue === "legal" || normalizedValue === "law") {
        facetText = "Legal";
      } else if (normalizedValue === "consulting" || normalizedValue === "consultants") {
        facetText = "Consulting";
      } else {
        // Try direct match with facet store
        facetText = actualValue;
      }
      
      // Use the facet store to find the exact function
      const functionMatches = matchFacet(facetText, store.FUNCTION, { minLength: 2 });
      
      // Set selection type based on exclude flag
      functionMatches.forEach(match => {
        match.selectionType = isExclude ? "EXCLUDED" : "INCLUDED";
      });
      
      allMatches.push(...functionMatches);
    }
  }

  // Deduplicate by ID
  const seen = new Set<string | number>();
  const uniqueMatches: MatchedValue[] = [];

  for (const match of allMatches) {
    if (match.id !== undefined && !seen.has(match.id)) {
      seen.add(match.id);
      uniqueMatches.push(match);
    }
  }

  return uniqueMatches;
}

/**
 * Match industries using structured syntax (e.g., "Industry: Software", "Industry: Healthcare, Finance")
 * Supports exclude logic: "Industry: Exclude Healthcare"
 */
export function matchIndustries(
  text: string,
  store: Partial<NormalizedFacetStore>
): MatchedValue[] {
  // Use facet store data for industries
  if (!store.INDUSTRY) {
    return [];
  }
  
  // Pattern: "Industry: X" (case-insensitive)
  // Stop at newline or start of another facet keyword to prevent cross-contamination
  const industryPattern = /industry\s*:\s*([^\n]+?)(?=\s*(?:\n|function|location|title|seniority|company|keyword|current|past|school|years|group|follows|viewed|connection|relationship|lead|posted|$))/gis;
  let match;

  // Reset regex state to avoid issues between test runs
  industryPattern.lastIndex = 0;

  const allMatches: MatchedValue[] = [];

  while ((match = industryPattern.exec(text)) !== null) {
    const industryList = match[1].trim();
    
    // Split by comma and process each industry value
    const industryValues = industryList.split(',').map(value => value.trim()).filter(value => value.length > 0);
    
    for (const industryValue of industryValues) {
      const isExclude = industryValue.toLowerCase().startsWith('exclude ');
      const actualValue = isExclude ? industryValue.substring(8).trim() : industryValue;
      
      // Map text values to facet store values (case-insensitive)
      const normalizedValue = actualValue.toLowerCase();
      let facetText: string;
      
      // Add common synonym mappings
      if (normalizedValue === "software" || normalizedValue === "software industry") {
        facetText = "Software Development";
      } else if (normalizedValue === "tech" || normalizedValue === "technology" || normalizedValue === "tech industry") {
        facetText = "Technology";
      } else if (normalizedValue === "healthcare" || normalizedValue === "health care") {
        facetText = "Health Care";
      } else if (normalizedValue === "finance" || normalizedValue === "financial services") {
        facetText = "Financial Services";
      } else if (normalizedValue === "education" || normalizedValue === "educational services") {
        facetText = "Education";
      } else if (normalizedValue === "retail" || normalizedValue === "retail trade") {
        facetText = "Retail";
      } else if (normalizedValue === "manufacturing") {
        facetText = "Manufacturing";
      } else if (normalizedValue === "construction") {
        facetText = "Construction";
      } else if (normalizedValue === "real estate") {
        facetText = "Real Estate";
      } else if (normalizedValue === "consulting" || normalizedValue === "consulting services") {
        facetText = "Consulting";
      } else {
        // Try direct match with facet store
        facetText = actualValue;
      }
      
      // Use the facet store to find the exact industry
      const industryMatches = matchFacet(facetText, store.INDUSTRY, { minLength: 2 });
      
      // Set selection type based on exclude flag
      industryMatches.forEach(match => {
        match.selectionType = isExclude ? "EXCLUDED" : "INCLUDED";
      });
      
      allMatches.push(...industryMatches);
    }
  }

  // Deduplicate by ID
  const seen = new Set<string | number>();
  const uniqueMatches: MatchedValue[] = [];

  for (const match of allMatches) {
    if (match.id !== undefined && !seen.has(match.id)) {
      seen.add(match.id);
      uniqueMatches.push(match);
    }
  }

  return uniqueMatches;
}

/**
 * Match geographies using explicit "Location:" syntax (e.g., "Location: Boston", "Location: MacKenzie County, Alberta, Canada")
 * Supports multiple locations separated by semicolons
 * Uses REGION facet for person location searches
 * Only matches exact locations, not parent regions
 */
export function matchGeographies(
  text: string,
  store: Partial<NormalizedFacetStore>
): MatchedValue[] {
  // Use facet store data for regions (person locations)
  if (!store.REGION) {
    return [];
  }
  
  // Pattern: "Location: X" (case-insensitive)
  // Stop at newline or start of another facet keyword to prevent cross-contamination
  const locationPattern = /location\s*:\s*([^\n]+?)(?=\s*(?:\n|function|industry|title|seniority|company|keyword|current|past|school|years|group|follows|viewed|connection|relationship|lead|posted|$))/gis;
  let match;

  // Reset regex state to avoid issues between test runs
  locationPattern.lastIndex = 0;

  const allMatches: MatchedValue[] = [];

  while ((match = locationPattern.exec(text)) !== null) {
    const locationList = match[1].trim();
    
    // Split by semicolon and process each location value
    const locationValues = locationList.split(';').map(value => value.trim()).filter(value => value.length > 0);
    
    for (const locationValue of locationValues) {
      // Apply common abbreviations
      const augmentedLocation = locationValue
        .replace(/\bnyc\b/gi, "new york")
        .replace(/\bsf\b/gi, "san francisco")
        .replace(/\bla\b/gi, "los angeles");
      
      // Normalize the search location for comparison
      const normalizedSearchLocation = normalizeForLookup(augmentedLocation);
      
      // Find EXACT match in REGION facet
      // Look for entries that exactly match the normalized search location
      for (const [lookupKey, id] of store.REGION.byText.entries()) {
        if (lookupKey === normalizedSearchLocation) {
          allMatches.push({
            id,
            text: store.REGION.byId.get(id)!,
            selectionType: "INCLUDED",
          });
          break; // Found exact match, stop looking
        }
      }
    }
  }

  return allMatches;
}

/**
 * Match seniority levels (e.g., "VP", "Director", "C-level")
 */
export function matchSeniority(
  text: string,
  store: Partial<NormalizedFacetStore>
): MatchedValue[] {
  const augmentedText = text
    .replace(/\bvps\b/gi, "vp")
    .replace(/\bvice presidents?\b/gi, "vp")
    .replace(/\bc-level\b/gi, "cxo")
    .replace(/\bexecutives?\b/gi, "executive");

  // SENIORITY_LEVEL is not in the current data, but we can look for PERSONA which has "CXO"
  return matchFacet(augmentedText, store.PERSONA, { minLength: 2 });
}

/**
 * Match years of experience (e.g., "10 years", "5+ years", "senior level")
 * Maps to LinkedIn's predefined experience buckets using facet store data
 */
export function matchYearsOfExperience(
  text: string,
  store: Partial<NormalizedFacetStore>
): MatchedValue[] {
  // Use facet store data for years of experience
  if (!store.YEARS_OF_EXPERIENCE) {
    return [];
  }
  
  const matches: MatchedValue[] = [];
  
  // Define the experience buckets based on the facet store structure
  // These correspond to the IDs in the facet store: 1, 2, 3, 4, 5
  const experienceBuckets = [
    { id: "1", text: "Less than 1 year", min: 0, max: 0 },
    { id: "2", text: "1 to 2 years", min: 1, max: 2 },
    { id: "3", text: "3 to 5 years", min: 3, max: 5 },
    { id: "4", text: "6 to 10 years", min: 6, max: 10 },
    { id: "5", text: "More than 10 years", min: 11, max: 99 },
  ];
  
  // Pattern for "X years" or "X+ years" or "X year experience" or just "X years"
  const yearPattern = /(\d+)\+?\s*years?(?:\s*(?:of\s*)?experience)?/gi;
  let match;
  
  while ((match = yearPattern.exec(text)) !== null) {
    const years = parseInt(match[1], 10);
    if (years >= 0 && years <= 99) {
      // Find the appropriate bucket
      const bucket = experienceBuckets.find(b => years >= b.min && years <= b.max);
      if (bucket) {
        matches.push({
          id: bucket.id,
          text: bucket.text,
          selectionType: "INCLUDED",
        });
      }
    }
  }
  
  // Pattern for "senior level" or "experienced" - map to 6-10 years bucket
  const seniorPattern = /\b(senior|experienced|veteran|seasoned)\b/gi;
  if (seniorPattern.test(text)) {
    const seniorBucket = experienceBuckets.find(b => b.text === "6 to 10 years");
    if (seniorBucket) {
      matches.push({
        id: seniorBucket.id,
        text: seniorBucket.text,
        selectionType: "INCLUDED",
      });
    }
  }
  
  return matches;
}

/**
 * Match company headcount using "Company Headcount: X" syntax
 * Maps to LinkedIn's predefined headcount ranges using facet store data
 */
export function matchCompanyHeadcount(
  text: string,
  store: Partial<NormalizedFacetStore>
): MatchedValue[] {
  // Use facet store data for headcount ranges
  if (!store.COMPANY_HEADCOUNT) {
    return [];
  }
  
  // Pattern: "Company Headcount: X" (case-insensitive)
  // Stop at newline or start of another facet keyword to prevent cross-contamination
  const companyHeadcountPattern = /company\s+headcount\s*:\s*([^\n]+?)(?=\s*(?:\n|function|industry|location|title|seniority|company\s+type|keyword|current|past|school|years|group|follows|viewed|connection|relationship|lead|posted|$))/gis;
  let match;

  // Reset regex state to avoid issues between test runs
  companyHeadcountPattern.lastIndex = 0;

  const allMatches: MatchedValue[] = [];

  while ((match = companyHeadcountPattern.exec(text)) !== null) {
    const headcountList = match[1].trim();
    
    // Split by comma and process each headcount value
    const headcountValues = headcountList.split(',').map(value => value.trim()).filter(value => value.length > 0);
    
    for (const headcountValue of headcountValues) {
      // Handle "Self Employed" variations (case-insensitive)
      if (headcountValue.toLowerCase() === "self employed" || headcountValue.toLowerCase() === "self-employed") {
        // Use the facet store to find "Self-employed"
        const selfEmployedMatches = matchFacet("Self-employed", store.COMPANY_HEADCOUNT, { minLength: 2 });
        allMatches.push(...selfEmployedMatches);
        continue;
      }
      
      // Handle numeric ranges like "1-10", "11-50", etc.
      const rangeMatch = headcountValue.match(/^(\d+)-(\d+)/);
      if (rangeMatch) {
        const rangeText = `${rangeMatch[1]}-${rangeMatch[2]}`;
        // Use the facet store to find the exact range
        const rangeMatches = matchFacet(rangeText, store.COMPANY_HEADCOUNT, { minLength: 2 });
        allMatches.push(...rangeMatches);
        continue;
      }
      
      // Handle single numbers (map to appropriate bucket)
      const singleNumberMatch = headcountValue.match(/^(\d+)$/);
      if (singleNumberMatch) {
        const count = parseInt(singleNumberMatch[1], 10);
        
        // Map single numbers to appropriate ranges
        let rangeText: string;
        if (count <= 10) {
          rangeText = "1-10";
        } else if (count <= 50) {
          rangeText = "11-50";
        } else if (count <= 200) {
          rangeText = "51-200";
        } else if (count <= 500) {
          rangeText = "201-500";
        } else if (count <= 1000) {
          rangeText = "501-1,000";
        } else if (count <= 5000) {
          rangeText = "1,001-5,000";
        } else if (count <= 10000) {
          rangeText = "5,001-10,000";
        } else {
          rangeText = "10,001+";
        }
        
        const rangeMatches = matchFacet(rangeText, store.COMPANY_HEADCOUNT, { minLength: 2 });
        allMatches.push(...rangeMatches);
        continue;
      }
    }
  }

  // Deduplicate by ID
  const seen = new Set<string | number>();
  const uniqueMatches: MatchedValue[] = [];

  for (const match of allMatches) {
    if (match.id && !seen.has(match.id)) {
      uniqueMatches.push(match);
      seen.add(match.id);
    }
  }

  return uniqueMatches;
}

/**
 * Match titles (free-text, extracts quoted strings or patterns)
 */
export function matchTitles(text: string): FreeTextValue[] {
  const titles: FreeTextValue[] = [];

  // Match quoted strings with optional "exact" or "contains" modifier
  // Pattern: title "something" exact OR title contains "something"
  const quotedPattern = /title\s+(?:contains\s+)?["']([^"']+)["']\s*(exact|contains)?/gi;
  let match;

  while ((match = quotedPattern.exec(text)) !== null) {
    const titleText = match[1].trim();
    const matchType = match[2]?.toLowerCase();
    
    titles.push({
      text: titleText,
      match: matchType === "exact" ? "EXACT" : "CONTAINS",
    });
  }

  // Also try: "title: something" or just quoted strings after "title"
  const simplePattern = /title[:\s]+["']([^"']+)["']/gi;
  while ((match = simplePattern.exec(text)) !== null) {
    const titleText = match[1].trim();
    // Avoid duplicates
    if (!titles.some(t => t.text.toLowerCase() === titleText.toLowerCase())) {
      titles.push({
        text: titleText,
        match: "CONTAINS",
      });
    }
  }

  return titles;
}

/**
 * Match company names using "Current Company:" syntax
 */
export function matchCompanyNames(text: string): Array<{ name: string, selectionType: 'INCLUDED' | 'EXCLUDED' }> {
  const companies: Array<{ name: string, selectionType: 'INCLUDED' | 'EXCLUDED' }> = [];

  // Check if the text contains school-related keywords
  // If so, don't match companies - let school matching handle it instead
  const schoolKeywords = /\b(university|academy|school|college|institute|university of|academy of|school of|college of|institute of)\b/gi;
  if (schoolKeywords.test(text)) {
    return companies; // Return empty array to let school matching handle it
  }

  // Look for "Current Company:" pattern (case-insensitive)
  // Stop at next "Current Company:", "Past Company:", or "/" separator
  const currentCompanyPattern = /current\s+company\s*:\s*(.+?)(?=\s+current\s+company\s*:|\s+past\s+company\s*:|\s*\/\s*|$)/gi;
  let match;

  // Reset regex state to avoid issues between test runs
  currentCompanyPattern.lastIndex = 0;
  
  while ((match = currentCompanyPattern.exec(text)) !== null) {
    const companyList = match[1].trim();
    
    // Split by comma and process each company
    const companyNames = companyList.split(',').map(name => name.trim()).filter(name => name.length > 0);
    
    for (const companyName of companyNames) {
      // Check for "Exclude" keyword (case-insensitive)
      const excludeMatch = companyName.match(/^exclude\s+(.+)$/i);
      if (excludeMatch) {
        const company = excludeMatch[1].trim();
        if (company.length > 2) {
          companies.push({
            name: company,
            selectionType: 'EXCLUDED'
          });
        }
      } else {
        // Regular inclusion
        if (companyName.length > 2) {
          companies.push({
            name: companyName,
            selectionType: 'INCLUDED'
          });
        }
      }
    }
  }

  return companies;
}

/**
 * Match past company names using "Past Company:" syntax
 */
export function matchPastCompanyNames(text: string): Array<{ name: string, selectionType: 'INCLUDED' | 'EXCLUDED' }> {
  const companies: Array<{ name: string, selectionType: 'INCLUDED' | 'EXCLUDED' }> = [];

  // Check if the text contains school-related keywords
  // If so, don't match companies - let school matching handle it instead
  const schoolKeywords = /\b(university|academy|school|college|institute|university of|academy of|school of|college of|institute of)\b/gi;
  if (schoolKeywords.test(text)) {
    return companies; // Return empty array to let school matching handle it
  }

  // Look for "Past Company:" pattern (case-insensitive)
  // Stop at next "Past Company:", "Current Company:", or "/" separator
  const pastCompanyPattern = /past\s+company\s*:\s*(.+?)(?=\s+past\s+company\s*:|\s+current\s+company\s*:|\s*\/\s*|$)/gi;
  let match;

  // Reset regex state to avoid issues between test runs
  pastCompanyPattern.lastIndex = 0;
  
  while ((match = pastCompanyPattern.exec(text)) !== null) {
    const companyList = match[1].trim();
    
    // Split by comma and process each company
    const companyNames = companyList.split(',').map(name => name.trim()).filter(name => name.length > 0);
    
    for (const companyName of companyNames) {
      // Check for "Exclude" keyword (case-insensitive)
      const excludeMatch = companyName.match(/^exclude\s+(.+)$/i);
      if (excludeMatch) {
        const company = excludeMatch[1].trim();
        if (company.length > 2) {
          companies.push({
            name: company,
            selectionType: 'EXCLUDED'
          });
        }
      } else {
        // Regular inclusion
        if (companyName.length > 2) {
          companies.push({
            name: companyName,
            selectionType: 'INCLUDED'
          });
        }
      }
    }
  }

  return companies;
}

/**
 * Match school names (free-text extraction)
 */
export function matchSchoolNames(text: string): string[] {
  const schools: string[] = [];

  // Look for patterns like "from SchoolName" or "went to SchoolName"
  // Case-insensitive to catch "from harvard" or "from Harvard"
  // Word boundaries \b ensure we don't match partial words
  const pattern = /(?:from|school|university|college|went to|attended)\s+([A-Za-z][A-Za-z0-9\s&]+?)(?:\s+\b(?:in|from|and|or|with)\b|\.|,|$)/gi;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    const school = match[1].trim();
    if (school.length > 2 && !schools.includes(school)) {
      schools.push(school);
    }
  }

  return schools;
}

/**
 * Match company types using structured syntax (e.g., "Company Type: privately held")
 */
export function matchCompanyType(
  text: string,
  store: Partial<NormalizedFacetStore>
): MatchedValue[] {
  // Use facet store data for company types
  if (!store.COMPANY_TYPE) {
    return [];
  }
  
  // Pattern: "Company Type: X" (case-insensitive)
  // Stop at newline or start of another facet keyword to prevent cross-contamination
  const companyTypePattern = /company\s+type\s*:\s*([^\n]+?)(?=\s*(?:\n|function|industry|location|title|seniority|company\s+headcount|keyword|current|past|school|years|group|follows|viewed|connection|relationship|lead|posted|$))/gis;
  let match;

  // Reset regex state to avoid issues between test runs
  companyTypePattern.lastIndex = 0;

  const allMatches: MatchedValue[] = [];

  while ((match = companyTypePattern.exec(text)) !== null) {
    const typeList = match[1].trim();
    
    // Split by comma and process each type value
    const typeValues = typeList.split(',').map(value => value.trim()).filter(value => value.length > 0);
    
    for (const typeValue of typeValues) {
      // Map text values to facet store values (case-insensitive)
      const normalizedValue = typeValue.toLowerCase();
      let facetText: string;
      
      if (normalizedValue === "public company") {
        facetText = "Public Company";
      } else if (normalizedValue === "privately held") {
        facetText = "Privately Held";
      } else if (normalizedValue === "educational institution") {
        facetText = "Educational Institution";
      } else if (normalizedValue === "non profit" || normalizedValue === "nonprofit") {
        facetText = "Non Profit";
      } else if (normalizedValue === "self employed") {
        facetText = "Self Employed";
      } else if (normalizedValue === "partnership") {
        facetText = "Partnership";
      } else if (normalizedValue === "government agency") {
        facetText = "Government Agency";
      } else if (normalizedValue === "self owned") {
        facetText = "Self Owned";
      } else {
        // Try direct match with facet store
        facetText = typeValue;
      }
      
      // Use the facet store to find the exact type
      const typeMatches = matchFacet(facetText, store.COMPANY_TYPE, { minLength: 2 });
      allMatches.push(...typeMatches);
    }
  }

  // Deduplicate by ID
  const seen = new Set<string | number>();
  const uniqueMatches: MatchedValue[] = [];

  for (const match of allMatches) {
    if (match.id !== undefined && !seen.has(match.id)) {
      seen.add(match.id);
      uniqueMatches.push(match);
    }
  }

  return uniqueMatches;
}

/**
 * Match seniority levels using structured syntax (e.g., "Seniority Level: director")
 * Supports exclude logic: "Seniority Level: Exclude CXO, Exclude Director"
 */
export function matchSeniorityLevel(
  text: string,
  store: Partial<NormalizedFacetStore>
): MatchedValue[] {
  // Use facet store data for seniority levels
  if (!store.SENIORITY_LEVEL) {
    return [];
  }
  
  // Pattern: "Seniority Level: X" (case-insensitive)
  // Stop at newline or start of another facet keyword to prevent cross-contamination
  const seniorityLevelPattern = /seniority\s+level\s*:\s*([^\n]+?)(?=\s*(?:\n|function|industry|location|title|company|keyword|current|past|school|years|group|follows|viewed|connection|relationship|lead|posted|$))/gis;
  let match;

  // Reset regex state to avoid issues between test runs
  seniorityLevelPattern.lastIndex = 0;

  const allMatches: MatchedValue[] = [];

  while ((match = seniorityLevelPattern.exec(text)) !== null) {
    const levelList = match[1].trim();
    
    // Split by comma and process each level value
    const levelValues = levelList.split(',').map(value => value.trim()).filter(value => value.length > 0);
    
    for (const levelValue of levelValues) {
      const isExclude = levelValue.toLowerCase().startsWith('exclude ');
      const actualValue = isExclude ? levelValue.substring(8).trim() : levelValue;
      
      // Map text values to facet store values (case-insensitive)
      const normalizedValue = actualValue.toLowerCase();
      let facetText: string;
      
      if (normalizedValue === "owner" || normalizedValue === "partner" || normalizedValue === "owner / partner") {
        facetText = "Owner / Partner";
      } else if (normalizedValue === "cxo" || normalizedValue === "c-level" || normalizedValue === "executive") {
        facetText = "CXO";
      } else if (normalizedValue === "vice president" || normalizedValue === "vp") {
        facetText = "Vice President";
      } else if (normalizedValue === "director") {
        facetText = "Director";
      } else if (normalizedValue === "experienced manager" || normalizedValue === "manager") {
        facetText = "Experienced Manager";
      } else if (normalizedValue === "entry level manager") {
        facetText = "Entry Level Manager";
      } else if (normalizedValue === "strategic") {
        facetText = "Strategic";
      } else if (normalizedValue === "senior") {
        facetText = "Senior";
      } else if (normalizedValue === "entry level") {
        facetText = "Entry Level";
      } else if (normalizedValue === "in training" || normalizedValue === "training") {
        facetText = "In Training";
      } else {
        // Try direct match with facet store
        facetText = actualValue;
      }
      
      // Use the facet store to find the exact level
      const levelMatches = matchFacet(facetText, store.SENIORITY_LEVEL, { minLength: 2 });
      
      // Set selection type based on exclude flag
      const matchesWithSelectionType = levelMatches.map(match => ({
        ...match,
        selectionType: isExclude ? "EXCLUDED" as const : "INCLUDED" as const
      }));
      
      allMatches.push(...matchesWithSelectionType);
    }
  }

  // Deduplicate by ID
  const seen = new Set<string | number>();
  const uniqueMatches: MatchedValue[] = [];

  for (const match of allMatches) {
    if (match.id !== undefined && !seen.has(match.id)) {
      seen.add(match.id);
      uniqueMatches.push(match);
    }
  }

  return uniqueMatches;
}

/**
 * Match years at current company (e.g., "2 years at company", "5+ years at current company")
 */
export function matchYearsAtCurrentCompany(
  text: string,
  store: Partial<NormalizedFacetStore>
): MatchedValue[] {
  const augmentedText = text
    .replace(/\byears?\s+at\s+company\b/gi, "years at company")
    .replace(/\byears?\s+at\s+current\s+company\b/gi, "years at company")
    .replace(/\byears?\s+with\s+company\b/gi, "years at company");

  return matchFacet(augmentedText, store.YEARS_AT_CURRENT_COMPANY, { minLength: 3 });
}

/**
 * Match years in current position (e.g., "3 years in role", "2+ years in position")
 */
export function matchYearsInCurrentPosition(
  text: string,
  store: Partial<NormalizedFacetStore>
): MatchedValue[] {
  const augmentedText = text
    .replace(/\byears?\s+in\s+role\b/gi, "years in position")
    .replace(/\byears?\s+in\s+position\b/gi, "years in position")
    .replace(/\byears?\s+in\s+current\s+role\b/gi, "years in position")
    .replace(/\byears?\s+in\s+current\s+position\b/gi, "years in position");

  return matchFacet(augmentedText, store.YEARS_IN_CURRENT_POSITION, { minLength: 3 });
}

/**
 * Match current title (e.g., "Account Manager", "Software Engineer")
 */
export function matchCurrentTitle(
  text: string,
  store: Partial<NormalizedFacetStore>
): MatchedValue[] {
  // Look for patterns like "current title Account Manager" or "title: Software Engineer"
  const titlePattern = /(?:current\s+title|title[:\s]+)([A-Za-z][A-Za-z0-9\s&]+?)(?:\s+\b(?:in|from|and|or|with)\b|\.|,|$)/gi;
  const titles: string[] = [];
  let match;

  while ((match = titlePattern.exec(text)) !== null) {
    const title = match[1].trim();
    if (title.length > 2 && !titles.includes(title)) {
      titles.push(title);
    }
  }

  // If no explicit title patterns found, try to match against the facet data
  if (titles.length === 0) {
    return matchFacet(text, store.CURRENT_TITLE, { minLength: 3 });
  }

  // Match found titles against the facet data
  const matches: MatchedValue[] = [];
  for (const title of titles) {
    const titleMatches = matchFacet(title, store.CURRENT_TITLE, { minLength: 3 });
    matches.push(...titleMatches);
  }

  return matches;
}

/**
 * Match LinkedIn groups (e.g., "Harvard Business Review Discussion Group")
 */
export function matchGroup(
  text: string,
  store: Partial<NormalizedFacetStore>
): MatchedValue[] {
  const augmentedText = text
    .replace(/\bgroup\s+member\b/gi, "group")
    .replace(/\bmember\s+of\s+group\b/gi, "group")
    .replace(/\bjoined\s+group\b/gi, "group");

  return matchFacet(augmentedText, store.GROUP, { minLength: 4 });
}

/**
 * Match people who follow your company
 */
export function matchFollowsYourCompany(
  text: string,
  store: Partial<NormalizedFacetStore>
): MatchedValue[] {
  const augmentedText = text
    .replace(/\bfollows?\s+your\s+company\b/gi, "following your company")
    .replace(/\bfollowing\s+your\s+company\b/gi, "following your company")
    .replace(/\bfollows?\s+company\b/gi, "following your company");

  return matchFacet(augmentedText, store.FOLLOWS_YOUR_COMPANY, { minLength: 4 });
}

/**
 * Match people who viewed your profile recently
 */
export function matchViewedYourProfile(
  text: string,
  store: Partial<NormalizedFacetStore>
): MatchedValue[] {
  const augmentedText = text
    .replace(/\bviewed\s+your\s+profile\b/gi, "viewed your profile recently")
    .replace(/\bviewed\s+profile\b/gi, "viewed your profile recently")
    .replace(/\bprofile\s+views?\b/gi, "viewed your profile recently");

  return matchFacet(augmentedText, store.VIEWED_YOUR_PROFILE, { minLength: 4 });
}

/**
 * Match connections of specific people
 */
export function matchConnectionOf(
  text: string,
  store: Partial<NormalizedFacetStore>
): MatchedValue[] {
  const augmentedText = text
    .replace(/\bconnection\s+of\b/gi, "connection of")
    .replace(/\bconnected\s+to\b/gi, "connection of")
    .replace(/\bfriend\s+of\b/gi, "connection of");

  return matchFacet(augmentedText, store.CONNECTION_OF, { minLength: 3 });
}

/**
 * Match past colleagues
 */
export function matchPastColleague(
  text: string,
  store: Partial<NormalizedFacetStore>
): MatchedValue[] {
  const augmentedText = text
    .replace(/\bpast\s+colleague\b/gi, "past colleague")
    .replace(/\bformer\s+colleague\b/gi, "past colleague")
    .replace(/\bworked\s+with\b/gi, "past colleague")
    .replace(/\bcolleague\s+from\b/gi, "past colleague");

  return matchFacet(augmentedText, store.PAST_COLLEAGUE, { minLength: 4 });
}

/**
 * Match people with shared experiences
 */
export function matchWithSharedExperiences(
  text: string,
  store: Partial<NormalizedFacetStore>
): MatchedValue[] {
  const augmentedText = text
    .replace(/\bshared\s+experience\b/gi, "shared experiences")
    .replace(/\bcommon\s+experience\b/gi, "shared experiences")
    .replace(/\bsimilar\s+background\b/gi, "shared experiences");

  return matchFacet(augmentedText, store.WITH_SHARED_EXPERIENCES, { minLength: 4 });
}

/**
 * Match people who recently changed jobs
 */
export function matchRecentlyChangedJobs(
  text: string,
  store: Partial<NormalizedFacetStore>
): MatchedValue[] {
  const augmentedText = text
    .replace(/\brecently\s+changed\s+jobs?\b/gi, "recently changed jobs")
    .replace(/\bnew\s+job\b/gi, "recently changed jobs")
    .replace(/\bjob\s+change\b/gi, "recently changed jobs")
    .replace(/\bcareer\s+change\b/gi, "recently changed jobs");

  return matchFacet(augmentedText, store.RECENTLY_CHANGED_JOBS, { minLength: 4 });
}

/**
 * Match people who posted on LinkedIn
 */
export function matchPostedOnLinkedIn(
  text: string,
  store: Partial<NormalizedFacetStore>
): MatchedValue[] {
  const augmentedText = text
    .replace(/\bposted\s+on\s+linkedin\b/gi, "posted on linkedin")
    .replace(/\blinkedin\s+post\b/gi, "posted on linkedin")
    .replace(/\bactive\s+on\s+linkedin\b/gi, "posted on linkedin")
    .replace(/\blinkedin\s+activity\b/gi, "posted on linkedin");

  return matchFacet(augmentedText, store.POSTED_ON_LINKEDIN, { minLength: 4 });
}

/**
 * Match lead interactions (viewed profile, messaged)
 */
export function matchLeadInteractions(
  text: string,
  store: Partial<NormalizedFacetStore>
): MatchedValue[] {
  const augmentedText = text
    .replace(/\bviewed\s+profile\b/gi, "viewed profile")
    .replace(/\bmessaged\b/gi, "messaged")
    .replace(/\bsent\s+message\b/gi, "messaged")
    .replace(/\binteracted\s+with\b/gi, "messaged");

  return matchFacet(augmentedText, store.LEAD_INTERACTIONS, { minLength: 4 });
}

/**
 * Match keywords using structured syntax (e.g., "Keyword: Free Diver")
 */
export function matchKeywords(text: string): string[] {
  const keywords: string[] = [];

  // Pattern: "Keyword: X" (case-insensitive)
  // Stop at newline or start of another facet keyword to prevent cross-contamination
  const keywordPattern = /keyword\s*:\s*(.+?)(?=\s*(?:\n|function|industry|location|title|seniority|company|current|past|school|years|group|follows|viewed|connection|relationship|lead|posted|$))/gis;
  let match;

  // Reset regex state to avoid issues between test runs
  keywordPattern.lastIndex = 0;

  while ((match = keywordPattern.exec(text)) !== null) {
    const keywordText = match[1].trim();
    if (keywordText.length > 0) {
      keywords.push(keywordText);
    }
  }

  return keywords;
}

