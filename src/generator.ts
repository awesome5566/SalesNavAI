/**
 * Main URL generator logic
 */

import { loadAllData } from "./loaders.js";
import {
  matchFunctions,
  matchIndustries,
  matchGeographies,
  matchSeniority,
  matchSeniorityLevel,
  matchTitles,
  matchCompanyNames,
  matchPastCompanyNames,
  matchSchoolNames,
  matchYearsOfExperience,
  matchCompanyHeadcount,
  matchCompanyType,
  matchYearsAtCurrentCompany,
  matchYearsInCurrentPosition,
  matchCurrentTitle,
  matchGroup,
  matchFollowsYourCompany,
  matchViewedYourProfile,
  matchConnectionOf,
  matchPastColleague,
  matchWithSharedExperiences,
  matchRecentlyChangedJobs,
  matchPostedOnLinkedIn,
  matchLeadInteractions,
} from "./nlp.js";
import { resolveCompanyIds, resolveSchoolIds, resolveCompanyIdFromHtml, resolveSchoolIdFromHtml } from "./resolvers.js";
import { buildDslFromMatches, encodeQuery, buildPeopleSearchUrl } from "./dsl.js";
import type { GeneratorOptions, GeneratorResult, MatchedValue, NLPMatches } from "./types.js";
import { normalizeForLookup } from "./sanitize.js";

/**
 * Try multiple URL slug variations for company/school resolution
 */
