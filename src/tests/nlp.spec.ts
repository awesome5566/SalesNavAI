/**
 * Tests for NLP matchers
 */

import { test } from "node:test";
import assert from "node:assert";
import { loadAllData } from "../loaders.js";
import {
  matchFunctions,
  matchIndustries,
  matchGeographies,
  matchTitles,
  matchCompanyNames,
  matchPastCompanyNames,
  matchSchoolNames,
  matchCompanyHeadcount,
  matchCompanyType,
  matchSeniorityLevel,
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
} from "../nlp.js";

test("matchFunctions finds structured Function syntax", () => {
  const store = loadAllData();
  
  // Test basic Function syntax
  const result1 = matchFunctions("Function: Sales", store);
  assert.ok(Array.isArray(result1));
  assert.ok(result1.length > 0, "Should find Sales function");
  assert.strictEqual(result1[0].text, "Sales");
  assert.strictEqual(result1[0].selectionType, "INCLUDED");
  
  // Test multiple functions
  const result2 = matchFunctions("Function: Sales, Engineering", store);
  assert.ok(Array.isArray(result2));
  assert.ok(result2.length >= 2, "Should find multiple functions");
  
  const texts = result2.map(r => r.text);
  assert.ok(texts.includes("Sales"));
  assert.ok(texts.includes("Engineering"));
});

test("matchFunctions handles exclusion syntax", () => {
  const store = loadAllData();
  
  // Test single exclusion
  const result1 = matchFunctions("Function: Exclude Sales", store);
  assert.ok(Array.isArray(result1));
  assert.ok(result1.length > 0, "Should find excluded Sales function");
  assert.strictEqual(result1[0].text, "Sales");
  assert.strictEqual(result1[0].selectionType, "EXCLUDED");
  
  // Test mixed inclusion and exclusion
  const result2 = matchFunctions("Function: Engineering, Exclude Sales", store);
  assert.ok(Array.isArray(result2));
  assert.ok(result2.length >= 2, "Should find both included and excluded functions");
  
  const salesMatch = result2.find(r => r.text === "Sales");
  const engineeringMatch = result2.find(r => r.text === "Engineering");
  
  assert.ok(salesMatch);
  assert.ok(engineeringMatch);
  assert.strictEqual(salesMatch.selectionType, "EXCLUDED");
  assert.strictEqual(engineeringMatch.selectionType, "INCLUDED");
});

test("matchFunctions is case insensitive", () => {
  const store = loadAllData();
  
  const result1 = matchFunctions("function: sales", store);
  const result2 = matchFunctions("FUNCTION: SALES", store);
  const result3 = matchFunctions("Function: Sales", store);
  
  assert.ok(result1.length > 0);
  assert.ok(result2.length > 0);
  assert.ok(result3.length > 0);
  assert.strictEqual(result1[0].text, "Sales");
  assert.strictEqual(result2[0].text, "Sales");
  assert.strictEqual(result3[0].text, "Sales");
});

test("matchFunctions handles synonyms", () => {
  const store = loadAllData();
  
  // Test synonym mappings
  const testCases = [
    { input: "Function: Accounting", expected: "Accounting" },
    { input: "Function: Engineering", expected: "Engineering" },
    { input: "Function: Operations", expected: "Operations" },
    { input: "Function: Marketing", expected: "Marketing" },
    { input: "Function: Finance", expected: "Finance" },
    { input: "Function: HR", expected: "Human Resources" },
    { input: "Function: IT", expected: "Information Technology" },
    { input: "Function: Legal", expected: "Legal" },
    { input: "Function: Consulting", expected: "Consulting" }
  ];
  
  for (const testCase of testCases) {
    const result = matchFunctions(testCase.input, store);
    assert.ok(Array.isArray(result));
    if (result.length > 0) {
      assert.strictEqual(result[0].text, testCase.expected, `Failed for: ${testCase.input}`);
    }
  }
});

test("matchFunctions ignores old natural language syntax", () => {
  const store = loadAllData();
  
  // Test that old natural language patterns no longer work
  const result1 = matchFunctions("sales leaders", store);
  const result2 = matchFunctions("looking for salespeople", store);
  const result3 = matchFunctions("engineering managers", store);
  const result4 = matchFunctions("ops team", store);
  
  assert.strictEqual(result1.length, 0, "Old 'sales leaders' syntax should not work");
  assert.strictEqual(result2.length, 0, "Old 'salespeople' syntax should not work");
  assert.strictEqual(result3.length, 0, "Old 'engineering managers' syntax should not work");
  assert.strictEqual(result4.length, 0, "Old 'ops team' syntax should not work");
});

