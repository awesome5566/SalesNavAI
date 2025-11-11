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
  matchKeywords,
} from "./nlp.js";
import { resolveCompanyIds, resolveSchoolIds, resolveCompanyIdFromHtml, resolveSchoolIdFromHtml } from "./resolvers.js";
import { buildDslFromMatches, buildPeopleSearchUrl } from "./dsl.js";
import type { GeneratorOptions, GeneratorResult, MatchedValue, NLPMatches } from "./types.js";
import { normalizeForLookup } from "./sanitize.js";
import { parseWithGPT, logGptConversation } from "./gpt-parser.js";
import 'dotenv/config';

/**
 * Generate a human-readable summary from matched facets
 * This allows users to see what was actually encoded in the URL
 */
function generateSummaryFromMatches(matched: Partial<NLPMatches>): string {
  const parts: string[] = [];

  // Function
  if (matched.FUNCTION && matched.FUNCTION.length > 0) {
    const functions = matched.FUNCTION.map(f => {
      const prefix = f.selectionType === "EXCLUDED" ? "Exclude " : "";
      return `${prefix}${f.text}`;
    }).join(", ");
    parts.push(`Function: ${functions}`);
  }

  // Industry
  if (matched.INDUSTRY && matched.INDUSTRY.length > 0) {
    const industries = matched.INDUSTRY.map(i => {
      const prefix = i.selectionType === "EXCLUDED" ? "Exclude " : "";
      return `${prefix}${i.text}`;
    }).join(", ");
    parts.push(`Industry: ${industries}`);
  }

  // Location (REGION)
  if (matched.REGION && matched.REGION.length > 0) {
    const regions = matched.REGION.map(r => {
      const prefix = r.selectionType === "EXCLUDED" ? "Exclude " : "";
      return `${prefix}${r.text}`;
    }).join("; ");
    parts.push(`Location: ${regions}`);
  }

  // Title
  if (matched.TITLE && matched.TITLE.length > 0) {
    const titles = matched.TITLE.map(t => `"${t.text}" ${t.match.toLowerCase()}`).join(", ");
    parts.push(`Title: ${titles}`);
  }

  // Seniority Level
  if (matched.SENIORITY_LEVEL && matched.SENIORITY_LEVEL.length > 0) {
    const levels = matched.SENIORITY_LEVEL.map(s => {
      const prefix = s.selectionType === "EXCLUDED" ? "Exclude " : "";
      return `${prefix}${s.text}`;
    }).join(", ");
    parts.push(`Seniority Level: ${levels}`);
  }

  // Current Company
  if (matched.CURRENT_COMPANY && matched.CURRENT_COMPANY.length > 0) {
    const companies = matched.CURRENT_COMPANY.map(c => {
      const prefix = c.selectionType === "EXCLUDED" ? "Exclude " : "";
      return `${prefix}${c.text}`;
    }).join(", ");
    parts.push(`Current Company: ${companies}`);
  }

  // Past Company
  if (matched.PAST_COMPANY && matched.PAST_COMPANY.length > 0) {
    const companies = matched.PAST_COMPANY.map(c => {
      const prefix = c.selectionType === "EXCLUDED" ? "Exclude " : "";
      return `${prefix}${c.text}`;
    }).join(", ");
    parts.push(`Past Company: ${companies}`);
  }

  // School
  if (matched.SCHOOL && matched.SCHOOL.length > 0) {
    const schools = matched.SCHOOL.map(s => s.text).join(", ");
    parts.push(`School: ${schools}`);
  }

  // Company Type
  if (matched.COMPANY_TYPE && matched.COMPANY_TYPE.length > 0) {
    const types = matched.COMPANY_TYPE.map(t => t.text).join(", ");
    parts.push(`Company Type: ${types}`);
  }

  // Company Headcount
  if (matched.COMPANY_HEADCOUNT && matched.COMPANY_HEADCOUNT.length > 0) {
    const headcounts = matched.COMPANY_HEADCOUNT.map(h => h.text).join(", ");
    parts.push(`Company Headcount: ${headcounts}`);
  }

  // Years of Experience
  if (matched.YEARS_OF_EXPERIENCE && matched.YEARS_OF_EXPERIENCE.length > 0) {
    const years = matched.YEARS_OF_EXPERIENCE.map(y => y.text).join(", ");
    parts.push(`Years of Experience: ${years}`);
  }

  // Current Title
  if (matched.CURRENT_TITLE && matched.CURRENT_TITLE.length > 0) {
    const titles = matched.CURRENT_TITLE.map(t => t.text).join(", ");
    parts.push(`Current Title: ${titles}`);
  }

  // Years at Current Company
  if (matched.YEARS_AT_CURRENT_COMPANY && matched.YEARS_AT_CURRENT_COMPANY.length > 0) {
    const years = matched.YEARS_AT_CURRENT_COMPANY.map(y => y.text).join(", ");
    parts.push(`Years at Current Company: ${years}`);
  }

  // Years in Current Position
  if (matched.YEARS_IN_CURRENT_POSITION && matched.YEARS_IN_CURRENT_POSITION.length > 0) {
    const years = matched.YEARS_IN_CURRENT_POSITION.map(y => y.text).join(", ");
    parts.push(`Years in Current Position: ${years}`);
  }

  // Keywords
  if (matched.KEYWORD && matched.KEYWORD.length > 0) {
    const keywords = matched.KEYWORD.join(" ");
    parts.push(`Keyword: ${keywords}`);
  }

  // Additional relationship filters
  if (matched.FOLLOWS_YOUR_COMPANY && matched.FOLLOWS_YOUR_COMPANY.length > 0) {
    parts.push("Following your company");
  }
  if (matched.VIEWED_YOUR_PROFILE && matched.VIEWED_YOUR_PROFILE.length > 0) {
    parts.push("Viewed your profile");
  }
  if (matched.RECENTLY_CHANGED_JOBS && matched.RECENTLY_CHANGED_JOBS.length > 0) {
    parts.push("Recently changed jobs");
  }
  if (matched.POSTED_ON_LINKEDIN && matched.POSTED_ON_LINKEDIN.length > 0) {
    parts.push("Posted on LinkedIn");
  }

  return parts.join("\n");
}