async function tryMultipleUrlVariations(
  name: string,
  type: 'company' | 'school',
  options: GeneratorOptions
): Promise<number | null> {
  // Generate multiple slug variations
  const slugVariations = [
    // Standard: lowercase, spaces to dashes, remove special chars
    name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
    // No dashes: lowercase, remove all spaces and special chars
    name.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "")
  ];

  // Remove duplicates
  const uniqueSlugs = [...new Set(slugVariations)];

  if (options.debug) {
    console.log(`${type} "${name}" not found locally. Trying ${uniqueSlugs.length} URL variations:`);
  }

  // Try each variation until one succeeds
  for (let i = 0; i < uniqueSlugs.length; i++) {
    const slug = uniqueSlugs[i];
    const baseUrl = type === 'company' 
      ? `https://www.linkedin.com/company/${slug}/`
      : `https://www.linkedin.com/school/${slug}/`;

    if (options.debug) {
      console.log(`  ${i + 1}. Trying: ${baseUrl}`);
    }

    try {
      const resolvedId = type === 'company' 
        ? await resolveCompanyIdFromHtml(baseUrl, options.silent)
        : await resolveSchoolIdFromHtml(baseUrl, options.silent);
      
      if (resolvedId !== null) {
        if (options.debug) {
          console.log(`  ✓ Success with variation ${i + 1}: ${baseUrl}`);
        }
        return resolvedId;
      }
    } catch (error) {
      // Continue to next variation
      if (options.debug) {
        console.log(`  ✗ Failed: ${baseUrl}`);
      }
    }
  }

  if (options.debug) {
    console.log(`  ✗ All ${uniqueSlugs.length} variations failed for ${type} "${name}"`);
  }

  return null;
}

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

  // Match geographies (person locations use REGION facet)
  const geographies = matchGeographies(description, store);
  if (geographies.length > 0) {
    matched.REGION = geographies;
  }

  // Match seniority (using PERSONA as a proxy)
  const seniority = matchSeniority(description, store);
  if (seniority.length > 0) {
    matched.PERSONA = seniority;
  }

  // Match seniority levels (new SENIORITY_LEVEL facet)
  const seniorityLevels = matchSeniorityLevel(description, store);
  if (seniorityLevels.length > 0) {
    matched.SENIORITY_LEVEL = seniorityLevels;
  }

  // Match titles
  const titles = matchTitles(description);
  if (titles.length > 0) {
    matched.TITLE = titles;
  }

  // Match years of experience
  const yearsOfExperience = matchYearsOfExperience(description, store);
  if (yearsOfExperience.length > 0) {
    matched.YEARS_OF_EXPERIENCE = yearsOfExperience;
  }

  // Match company headcount
  const companyHeadcount = matchCompanyHeadcount(description, store);
  if (companyHeadcount.length > 0) {
    matched.COMPANY_HEADCOUNT = companyHeadcount;
  }

  // Match company type
  const companyType = matchCompanyType(description, store);
  if (companyType.length > 0) {
    matched.COMPANY_TYPE = companyType;
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
      
      for (const { name, selectionType } of companyNames) {
        const lookupKey = normalizeForLookup(name);
        const id = store.CURRENT_COMPANY?.byText.get(lookupKey);
        
        if (id !== undefined) {
          // Check if the ID is numeric (valid for LinkedIn DSL)
          const numericId = parseInt(id.toString(), 10);
          if (!isNaN(numericId)) {
            // Found valid numeric ID in local data
            companyMatches.push({
              id: numericId,
              text: store.CURRENT_COMPANY?.byId.get(id) || name,
              selectionType: selectionType,
            });
          } else {
            // ID is not numeric (e.g., "urn"), fall back to URL resolution
            const resolvedId = await tryMultipleUrlVariations(name, 'company', options);
            
            if (resolvedId !== null) {
              companyMatches.push({
                id: resolvedId,
                text: name,
                selectionType: selectionType,
              });
            } else {
              warnings.push(
                `Company "${name}" has non-numeric ID "${id}" in local data and could not be resolved via URL lookup.`
              );
            }
          }
        } else {
          // Not found locally - try multiple URL variations
          const resolvedId = await tryMultipleUrlVariations(name, 'company', options);
          
          if (resolvedId !== null) {
            companyMatches.push({
              id: resolvedId,
              text: name,
              selectionType: selectionType,
            });
          } else {
            warnings.push(
              `Company "${name}" not found. Tried multiple URL variations but could not resolve ID.`
            );
          }
        }
      }

      if (companyMatches.length > 0) {
        matched.CURRENT_COMPANY = companyMatches;
      }
    }
  }

  // Match and resolve past companies
  const pastCompanyNames = matchPastCompanyNames(description);
  if (pastCompanyNames.length > 0) {
    const pastCompanyMatches: MatchedValue[] = [];
    
    for (const { name, selectionType } of pastCompanyNames) {
      const lookupKey = normalizeForLookup(name);
      const id = store.PAST_COMPANY?.byText.get(lookupKey);
      
      if (id !== undefined) {
        // Check if the ID is numeric (valid for LinkedIn DSL)
        const numericId = parseInt(id.toString(), 10);
        if (!isNaN(numericId)) {
          // Found valid numeric ID in local data - format with URN prefix
          pastCompanyMatches.push({
            id: `urn:li:organization:${numericId}`,
            text: store.PAST_COMPANY?.byId.get(id) || name,
            selectionType: selectionType,
          });
        } else {
          // ID is not numeric (e.g., "urn"), fall back to URL resolution
          const resolvedId = await tryMultipleUrlVariations(name, 'company', options);
          
          if (resolvedId !== null) {
            pastCompanyMatches.push({
              id: `urn:li:organization:${resolvedId}`,
              text: name,
              selectionType: selectionType,
            });
          } else {
            warnings.push(
              `Past Company "${name}" has non-numeric ID "${id}" in local data and could not be resolved via URL lookup.`
            );
          }
        }
      } else {
        // Not found locally - try multiple URL variations
        const resolvedId = await tryMultipleUrlVariations(name, 'company', options);
        
        if (resolvedId !== null) {
          pastCompanyMatches.push({
            id: `urn:li:organization:${resolvedId}`,
            text: name,
            selectionType: selectionType,
          });
        } else {
          warnings.push(
            `Past Company "${name}" not found. Tried multiple URL variations but could not resolve ID.`
          );
        }
      }
    }

    if (pastCompanyMatches.length > 0) {
      matched.PAST_COMPANY = pastCompanyMatches;
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
          // Not found locally - try multiple URL variations
          const resolvedId = await tryMultipleUrlVariations(name, 'school', options);
          
          if (resolvedId !== null) {
            schoolMatches.push({
              id: resolvedId,
              text: name,
              selectionType: "INCLUDED",
            });
          } else {
            warnings.push(
              `School "${name}" not found. Tried multiple URL variations but could not resolve ID.`
            );
          }
        }
      }

      if (schoolMatches.length > 0) {
        matched.SCHOOL = schoolMatches;
      }
    }
  }

  // Match years at current company
  const yearsAtCompany = matchYearsAtCurrentCompany(description, store);
  if (yearsAtCompany.length > 0) {
    matched.YEARS_AT_CURRENT_COMPANY = yearsAtCompany;
  }

  // Match years in current position
  const yearsInPosition = matchYearsInCurrentPosition(description, store);
  if (yearsInPosition.length > 0) {
    matched.YEARS_IN_CURRENT_POSITION = yearsInPosition;
  }

  // Match current title
  const currentTitle = matchCurrentTitle(description, store);
  if (currentTitle.length > 0) {
    matched.CURRENT_TITLE = currentTitle;
  }

  // Match groups
  const groups = matchGroup(description, store);
  if (groups.length > 0) {
    matched.GROUP = groups;
  }

  // Match follows your company
  const followsCompany = matchFollowsYourCompany(description, store);
  if (followsCompany.length > 0) {
    matched.FOLLOWS_YOUR_COMPANY = followsCompany;
  }

  // Match viewed your profile
  const viewedProfile = matchViewedYourProfile(description, store);
  if (viewedProfile.length > 0) {
    matched.VIEWED_YOUR_PROFILE = viewedProfile;
  }

  // Match connection of
  const connectionOf = matchConnectionOf(description, store);
  if (connectionOf.length > 0) {
    matched.CONNECTION_OF = connectionOf;
  }

  // Match past colleague
  const pastColleague = matchPastColleague(description, store);
  if (pastColleague.length > 0) {
    matched.PAST_COLLEAGUE = pastColleague;
  }

  // Match with shared experiences
  const sharedExperiences = matchWithSharedExperiences(description, store);
  if (sharedExperiences.length > 0) {
    matched.WITH_SHARED_EXPERIENCES = sharedExperiences;
  }

  // Match recently changed jobs
  const changedJobs = matchRecentlyChangedJobs(description, store);
  if (changedJobs.length > 0) {
    matched.RECENTLY_CHANGED_JOBS = changedJobs;
  }

  // Match posted on LinkedIn
  const postedLinkedIn = matchPostedOnLinkedIn(description, store);
  if (postedLinkedIn.length > 0) {
    matched.POSTED_ON_LINKEDIN = postedLinkedIn;
  }

  // Match lead interactions
  const leadInteractions = matchLeadInteractions(description, store);
  if (leadInteractions.length > 0) {
    matched.LEAD_INTERACTIONS = leadInteractions;
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