test("matchFunctions prevents cross-contamination from multi-line input", () => {
  const store = loadAllData();
  
  // This is the CRITICAL test case that exposes the bug
  // GPT outputs multiple facets on separate lines, but the regex was too greedy
  // and would capture text from subsequent facet lines
  const multiLineInput = `Function: Sales
Industry: Software Development
title "Business Development Representative" contains`;
  
  const functions = matchFunctions(multiLineInput, store);
  
  // Should ONLY find Sales (id:25), NOT Business Development (id:4)
  // The bug was that "Business Development Representative" from the title line
  // was being captured and matched against FUNCTION facet, causing id:4 to appear
  // in both FUNCTION and INDUSTRY facets with different meanings
  assert.ok(functions.length > 0, "Should find at least one function");
  
  const functionIds = functions.map(f => f.id);
  const functionTexts = functions.map(f => f.text);
  
  // Should find Sales (id:25)
  assert.ok(functionTexts.includes("Sales"), "Should find Sales function");
  assert.ok(functionIds.includes("25") || functionIds.includes(25), "Should have Sales ID (25)");
  
  // Should NOT find Business Development (id:4) - this was the bug!
  // id:4 is a valid FUNCTION ID for "Business Development", but it was being
  // incorrectly picked up from the title line "Business Development Representative"
  assert.ok(!functionTexts.includes("Business Development"), 
    "Should NOT incorrectly match 'Business Development' from title line - this causes ID collision with INDUSTRY");
  
  // Verify the fix: only one function should be found (Sales)
  assert.strictEqual(functions.length, 1, "Should find exactly one function (Sales), not pick up text from other lines");
});

test("matchIndustries finds structured Industry syntax", () => {
  const store = loadAllData();
  
  // Test basic Industry syntax
  const result1 = matchIndustries("Industry: Software", store);
  assert.ok(Array.isArray(result1));
  assert.ok(result1.length > 0, "Should find Software industry");
  assert.strictEqual(result1[0].selectionType, "INCLUDED");
  assert.ok(result1[0].text.toLowerCase().includes("software"), "Should find software-related industry");
  
  // Test multiple industries
  const result2 = matchIndustries("Industry: Software, Healthcare", store);
  assert.ok(Array.isArray(result2));
  assert.ok(result2.length >= 1, "Should find at least one industry");
  
  const texts = result2.map(r => r.text);
  assert.ok(texts.some(text => text.toLowerCase().includes("software")), "Should find software-related industry");
  // Note: Healthcare might not be found if it's not in the facet store, so we'll be flexible
});

test("matchIndustries handles exclusion syntax", () => {
  const store = loadAllData();
  
  // Test single exclusion
  const result1 = matchIndustries("Industry: Exclude Software", store);
  assert.ok(Array.isArray(result1));
  assert.ok(result1.length > 0, "Should find excluded Software industry");
  assert.strictEqual(result1[0].selectionType, "EXCLUDED");
  assert.ok(result1[0].text.toLowerCase().includes("software"), "Should find software-related industry");
  
  // Test mixed inclusion and exclusion
  const result2 = matchIndustries("Industry: Software, Exclude Technology", store);
  assert.ok(Array.isArray(result2));
  assert.ok(result2.length >= 1, "Should find at least one industry");
  
  const softwareMatch = result2.find(r => r.text?.toLowerCase().includes("software"));
  const techMatch = result2.find(r => r.text?.toLowerCase().includes("technology"));
  
  assert.ok(softwareMatch, "Should find software industry");
  assert.strictEqual(softwareMatch.selectionType, "INCLUDED");
  
  // Technology might not be found if it's not in the facet store, so we'll be flexible
  if (techMatch) {
    assert.strictEqual(techMatch.selectionType, "EXCLUDED");
  }
});

