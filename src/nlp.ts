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
  const seenIds = new Set<number>();

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
 * Uses partial consecutive word matching for geographies
 */
function matchFacet(
  text: string,
  index: FacetIndex | undefined,
  options: { fuzzyThreshold?: number; minLength?: number } = {}
): MatchedValue[] {
  if (!index) return [];

  const { fuzzyThreshold = 0, minLength = 3 } = options;
  const normalizedText = normalizeForLookup(text);
  const matches: MatchedValue[] = [];
  const seenIds = new Set<number>();

  // Exact matches first (whole word or substring)
  for (const [lookupKey, id] of index.byText.entries()) {
    if (seenIds.has(id)) continue;

    // Split both the lookup key and text into words for partial matching
    const lookupWords = lookupKey.split(/\s+/);
    const textWords = normalizedText.split(/\s+/);
    
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
    
    // Also check if the text words match the beginning of the lookup key
    // This handles "san francisco" in text matching "san francisco bay area" in data
    if (!matched && lookupWords.length > 1) {
      for (let i = 0; i <= textWords.length - 2; i++) {
        let matchCount = 0;
        for (let j = 0; j < lookupWords.length && i + j < textWords.length; j++) {
          if (textWords[i + j].toLowerCase() === lookupWords[j].toLowerCase()) {
            matchCount++;
          } else {
            break;
          }
        }
        // If at least 2 consecutive words match at the start of the lookup key
        // This allows "san francisco" to match "san francisco bay area"
        if (matchCount >= 2) {
          matched = true;
          break;
        }
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

    // Contains match for longer keys
    if (lookupKey.length >= minLength && normalizedText.includes(lookupKey)) {
      matches.push({
        id,
        text: index.byId.get(id)!,
        selectionType: "INCLUDED",
      });
      seenIds.add(id);
      continue;
    }
  }

  // Fuzzy matches for remaining
  if (fuzzyThreshold > 0) {
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
 * Match functions (e.g., "sales", "engineering", "operations")
 */
export function matchFunctions(
  text: string,
  store: Partial<NormalizedFacetStore>
): MatchedValue[] {
  // Add common synonyms
  const augmentedText = text
    .replace(/\bsalespeople\b/gi, "sales")
    .replace(/\bengineers\b/gi, "engineering")
    .replace(/\bops\b/gi, "operations");

  return matchFacet(augmentedText, store.FUNCTION, { minLength: 4 });
}

/**
 * Match industries (e.g., "software", "healthcare", "finance")
 */
export function matchIndustries(
  text: string,
  store: Partial<NormalizedFacetStore>
): MatchedValue[] {
  const augmentedText = text
    .replace(/\bsoftware industry\b/gi, "software development")
    .replace(/\btech industry\b/gi, "technology")
    .replace(/\btech\b/gi, "technology");

  return matchFacet(augmentedText, store.INDUSTRY, { minLength: 4 });
}

/**
 * Match geographies/regions (e.g., "Boston", "NYC", "San Francisco")
 */
export function matchGeographies(
  text: string,
  store: Partial<NormalizedFacetStore>
): MatchedValue[] {
  const augmentedText = text
    .replace(/\bnyc\b/gi, "new york")
    .replace(/\bsf\b/gi, "san francisco")
    .replace(/\bla\b/gi, "los angeles");

  // Try REGION first, then GEOGRAPHY
  const regionMatches = matchFacet(augmentedText, store.REGION, { minLength: 3 });
  const geoMatches = matchFacet(augmentedText, store.GEOGRAPHY, { minLength: 3 });

  // Deduplicate by ID
  const seen = new Set<number>();
  const combined: MatchedValue[] = [];

  for (const match of [...regionMatches, ...geoMatches]) {
    if (match.id && !seen.has(match.id)) {
      combined.push(match);
      seen.add(match.id);
    }
  }

  return combined;
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
 * Maps to LinkedIn's predefined experience buckets
 */
export function matchYearsOfExperience(text: string): MatchedValue[] {
  const matches: MatchedValue[] = [];
  
  // LinkedIn's experience bucket mapping
  const experienceBuckets = [
    { id: 1, text: "0 to 2 years", min: 0, max: 2 },
    { id: 2, text: "3 to 5 years", min: 3, max: 5 },
    { id: 3, text: "6 to 10 years", min: 6, max: 10 },
    { id: 4, text: "11 to 15 years", min: 11, max: 15 },
    { id: 5, text: "16 to 20 years", min: 16, max: 20 },
    { id: 6, text: "21+ years", min: 21, max: 99 },
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
    const seniorBucket = experienceBuckets.find(b => b.id === 3); // 6-10 years
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
 * Match company headcount (e.g., "headcount of 10", "50 employees", "company size 200")
 * Maps to LinkedIn's predefined headcount ranges
 */
export function matchCompanyHeadcount(
  text: string,
  _store: Partial<NormalizedFacetStore>
): MatchedValue[] {
  const matches: MatchedValue[] = [];
  
  // Define headcount buckets based on LinkedIn's ranges
  const headcountBuckets = [
    { text: "1-10", min: 1, max: 10 },
    { text: "11-50", min: 11, max: 50 },
    { text: "51-200", min: 51, max: 200 },
    { text: "201-500", min: 201, max: 500 },
    { text: "501-1000", min: 501, max: 1000 },
    { text: "1001-5000", min: 1001, max: 5000 },
    { text: "5000+", min: 5001, max: 999999 },
  ];
  
  // Pattern 1: "headcount of X" or "headcount X"
  const headcountPattern = /headcount\s+(?:of\s+)?(\d+)/gi;
  let match;
  
  while ((match = headcountPattern.exec(text)) !== null) {
    const count = parseInt(match[1], 10);
    const bucket = headcountBuckets.find(b => count >= b.min && count <= b.max);
    if (bucket) {
      // Since COMPANY_HEADCOUNT has no IDs, we'll create a synthetic ID based on the text
      const syntheticId = bucket.text === "1-10" ? 1 : 
                         bucket.text === "11-50" ? 2 :
                         bucket.text === "51-200" ? 3 :
                         bucket.text === "201-500" ? 4 :
                         bucket.text === "501-1000" ? 5 :
                         bucket.text === "1001-5000" ? 6 : 7;
      
      matches.push({
        id: syntheticId,
        text: bucket.text,
        selectionType: "INCLUDED",
      });
    }
  }
  
  // Pattern 2: "X employees" or "company size X"
  const employeePattern = /(?:company\s+size|employees?)\s+(?:of\s+)?(\d+)/gi;
  while ((match = employeePattern.exec(text)) !== null) {
    const count = parseInt(match[1], 10);
    const bucket = headcountBuckets.find(b => count >= b.min && count <= b.max);
    if (bucket) {
      const syntheticId = bucket.text === "1-10" ? 1 : 
                         bucket.text === "11-50" ? 2 :
                         bucket.text === "51-200" ? 3 :
                         bucket.text === "201-500" ? 4 :
                         bucket.text === "501-1000" ? 5 :
                         bucket.text === "1001-5000" ? 6 : 7;
      
      if (!matches.some(m => m.id === syntheticId)) {
        matches.push({
          id: syntheticId,
          text: bucket.text,
          selectionType: "INCLUDED",
        });
      }
    }
  }
  
  // Pattern 3: Range patterns "X-Y" or "X to Y"
  const rangePattern = /(\d+)\s*(?:-|to)\s*(\d+)\s*(?:employees?|people|headcount)?/gi;
  while ((match = rangePattern.exec(text)) !== null) {
    const min = parseInt(match[1], 10);
    const max = parseInt(match[2], 10);
    const bucket = headcountBuckets.find(b => 
      (min >= b.min && min <= b.max) || (max >= b.min && max <= b.max)
    );
    if (bucket) {
      const syntheticId = bucket.text === "1-10" ? 1 : 
                         bucket.text === "11-50" ? 2 :
                         bucket.text === "51-200" ? 3 :
                         bucket.text === "201-500" ? 4 :
                         bucket.text === "501-1000" ? 5 :
                         bucket.text === "1001-5000" ? 6 : 7;
      
      if (!matches.some(m => m.id === syntheticId)) {
        matches.push({
          id: syntheticId,
          text: bucket.text,
          selectionType: "INCLUDED",
        });
      }
    }
  }
  
  // Pattern 4: Descriptive terms
  const descriptivePatterns = [
    { pattern: /\b(small|startup|tiny)\s+compan/gi, text: "1-10" },
    { pattern: /\b(medium|mid-sized?)\s+compan/gi, text: "51-200" },
    { pattern: /\b(large|big|enterprise)\s+compan/gi, text: "1001-5000" },
  ];
  
  for (const { pattern, text: bucketText } of descriptivePatterns) {
    if (pattern.test(text)) {
      const syntheticId = bucketText === "1-10" ? 1 : 
                         bucketText === "11-50" ? 2 :
                         bucketText === "51-200" ? 3 :
                         bucketText === "201-500" ? 4 :
                         bucketText === "501-1000" ? 5 :
                         bucketText === "1001-5000" ? 6 : 7;
      
      if (!matches.some(m => m.id === syntheticId)) {
        matches.push({
          id: syntheticId,
          text: bucketText,
          selectionType: "INCLUDED",
        });
      }
    }
  }
  
  return matches;
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
 * Match company names (free-text extraction)
 */
export function matchCompanyNames(text: string): string[] {
  const companies: string[] = [];

  // Check if the text contains school-related keywords
  // If so, don't match companies - let school matching handle it instead
  const schoolKeywords = /\b(university|academy|school|college|institute|university of|academy of|school of|college of|institute of)\b/gi;
  if (schoolKeywords.test(text)) {
    return companies; // Return empty array to let school matching handle it
  }

  // Look for patterns like "at CompanyName" or "from CompanyName"
  // Case-insensitive to catch "at hubspot" or "at HubSpot"
  // Word boundaries \b ensure we don't match partial words (e.g., "in" in "international")
  const pattern = /(?:at|from|company|works at)\s+([A-Za-z][A-Za-z0-9\s&]+?)(?:\s+\b(?:in|from|and|or|with)\b|\.|,|$)/gi;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    const company = match[1].trim();
    if (company.length > 2 && !companies.includes(company)) {
      companies.push(company);
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

