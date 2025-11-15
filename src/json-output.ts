import type { GeneratorResult, MatchedValue } from "./types.js";

export interface GeneratorJsonPayload {
  url: string;
  facets: Record<string, string> | string;
  dsl?: string;
  warnings?: string[];
  summary?: string;
}

function formatMatchedList(values: MatchedValue[] | undefined, formatter: (value: MatchedValue) => string): string | undefined {
  if (!values || values.length === 0) {
    return undefined;
  }

  return values.map(formatter).join(", ");
}

export function buildGeneratorJsonResponse(result: GeneratorResult, includeDsl = false): GeneratorJsonPayload {
  const formattedFacets: Record<string, string> = {};
  const matched = result.matched;

  const functionFacet = formatMatchedList(matched.FUNCTION, (f) => `${f.text} (${f.id})`);
  if (functionFacet) {
    formattedFacets.FUNCTION = functionFacet;
  }

  const industryFacet = formatMatchedList(matched.INDUSTRY, (i) => `${i.text} (${i.id})`);
  if (industryFacet) {
    formattedFacets.INDUSTRY = industryFacet;
  }

  const regionFacet = formatMatchedList(matched.REGION, (g) => `${g.text} (${g.id})`);
  if (regionFacet) {
    formattedFacets.REGION = regionFacet;
  }

  const personaFacet = formatMatchedList(matched.PERSONA, (s) => `${s.text} (${s.id})`);
  if (personaFacet) {
    formattedFacets.PERSONA = personaFacet;
  }

  if (matched.TITLE && matched.TITLE.length > 0) {
    formattedFacets.TITLE = matched.TITLE.map((t) => `"${t.text}" (${t.match})`).join(", ");
  }

  const currentCompanyFacet = formatMatchedList(matched.CURRENT_COMPANY, (c) => `${c.text} (${c.id})`);
  if (currentCompanyFacet) {
    formattedFacets.CURRENT_COMPANY = currentCompanyFacet;
  }

  const schoolFacet = formatMatchedList(matched.SCHOOL, (s) => `${s.text} (${s.id})`);
  if (schoolFacet) {
    formattedFacets.SCHOOL = schoolFacet;
  }

  const yearsFacet = formatMatchedList(matched.YEARS_OF_EXPERIENCE, (y) => `${y.text} (${y.id})`);
  if (yearsFacet) {
    formattedFacets.YEARS_OF_EXPERIENCE = yearsFacet;
  }

  const headcountFacet = formatMatchedList(matched.COMPANY_HEADCOUNT, (c) => `${c.text} (${c.id})`);
  if (headcountFacet) {
    formattedFacets.COMPANY_HEADCOUNT = headcountFacet;
  }

  const companyTypeFacet = formatMatchedList(matched.COMPANY_TYPE, (c) => `${c.text} (${c.id})`);
  if (companyTypeFacet) {
    formattedFacets.COMPANY_TYPE = companyTypeFacet;
  }

  const seniorityFacet = formatMatchedList(matched.SENIORITY_LEVEL, (s) => `${s.text} (${s.id}) [${s.selectionType}]`);
  if (seniorityFacet) {
    formattedFacets.SENIORITY_LEVEL = seniorityFacet;
  }

  if (matched.KEYWORD && matched.KEYWORD.length > 0) {
    formattedFacets.KEYWORD = matched.KEYWORD.join(", ");
  }

  const facetsOutput = Object.keys(formattedFacets).length > 0 ? formattedFacets : "(No facets matched)";

  return {
    url: result.url,
    facets: facetsOutput,
    dsl: includeDsl ? result.dslDecoded : undefined,
    warnings: result.warnings.length > 0 ? result.warnings : undefined,
    summary: result.summary,
  };
}