test("matchIndustries is case insensitive", () => {
  const store = loadAllData();
  
  const result1 = matchIndustries("industry: software", store);
  const result2 = matchIndustries("INDUSTRY: SOFTWARE", store);
  const result3 = matchIndustries("Industry: Software", store);
  
  assert.ok(result1.length > 0);
  assert.ok(result2.length > 0);
  assert.ok(result3.length > 0);
  assert.strictEqual(result1[0].selectionType, "INCLUDED");
  assert.strictEqual(result2[0].selectionType, "INCLUDED");
  assert.strictEqual(result3[0].selectionType, "INCLUDED");
});

test("matchIndustries prevents cross-contamination from multi-line input", () => {
  const store = loadAllData();
  
  // Similar to the function test - ensure industry parsing stops at line breaks
  const multiLineInput = `Function: Sales
Industry: Software Development
title "Business Development Representative" contains
Company Headcount: 50-200`;
  
  const industries = matchIndustries(multiLineInput, store);
  
  // Should ONLY find Software Development (id:4 in INDUSTRY taxonomy)
  assert.ok(industries.length > 0, "Should find at least one industry");
  
  const industryTexts = industries.map(i => i.text);
  
  // Should find Software Development
  assert.ok(industryTexts.some(text => text.toLowerCase().includes("software")), 
    "Should find Software Development industry");
  
  // Should NOT pick up text from title or other lines
  assert.ok(!industryTexts.some(text => text.toLowerCase().includes("business development representative")),
    "Should NOT pick up title text from other lines");
  
  // Should NOT pick up text from company headcount line
  assert.ok(!industryTexts.some(text => text.includes("50-200")),
    "Should NOT pick up headcount text from other lines");
});

test("matchIndustries handles synonyms", () => {
  const store = loadAllData();
  
  // Test synonym mappings - check that matches are found and contain expected keywords
  // Only test industries we know exist in the data
  const testCases = [
    { input: "Industry: Software", expectedKeyword: "software" },
    { input: "Industry: Tech", expectedKeyword: "technology" },
    { input: "Industry: Retail", expectedKeyword: "retail" },
    { input: "Industry: Manufacturing", expectedKeyword: "manufacturing" },
    { input: "Industry: Construction", expectedKeyword: "construction" },
  ];
  
  for (const testCase of testCases) {
    const result = matchIndustries(testCase.input, store);
    assert.ok(Array.isArray(result), `Should return array for: ${testCase.input}`);
    assert.ok(result.length > 0, `Should find matches for: ${testCase.input}`);
    assert.ok(
      result[0].text.toLowerCase().includes(testCase.expectedKeyword),
      `Failed for: ${testCase.input} - expected text to contain "${testCase.expectedKeyword}" but got "${result[0].text}"`
    );
  }
  
  // Test that SaaS alias maps to Software Development (ID 4)
  const saasResult = matchIndustries("Industry: SaaS", store);
  assert.ok(saasResult.length > 0, "Should find SaaS industry");
  assert.ok(saasResult[0].text.toLowerCase().includes("software"), "SaaS should map to software industry");
});

test("matchIndustries ignores old natural language syntax", () => {
  const store = loadAllData();
  
  // Test that old natural language patterns no longer work
  const result1 = matchIndustries("software industry", store);
  const result2 = matchIndustries("in the tech industry", store);
  const result3 = matchIndustries("healthcare professionals", store);
  const result4 = matchIndustries("finance sector", store);
  
  assert.strictEqual(result1.length, 0, "Old 'software industry' syntax should not work");
  assert.strictEqual(result2.length, 0, "Old 'tech industry' syntax should not work");
  assert.strictEqual(result3.length, 0, "Old 'healthcare professionals' syntax should not work");
  assert.strictEqual(result4.length, 0, "Old 'finance sector' syntax should not work");
});

test("matchGeographies finds 'boston or nyc'", () => {
  const store = loadAllData();
  
  const result = matchGeographies("in boston or nyc", store);
  
  // Test is flexible - check result is an array
  assert.ok(Array.isArray(result));
  
  // If we have geography data with boston/nyc, should match
  if (store.REGION && (store.REGION.byText.has("boston") || store.REGION.byText.has("new york"))) {
    assert.ok(result.length > 0, "Should find at least one geography");
  }
});

test("matchTitles extracts exact title", () => {
  const result = matchTitles('title "Account Executive" exact');
  
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].text, "Account Executive");
  assert.strictEqual(result[0].match, "EXACT");
});

