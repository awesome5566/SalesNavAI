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

