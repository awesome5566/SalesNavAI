/**
 * Main URL generator logic
 */

import { loadAllData } from "./loaders.js";
import {
  matchFunctions,
  matchIndustries,
  matchGeographies,
  matchSeniority,
  matchTitles,
  matchCompanyNames,
  matchSchoolNames,
  matchYearsOfExperience,
} from "./nlp.js";
import { resolveCompanyIds, resolveSchoolIds, resolveCompanyIdFromHtml, resolveSchoolIdFromHtml } from "./resolvers.js";
import { buildDslFromMatches, encodeQuery, buildPeopleSearchUrl } from "./dsl.js";
import type { GeneratorOptions, GeneratorResult, MatchedValue, NLPMatches } from "./types.js";
import { normalizeForLookup } from "./sanitize.js";

/**
 * Generate a Sales Navigator URL from a natural language description
 */
export async function generateUrlFromDescription(
  description: string,
  options: GeneratorOptions = {}
): Promise<GeneratorResult> {
  const warnings: string[] = [];
  const matched: Partial<NLPMatches> = {};

  // Load data
  const store = loadAllData();

  // Match functions
  const functions = matchFunctions(description, store);
  if (functions.length > 0) {
    matched.FUNCTION = functions;
  }

  // Match industries
  const industries = matchIndustries(description, store);
  if (industries.length > 0) {
    matched.INDUSTRY = industries;
  }

  // Match geographies
  const geographies = matchGeographies(description, store);
  if (geographies.length > 0) {
    matched.REGION = geographies;
  }

  // Match seniority (using PERSONA as a proxy since we don't have SENIORITY_LEVEL)
  const seniority = matchSeniority(description, store);
  if (seniority.length > 0) {
    matched.PERSONA = seniority;
  }

  // Match titles
  const titles = matchTitles(description);
  if (titles.length > 0) {
    matched.TITLE = titles;
  }

  // Match years of experience
  const yearsOfExperience = matchYearsOfExperience(description);
  if (yearsOfExperience.length > 0) {
    matched.YEARS_OF_EXPERIENCE = yearsOfExperience;
  }

  // Match and resolve companies
  if (options.resolveCompanies && options.resolveCompanies.length > 0) {
    const companyIds = await resolveCompanyIds(options.resolveCompanies, 2, options.silent);
    const companyMatches: MatchedValue[] = [];

    for (const [url, id] of companyIds.entries()) {
      const name = url.split("/company/")[1]?.replace(/\/$/, "") || "Unknown";
      companyMatches.push({
        id,
        text: name,
        selectionType: "INCLUDED",
      });
    }

    if (companyMatches.length > 0) {
      matched.CURRENT_COMPANY = companyMatches;
    }
  } else {
    // Try to match company names from text
    const companyNames = matchCompanyNames(description);
    if (companyNames.length > 0) {
      const companyMatches: MatchedValue[] = [];
      
      for (const name of companyNames) {
        const lookupKey = normalizeForLookup(name);
        const id = store.CURRENT_COMPANY?.byText.get(lookupKey);
        
        if (id !== undefined) {
          // Found in local data
          companyMatches.push({
            id,
            text: store.CURRENT_COMPANY?.byId.get(id) || name,
            selectionType: "INCLUDED",
          });
        } else {
          // Not found locally - try to construct LinkedIn URL and resolve
          const companySlug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
          const guessedUrl = `https://www.linkedin.com/company/${companySlug}/`;
          
          if (options.debug) {
            console.log(`Company "${name}" not found locally. Trying: ${guessedUrl}`);
          }
          
          try {
            const resolvedId = await resolveCompanyIdFromHtml(guessedUrl, options.silent);
            if (resolvedId !== null) {
              companyMatches.push({
                id: resolvedId,
                text: name,
                selectionType: "INCLUDED",
              });
            } else {
              warnings.push(
                `Company "${name}" not found. Tried ${guessedUrl} but could not resolve ID.`
              );
            }
          } catch (error) {
            warnings.push(
              `Company "${name}" not found. Could not resolve from ${guessedUrl}.`
            );
          }
        }
      }

      if (companyMatches.length > 0) {
        matched.CURRENT_COMPANY = companyMatches;
      }
    }
  }

  // Match and resolve schools
  if (options.resolveSchools && options.resolveSchools.length > 0) {
    const schoolIds = await resolveSchoolIds(options.resolveSchools, 2, options.silent);
    const schoolMatches: MatchedValue[] = [];

    for (const [url, id] of schoolIds.entries()) {
      const name = url.split("/school/")[1]?.replace(/\/$/, "") || "Unknown";
      schoolMatches.push({
        id,
        text: name,
        selectionType: "INCLUDED",
      });
    }

    if (schoolMatches.length > 0) {
      matched.SCHOOL = schoolMatches;
    }
  } else {
    // Try to match school names from text
    const schoolNames = matchSchoolNames(description);
    if (schoolNames.length > 0) {
      const schoolMatches: MatchedValue[] = [];
      
      for (const name of schoolNames) {
        const lookupKey = normalizeForLookup(name);
        const id = store.SCHOOL?.byText.get(lookupKey);
        
        if (id !== undefined) {
          // Found in local data
          schoolMatches.push({
            id,
            text: store.SCHOOL?.byId.get(id) || name,
            selectionType: "INCLUDED",
          });
        } else {
          // Not found locally - try to construct LinkedIn URL and resolve
          const schoolSlug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
          const guessedUrl = `https://www.linkedin.com/school/${schoolSlug}/`;
          
          if (options.debug) {
            console.log(`School "${name}" not found locally. Trying: ${guessedUrl}`);
          }
          
          try {
            const resolvedId = await resolveSchoolIdFromHtml(guessedUrl, options.silent);
            if (resolvedId !== null) {
              schoolMatches.push({
                id: resolvedId,
                text: name,
                selectionType: "INCLUDED",
              });
            } else {
              warnings.push(
                `School "${name}" not found. Tried ${guessedUrl} but could not resolve ID.`
              );
            }
          } catch (error) {
            warnings.push(
              `School "${name}" not found. Could not resolve from ${guessedUrl}.`
            );
          }
        }
      }

      if (schoolMatches.length > 0) {
        matched.SCHOOL = schoolMatches;
      }
    }
  }

  // Build DSL
  const dslDecoded = buildDslFromMatches(matched as any);
  const encodedQuery = encodeQuery(dslDecoded);
  const url = buildPeopleSearchUrl(encodedQuery);

  return {
    url,
    dslDecoded,
    matched,
    warnings,
  };
}