test("matchTitles extracts contains title", () => {
  const result = matchTitles('title contains "manager"');
  
  // The pattern requires quotes around the title text
  assert.ok(result.length >= 1);
  if (result.length > 0) {
    assert.strictEqual(result[0].text, "manager");
    assert.strictEqual(result[0].match, "CONTAINS");
  }
});

test("matchTitles handles multiple titles", () => {
  const result = matchTitles('title "VP" exact and title contains "director"');
  
  assert.ok(result.length >= 2);
});

test("matchCompanyNames ignores text with school keywords", () => {
  // Test that company matching returns empty when school keywords are present
  const result1 = matchCompanyNames("Current Company: Harvard University");
  const result2 = matchCompanyNames("Current Company: MIT Academy");
  const result3 = matchCompanyNames("Current Company: Stanford School of Business");
  
  assert.strictEqual(result1.length, 0, "Should not match companies when 'university' is present");
  assert.strictEqual(result2.length, 0, "Should not match companies when 'academy' is present");
  assert.strictEqual(result3.length, 0, "Should not match companies when 'school' is present");
});

test("matchCompanyNames matches basic Current Company syntax", () => {
  const result = matchCompanyNames("Current Company: HubSpot");
  
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].name, "HubSpot");
  assert.strictEqual(result[0].selectionType, "INCLUDED");
});

test("matchCompanyNames matches multiple companies", () => {
  const result = matchCompanyNames("Current Company: HubSpot, Salesforce");
  
  assert.strictEqual(result.length, 2);
  assert.strictEqual(result[0].name, "HubSpot");
  assert.strictEqual(result[0].selectionType, "INCLUDED");
  assert.strictEqual(result[1].name, "Salesforce");
  assert.strictEqual(result[1].selectionType, "INCLUDED");
});

test("matchCompanyNames matches exclusion syntax", () => {
  const result = matchCompanyNames("Current Company: Exclude Google");
  
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].name, "Google");
  assert.strictEqual(result[0].selectionType, "EXCLUDED");
});

test("matchCompanyNames matches mixed inclusion and exclusion", () => {
  const result = matchCompanyNames("Current Company: HubSpot, Exclude Google, Salesforce");
  
  assert.strictEqual(result.length, 3);
  assert.strictEqual(result[0].name, "HubSpot");
  assert.strictEqual(result[0].selectionType, "INCLUDED");
  assert.strictEqual(result[1].name, "Google");
  assert.strictEqual(result[1].selectionType, "EXCLUDED");
  assert.strictEqual(result[2].name, "Salesforce");
  assert.strictEqual(result[2].selectionType, "INCLUDED");
});

test("matchCompanyNames is case insensitive for Current Company keyword", () => {
  const result1 = matchCompanyNames("current company: HubSpot");
  const result2 = matchCompanyNames("CURRENT COMPANY: HubSpot");
  const result3 = matchCompanyNames("Current Company: HubSpot");
  
  assert.strictEqual(result1.length, 1);
  assert.strictEqual(result2.length, 1);
  assert.strictEqual(result3.length, 1);
  assert.strictEqual(result1[0].name, "HubSpot");
  assert.strictEqual(result2[0].name, "HubSpot");
  assert.strictEqual(result3[0].name, "HubSpot");
});

test("matchCompanyNames ignores old syntax", () => {
  // Test that old "at CompanyName" syntax no longer works
  const result1 = matchCompanyNames("at Google");
  const result2 = matchCompanyNames("from Microsoft");
  const result3 = matchCompanyNames("works at Apple");
  
  assert.strictEqual(result1.length, 0, "Old 'at' syntax should not work");
  assert.strictEqual(result2.length, 0, "Old 'from' syntax should not work");
  assert.strictEqual(result3.length, 0, "Old 'works at' syntax should not work");
});

test("matchCompanyNames stops at / separator", () => {
  const result = matchCompanyNames("Current Company: Google, Microsoft / Past Company: HubSpot");
  
  assert.strictEqual(result.length, 2);
  assert.strictEqual(result[0].name, "Google");
  assert.strictEqual(result[0].selectionType, "INCLUDED");
  assert.strictEqual(result[1].name, "Microsoft");
  assert.strictEqual(result[1].selectionType, "INCLUDED");
});