/**
 * Validate that there are no contradictions between keywords and facets
 * If keywords exclude certain terms (e.g., NOT "Retail"), don't include them as facets
 */
function validateNoContradictions(
  keywords: string[] | undefined,
  matched: Partial<NLPMatches>,
  warnings: string[]
): void {
  if (!keywords || keywords.length === 0) return;

  const keywordText = keywords.join(' ').toLowerCase();

  // Check for excluded industries in keywords
  const excludedIndustryTerms = [
    { term: 'retail', facetText: ['retail'] },
    { term: 'hospitality', facetText: ['hospitality', 'hotels', 'restaurants'] },
    { term: 'food', facetText: ['food', 'restaurants', 'food & beverages'] },
    { term: 'construction', facetText: ['construction'] },
    { term: 'manufacturing', facetText: ['manufacturing'] },
  ];

  for (const { term, facetText } of excludedIndustryTerms) {
    // Check if keyword has NOT "term"
    const notPattern = new RegExp(`not\\s*\\([^)]*"?${term}"?[^)]*\\)`, 'i');
    if (notPattern.test(keywordText)) {
      // Check if we have included industries that match this term
      if (matched.INDUSTRY) {
        const contradictingIndustries = matched.INDUSTRY.filter(ind => {
          if (ind.selectionType === "EXCLUDED") return false;
          const indText = ind.text.toLowerCase();
          return facetText.some(ft => indText.includes(ft));
        });

        if (contradictingIndustries.length > 0) {
          // Remove contradicting industries
          matched.INDUSTRY = matched.INDUSTRY.filter(ind => 
            !contradictingIndustries.includes(ind)
          );
          warnings.push(
            `Removed ${contradictingIndustries.map(i => i.text).join(', ')} from industry filters because keywords exclude "${term}"`
          );
        }
      }
    }
  }
}

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

  // Preprocess with GPT to convert natural language to structured syntax
  const gptResult = await parseWithGPT(description, { silent: options.silent });
  const processedDescription = gptResult.processedQuery;

  // Load data
  const store = loadAllData();

  // Match functions (using GPT-processed description)
  const functions = matchFunctions(processedDescription, store);
  if (functions.length > 0) {
    matched.FUNCTION = functions;
  }

  // Match industries
  // IMPORTANT: Only use industries that have valid LinkedIn IDs - no free-text
  const industries = matchIndustries(processedDescription, store);
  if (industries.length > 0) {
    // Validate that each industry has a valid numeric ID
    const validIndustries = industries.filter(ind => {
      if (typeof ind.id === 'number' || !isNaN(Number(ind.id))) {
        return true;
      }
      warnings.push(
        `Skipped industry "${ind.text}" - not a valid LinkedIn industry. Keep in keywords only.`
      );
      return false;
    });
    
    if (validIndustries.length > 0) {
      matched.INDUSTRY = validIndustries;
    }
  }

  // Match geographies (person locations use REGION facet)
  // IMPORTANT: Only use regions that have valid IDs - omit free-text locations
  const geographies = matchGeographies(processedDescription, store);
  if (geographies.length > 0) {
    // Validate that each region has a numeric ID, filter out free-text entries
    const validRegions = geographies.filter(geo => {
      if (typeof geo.id === 'number' || !isNaN(Number(geo.id))) {
        return true;
      }
      warnings.push(
        `Skipped region "${geo.text}" - no valid ID found. Use resolveRegionId() for location mapping.`
      );
      return false;
    });
    
    if (validRegions.length > 0) {
      matched.REGION = validRegions;
    }
  }

  // Match seniority (using PERSONA as a proxy)
  const seniority = matchSeniority(processedDescription, store);
  if (seniority.length > 0) {
    matched.PERSONA = seniority;
  }

  // Match seniority levels (new SENIORITY_LEVEL facet)
  const seniorityLevels = matchSeniorityLevel(processedDescription, store);
  if (seniorityLevels.length > 0) {
    matched.SENIORITY_LEVEL = seniorityLevels;
  }

  // Match titles
  const titles = matchTitles(processedDescription);
  if (titles.length > 0) {
    matched.TITLE = titles;
  }

  // Match years of experience - ONLY if explicitly requested as a standalone line
  // Check if there's a line like "10+ years" or "5 years" that's NOT part of another facet
  // Pattern: standalone number followed by "years" at the start of a line or after a newline
  const standaloneYearsPattern = /(?:^|\n)\s*(\d+\+?\s*years?)(?:\s|$)/i;
  if (standaloneYearsPattern.test(processedDescription)) {
    const yearsOfExperience = matchYearsOfExperience(processedDescription, store);
    if (yearsOfExperience.length > 0) {
      matched.YEARS_OF_EXPERIENCE = yearsOfExperience;
    }
  }

  // Match company headcount
  const companyHeadcount = matchCompanyHeadcount(processedDescription, store);
  if (companyHeadcount.length > 0) {
    matched.COMPANY_HEADCOUNT = companyHeadcount;
  }

  // Match company type
  const companyType = matchCompanyType(processedDescription, store);
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
    const companyNames = matchCompanyNames(processedDescription);
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
  const pastCompanyNames = matchPastCompanyNames(processedDescription);
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
    const schoolNames = matchSchoolNames(processedDescription);
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
  const yearsAtCompany = matchYearsAtCurrentCompany(processedDescription, store);
  if (yearsAtCompany.length > 0) {
    matched.YEARS_AT_CURRENT_COMPANY = yearsAtCompany;
  }

  // Match years in current position
  const yearsInPosition = matchYearsInCurrentPosition(processedDescription, store);
  if (yearsInPosition.length > 0) {
    matched.YEARS_IN_CURRENT_POSITION = yearsInPosition;
  }

  // Match current title
  const currentTitle = matchCurrentTitle(processedDescription, store);
  if (currentTitle.length > 0) {
    matched.CURRENT_TITLE = currentTitle;
  }

  // Match groups
  const groups = matchGroup(processedDescription, store);
  if (groups.length > 0) {
    matched.GROUP = groups;
  }

  // Match follows your company
  const followsCompany = matchFollowsYourCompany(processedDescription, store);
  if (followsCompany.length > 0) {
    matched.FOLLOWS_YOUR_COMPANY = followsCompany;
  }

  // Match viewed your profile
  const viewedProfile = matchViewedYourProfile(processedDescription, store);
  if (viewedProfile.length > 0) {
    matched.VIEWED_YOUR_PROFILE = viewedProfile;
  }

  // Match connection of
  const connectionOf = matchConnectionOf(processedDescription, store);
  if (connectionOf.length > 0) {
    matched.CONNECTION_OF = connectionOf;
  }

  // Match past colleague
  const pastColleague = matchPastColleague(processedDescription, store);
  if (pastColleague.length > 0) {
    matched.PAST_COLLEAGUE = pastColleague;
  }

  // Match with shared experiences
  const sharedExperiences = matchWithSharedExperiences(processedDescription, store);
  if (sharedExperiences.length > 0) {
    matched.WITH_SHARED_EXPERIENCES = sharedExperiences;
  }

  // Match recently changed jobs
  const changedJobs = matchRecentlyChangedJobs(processedDescription, store);
  if (changedJobs.length > 0) {
    matched.RECENTLY_CHANGED_JOBS = changedJobs;
  }

  // Match posted on LinkedIn
  const postedLinkedIn = matchPostedOnLinkedIn(processedDescription, store);
  if (postedLinkedIn.length > 0) {
    matched.POSTED_ON_LINKEDIN = postedLinkedIn;
  }

  // Match lead interactions
  const leadInteractions = matchLeadInteractions(processedDescription, store);
  if (leadInteractions.length > 0) {
    matched.LEAD_INTERACTIONS = leadInteractions;
  }

  // Match keywords
  const keywords = matchKeywords(processedDescription);
  if (keywords.length > 0) {
    matched.KEYWORD = keywords;
  }

  // Validate no contradictions between keywords and facets
  validateNoContradictions(matched.KEYWORD, matched, warnings);

  // Build DSL and URL
  // buildDslFromMatches returns raw DSL with keywords pre-encoded
  // buildPeopleSearchUrl encodes the entire DSL once
  const dslDecoded = buildDslFromMatches(matched as any);
  const url = buildPeopleSearchUrl(dslDecoded);

  // Generate human-readable summary from matched facets
  const summary = generateSummaryFromMatches(matched);

  const result: GeneratorResult = {
    url,
    dslDecoded,
    matched,
    warnings,
    summary,
  };

  await logGptConversation({
    timestamp: new Date().toISOString(),
    input: description,
    output: gptResult.output,
    status: gptResult.status,
    url: result.url ?? '',
  });

  return result;
}