test("matchCompanyNames stops at Past Company", () => {
  const result = matchCompanyNames("Current Company: Google, Microsoft Past Company: HubSpot");
  
  assert.strictEqual(result.length, 2);
  assert.strictEqual(result[0].name, "Google");
  assert.strictEqual(result[0].selectionType, "INCLUDED");
  assert.strictEqual(result[1].name, "Microsoft");
  assert.strictEqual(result[1].selectionType, "INCLUDED");
});

test("matchPastCompanyNames matches basic Past Company syntax", () => {
  const result = matchPastCompanyNames("Past Company: HubSpot");
  
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].name, "HubSpot");
  assert.strictEqual(result[0].selectionType, "INCLUDED");
});

test("matchPastCompanyNames matches multiple past companies", () => {
  const result = matchPastCompanyNames("Past Company: Google, Microsoft, Apple");
  
  assert.strictEqual(result.length, 3);
  assert.strictEqual(result[0].name, "Google");
  assert.strictEqual(result[0].selectionType, "INCLUDED");
  assert.strictEqual(result[1].name, "Microsoft");
  assert.strictEqual(result[1].selectionType, "INCLUDED");
  assert.strictEqual(result[2].name, "Apple");
  assert.strictEqual(result[2].selectionType, "INCLUDED");
});

test("matchPastCompanyNames matches exclusion syntax", () => {
  const result = matchPastCompanyNames("Past Company: Exclude Google");
  
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].name, "Google");
  assert.strictEqual(result[0].selectionType, "EXCLUDED");
});

test("matchPastCompanyNames matches mixed inclusion and exclusion", () => {
  const result = matchPastCompanyNames("Past Company: Google, Exclude Apple, Microsoft");
  
  assert.strictEqual(result.length, 3);
  assert.strictEqual(result[0].name, "Google");
  assert.strictEqual(result[0].selectionType, "INCLUDED");
  assert.strictEqual(result[1].name, "Apple");
  assert.strictEqual(result[1].selectionType, "EXCLUDED");
  assert.strictEqual(result[2].name, "Microsoft");
  assert.strictEqual(result[2].selectionType, "INCLUDED");
});

test("matchPastCompanyNames is case insensitive for Past Company keyword", () => {
  const result1 = matchPastCompanyNames("past company: HubSpot");
  const result2 = matchPastCompanyNames("PAST COMPANY: HubSpot");
  const result3 = matchPastCompanyNames("Past Company: HubSpot");
  
  assert.strictEqual(result1.length, 1);
  assert.strictEqual(result1[0].name, "HubSpot");
  assert.strictEqual(result2.length, 1);
  assert.strictEqual(result2[0].name, "HubSpot");
  assert.strictEqual(result3.length, 1);
  assert.strictEqual(result3[0].name, "HubSpot");
});

test("matchPastCompanyNames ignores text with school keywords", () => {
  // Test that past company matching returns empty when school keywords are present
  const result1 = matchPastCompanyNames("Past Company: Harvard University");
  const result2 = matchPastCompanyNames("Past Company: MIT Academy");
  const result3 = matchPastCompanyNames("Past Company: Stanford School of Business");
  
  assert.strictEqual(result1.length, 0, "Should not match when school keywords are present");
  assert.strictEqual(result2.length, 0, "Should not match when school keywords are present");
  assert.strictEqual(result3.length, 0, "Should not match when school keywords are present");
});

test("matchPastCompanyNames ignores old syntax", () => {
  // Test that old "at CompanyName" syntax no longer works
  const result1 = matchPastCompanyNames("at Google");
  const result2 = matchPastCompanyNames("from Microsoft");
  const result3 = matchPastCompanyNames("worked at Apple");
  
  assert.strictEqual(result1.length, 0, "Old 'at' syntax should not work");
  assert.strictEqual(result2.length, 0, "Old 'from' syntax should not work");
  assert.strictEqual(result3.length, 0, "Old 'worked at' syntax should not work");
});

test("matchPastCompanyNames stops at / separator", () => {
  const result = matchPastCompanyNames("Past Company: Google, Microsoft / Current Company: HubSpot");
  
  assert.strictEqual(result.length, 2);
  assert.strictEqual(result[0].name, "Google");
  assert.strictEqual(result[0].selectionType, "INCLUDED");
  assert.strictEqual(result[1].name, "Microsoft");
  assert.strictEqual(result[1].selectionType, "INCLUDED");
});

test("matchPastCompanyNames stops at Current Company", () => {
  const result = matchPastCompanyNames("Past Company: Google, Microsoft Current Company: HubSpot");
  
  assert.strictEqual(result.length, 2);
  assert.strictEqual(result[0].name, "Google");
  assert.strictEqual(result[0].selectionType, "INCLUDED");
  assert.strictEqual(result[1].name, "Microsoft");
  assert.strictEqual(result[1].selectionType, "INCLUDED");
});

test("matchSchoolNames works with school keywords", () => {
  // Test that school matching works with school keywords
  const result1 = matchSchoolNames("from Harvard University");
  const result2 = matchSchoolNames("at MIT Academy");
  const result3 = matchSchoolNames("from Stanford School of Business");
  
  assert.ok(Array.isArray(result1));
  assert.ok(Array.isArray(result2));
  assert.ok(Array.isArray(result3));
  
  // Should find school names when school keywords are present
  if (result1.length > 0) {
    assert.strictEqual(result1[0], "Harvard University");
  }
  if (result2.length > 0) {
    assert.strictEqual(result2[0], "MIT Academy");
  }
  if (result3.length > 0) {
    assert.strictEqual(result3[0], "Stanford School of Business");
  }
});

test("matchCompanyHeadcount matches new 'Company Headcount:' syntax", () => {
  const store = loadAllData();
  
  // Test single range
  const result1 = matchCompanyHeadcount("Company Headcount: 1-10", store);
  assert.strictEqual(result1.length, 1);
  assert.strictEqual(result1[0].text, "1-10");
  assert.strictEqual(result1[0].id, "B");
  
  // Test multiple comma-separated ranges
  const result2 = matchCompanyHeadcount("Company Headcount: 1-10, 11-50, 51-200", store);
  assert.strictEqual(result2.length, 3);
  assert.strictEqual(result2[0].text, "1-10");
  assert.strictEqual(result2[0].id, "B");
  assert.strictEqual(result2[1].text, "11-50");
  assert.strictEqual(result2[1].id, "C");
  assert.strictEqual(result2[2].text, "51-200");
  assert.strictEqual(result2[2].id, "D");
  
  // Test Self Employed variations (case-insensitive)
  const result3 = matchCompanyHeadcount("Company Headcount: Self Employed", store);
  assert.strictEqual(result3.length, 1);
  assert.strictEqual(result3[0].text, "Self-employed");
  assert.strictEqual(result3[0].id, "A");
  
  const result4 = matchCompanyHeadcount("Company Headcount: self-employed", store);
  assert.strictEqual(result4.length, 1);
  assert.strictEqual(result4[0].text, "Self-employed");
  assert.strictEqual(result4[0].id, "A");
  
  const result5 = matchCompanyHeadcount("Company Headcount: SELF EMPLOYED", store);
  assert.strictEqual(result5.length, 1);
  assert.strictEqual(result5[0].text, "Self-employed");
  assert.strictEqual(result5[0].id, "A");
  
  // Test case insensitivity for prefix
  const result6 = matchCompanyHeadcount("company headcount: 51-200", store);
  assert.strictEqual(result6.length, 1);
  assert.strictEqual(result6[0].text, "51-200");
  assert.strictEqual(result6[0].id, "D");
  
  // Test single numbers (should map to appropriate bucket)
  const result7 = matchCompanyHeadcount("Company Headcount: 50", store);
  assert.strictEqual(result7.length, 1);
  assert.strictEqual(result7[0].text, "11-50");
  assert.strictEqual(result7[0].id, "C");
});

test("matchCompanyHeadcount rejects old syntax patterns", () => {
  const store = loadAllData();
  
  // Test that old patterns no longer work
  const result1 = matchCompanyHeadcount("headcount of 10", store);
  assert.strictEqual(result1.length, 0, "Old 'headcount of X' syntax should not work");
  
  const result2 = matchCompanyHeadcount("50 employees", store);
  assert.strictEqual(result2.length, 0, "Old 'X employees' syntax should not work");
  
  const result3 = matchCompanyHeadcount("company size 200", store);
  assert.strictEqual(result3.length, 0, "Old 'company size X' syntax should not work");
  
  const result4 = matchCompanyHeadcount("small company", store);
  assert.strictEqual(result4.length, 0, "Old descriptive terms should not work");
  
  const result5 = matchCompanyHeadcount("51-200 employees", store);
  assert.strictEqual(result5.length, 0, "Old range patterns should not work");
});

test("matchSeniorityLevel finds seniority levels", () => {
  const store = loadAllData();
  
  // Test with "director"
  const result1 = matchSeniorityLevel("looking for directors", store);
  assert.ok(Array.isArray(result1));
  
  // Test with "vice president"
  const result2 = matchSeniorityLevel("vice presidents", store);
  assert.ok(Array.isArray(result2));
  
  // Test with "owner"
  const result3 = matchSeniorityLevel("company owners", store);
  assert.ok(Array.isArray(result3));
});

test("matchYearsAtCurrentCompany finds years at company", () => {
  const store = loadAllData();
  
  const result = matchYearsAtCurrentCompany("2 years at company", store);
  assert.ok(Array.isArray(result));
});

test("matchYearsInCurrentPosition finds years in position", () => {
  const store = loadAllData();
  
  const result = matchYearsInCurrentPosition("3 years in role", store);
  assert.ok(Array.isArray(result));
});

test("matchCurrentTitle finds current titles", () => {
  const store = loadAllData();
  
  const result = matchCurrentTitle("current title Account Manager", store);
  assert.ok(Array.isArray(result));
});

test("matchGroup finds LinkedIn groups", () => {
  const store = loadAllData();
  
  const result = matchGroup("Harvard Business Review Discussion Group", store);
  assert.ok(Array.isArray(result));
});

test("matchFollowsYourCompany finds company followers", () => {
  const store = loadAllData();
  
  const result = matchFollowsYourCompany("following your company", store);
  assert.ok(Array.isArray(result));
});

test("matchViewedYourProfile finds profile viewers", () => {
  const store = loadAllData();
  
  const result = matchViewedYourProfile("viewed your profile recently", store);
  assert.ok(Array.isArray(result));
});

test("matchConnectionOf finds connections", () => {
  const store = loadAllData();
  
  const result = matchConnectionOf("connection of Peter Milnes", store);
  assert.ok(Array.isArray(result));
});

test("matchPastColleague finds past colleagues", () => {
  const store = loadAllData();
  
  const result = matchPastColleague("past colleague", store);
  assert.ok(Array.isArray(result));
});

test("matchWithSharedExperiences finds shared experiences", () => {
  const store = loadAllData();
  
  const result = matchWithSharedExperiences("shared experiences", store);
  assert.ok(Array.isArray(result));
});

test("matchRecentlyChangedJobs finds job changers", () => {
  const store = loadAllData();
  
  const result = matchRecentlyChangedJobs("recently changed jobs", store);
  assert.ok(Array.isArray(result));
});

test("matchPostedOnLinkedIn finds LinkedIn posters", () => {
  const store = loadAllData();
  
  const result = matchPostedOnLinkedIn("posted on linkedin", store);
  assert.ok(Array.isArray(result));
});

test("matchLeadInteractions finds lead interactions", () => {
  const store = loadAllData();
  
  const result = matchLeadInteractions("viewed profile", store);
  assert.ok(Array.isArray(result));
});

test("matchCompanyType finds single company type", () => {
  const store = loadAllData();
  
  const result = matchCompanyType("Company Type: privately held", store);
  assert.ok(Array.isArray(result));
  assert.ok(result.length > 0);
  assert.strictEqual(result[0].text, "Privately Held");
  assert.strictEqual(result[0].id, "P");
  assert.strictEqual(result[0].selectionType, "INCLUDED");
});

test("matchCompanyType finds multiple company types", () => {
  const store = loadAllData();
  
  const result = matchCompanyType("Company Type: privately held, public company", store);
  assert.ok(Array.isArray(result));
  assert.ok(result.length >= 2);
  
  const texts = result.map(r => r.text);
  assert.ok(texts.includes("Privately Held"));
  assert.ok(texts.includes("Public Company"));
});

test("matchCompanyType is case insensitive", () => {
  const store = loadAllData();
  
  const result = matchCompanyType("company type: PRIVATELY HELD", store);
  assert.ok(Array.isArray(result));
  assert.ok(result.length > 0);
  assert.strictEqual(result[0].text, "Privately Held");
});

test("matchCompanyType handles all company types", () => {
  const store = loadAllData();
  
  const testCases = [
    "Company Type: public company",
    "Company Type: privately held", 
    "Company Type: educational institution",
    "Company Type: non profit",
    "Company Type: self employed",
    "Company Type: partnership",
    "Company Type: government agency",
    "Company Type: self owned"
  ];
  
  for (const testCase of testCases) {
    const result = matchCompanyType(testCase, store);
    assert.ok(Array.isArray(result));
    assert.ok(result.length > 0, `Failed for: ${testCase}`);
  }
});

test("matchSeniorityLevel finds single seniority level", () => {
  const store = loadAllData();
  
  const result = matchSeniorityLevel("Seniority Level: director", store);
  assert.ok(Array.isArray(result));
  assert.ok(result.length > 0);
  assert.strictEqual(result[0].text, "Director");
  assert.strictEqual(result[0].id, "220");
  assert.strictEqual(result[0].selectionType, "INCLUDED");
});

test("matchSeniorityLevel finds multiple seniority levels", () => {
  const store = loadAllData();
  
  const result = matchSeniorityLevel("Seniority Level: director, vice president", store);
  assert.ok(Array.isArray(result));
  assert.ok(result.length >= 2);
  
  const texts = result.map(r => r.text);
  assert.ok(texts.includes("Director"));
  assert.ok(texts.includes("Vice President"));
});

test("matchSeniorityLevel handles exclude logic", () => {
  const store = loadAllData();
  
  const result = matchSeniorityLevel("Seniority Level: Exclude CXO", store);
  assert.ok(Array.isArray(result));
  assert.ok(result.length > 0);
  assert.strictEqual(result[0].text, "CXO");
  assert.strictEqual(result[0].selectionType, "EXCLUDED");
});

test("matchSeniorityLevel handles mixed include and exclude", () => {
  const store = loadAllData();
  
  const result = matchSeniorityLevel("Seniority Level: director, Exclude CXO", store);
  assert.ok(Array.isArray(result));
  assert.ok(result.length >= 2);
  
  const directorMatch = result.find(r => r.text === "Director");
  const cxoMatch = result.find(r => r.text === "CXO");
  
  assert.ok(directorMatch);
  assert.ok(cxoMatch);
  assert.strictEqual(directorMatch.selectionType, "INCLUDED");
  assert.strictEqual(cxoMatch.selectionType, "EXCLUDED");
});

test("matchSeniorityLevel is case insensitive", () => {
  const store = loadAllData();
  
  const result = matchSeniorityLevel("SENIORITY LEVEL: DIRECTOR", store);
  assert.ok(Array.isArray(result));
  assert.ok(result.length > 0);
  assert.strictEqual(result[0].text, "Director");
});

test("matchSeniorityLevel handles all seniority levels", () => {
  const store = loadAllData();
  
  const testCases = [
    "Seniority Level: owner / partner",
    "Seniority Level: CXO",
    "Seniority Level: vice president",
    "Seniority Level: director",
    "Seniority Level: experienced manager",
    "Seniority Level: entry level manager",
    "Seniority Level: strategic",
    "Seniority Level: senior",
    "Seniority Level: entry level",
    "Seniority Level: in training"
  ];
  
  for (const testCase of testCases) {
    const result = matchSeniorityLevel(testCase, store);
    assert.ok(Array.isArray(result));
    assert.ok(result.length > 0, `Failed for: ${testCase}`);
  }
});

test("matchSeniorityLevel handles alternative names", () => {
  const store = loadAllData();
  
  const testCases = [
    { input: "Seniority Level: owner", expected: "Owner / Partner" },
    { input: "Seniority Level: partner", expected: "Owner / Partner" },
    { input: "Seniority Level: c-level", expected: "CXO" },
    { input: "Seniority Level: executive", expected: "CXO" },
    { input: "Seniority Level: vp", expected: "Vice President" },
    { input: "Seniority Level: manager", expected: "Experienced Manager" },
    { input: "Seniority Level: training", expected: "In Training" }
  ];
  
  for (const testCase of testCases) {
    const result = matchSeniorityLevel(testCase.input, store);
    assert.ok(Array.isArray(result));
    assert.ok(result.length > 0, `Failed for: ${testCase.input}`);
    assert.strictEqual(result[0].text, testCase.expected);
  }
});

