/**
 * Integration test for "Startup CEOs in MA/CT/RI" scenario
 * 
 * This test runs the full pipeline end-to-end with artifact output
 * to validate the complete URL generation process.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { buildDslFromMatches, buildPeopleSearchUrl } from "../dsl.js";

describe("Integration: Startup CEOs in MA/CT/RI", () => {
  it("should generate correct URL with all intermediate artifacts", () => {
    // === ARTIFACT 1: Raw Boolean String (pre-encoding) ===
    const rawBoolean = '("startup" OR "early stage")';
    console.log("\n=== ARTIFACT 1: Raw Boolean String ===");
    console.log(rawBoolean);

    // Simulate matches from the generator (after NLP processing)
    // The KEYWORD field should contain the RAW (unencoded) boolean string
    // The DSL builder will do the inner-encoding
    const matches = {
      KEYWORD: [rawBoolean],
      TITLE: [{ text: "Chief Executive Officer", match: "CONTAINS" as const }],
      COMPANY_TYPE: [{ id: "P", text: "Privately Held", selectionType: "INCLUDED" as const }],
      COMPANY_HEADCOUNT: [
        { id: "B", text: "1-10", selectionType: "INCLUDED" as const },
        { id: "C", text: "11-50", selectionType: "INCLUDED" as const },
        { id: "D", text: "51-200", selectionType: "INCLUDED" as const }
      ],
      REGION: [
        { id: 101098412, text: "Massachusetts" },
        { id: 106914527, text: "Connecticut" },
        { id: 104877241, text: "Rhode Island" }
      ]
    };

    // === ARTIFACT 2: Raw DSL (outer-decoded) ===
    const rawDsl = buildDslFromMatches(matches);
    console.log("\n=== ARTIFACT 2: Raw DSL (outer-decoded) ===");
    console.log(rawDsl);
    
    // The keywords in the raw DSL should be inner-encoded
    // Extract keywords value from DSL (keywords: up to ,filters:)
    const keywordsMatch = rawDsl.match(/keywords:(.+?),filters:/);
    const innerEncodedKeywords = keywordsMatch ? keywordsMatch[1] : "";
    console.log("\n=== Inner-encoded Keywords (extracted from DSL) ===");
    console.log(innerEncodedKeywords);
    
    // Verify inner-encoding encodes quotes and spaces (parentheses are NOT encoded by encodeURIComponent)
    assert.ok(innerEncodedKeywords.includes("%22"), "Inner encoding should encode quotes");
    assert.ok(innerEncodedKeywords.includes("%20"), "Inner encoding should encode spaces");
    assert.ok(innerEncodedKeywords.startsWith("("), "Keywords boolean should start with parenthesis");
    assert.ok(innerEncodedKeywords.endsWith(")"), "Keywords boolean should end with parenthesis");
    
    // Verify DSL structure
    assert.ok(rawDsl.includes("spellCorrectionEnabled:true"), "DSL should have spellCorrectionEnabled");
    assert.ok(rawDsl.includes("keywords:"), "DSL should have keywords");
    assert.ok(rawDsl.includes("filters:List"), "DSL should have filters:List");
    
    // Verify facet presence
    assert.ok(rawDsl.includes("type:TITLE"), "DSL should have TITLE facet");
    assert.ok(rawDsl.includes("type:COMPANY_TYPE"), "DSL should have COMPANY_TYPE facet");
    assert.ok(rawDsl.includes("type:COMPANY_HEADCOUNT"), "DSL should have COMPANY_HEADCOUNT facet");
    assert.ok(rawDsl.includes("type:REGION"), "DSL should have REGION facet");
    
    // CRITICAL: Verify NO SENIORITY_LEVEL or FUNCTION for CEO
    assert.ok(!rawDsl.includes("SENIORITY_LEVEL"), "CEO should NOT have SENIORITY_LEVEL");
    assert.ok(!rawDsl.includes("FUNCTION"), "CEO should NOT have FUNCTION");
    
    // Verify correct REGION IDs
    assert.ok(rawDsl.includes("id:101098412"), "Should have MA (101098412)");
    assert.ok(rawDsl.includes("id:106914527"), "Should have CT (106914527)");
    assert.ok(rawDsl.includes("id:104877241"), "Should have RI (104877241)");
    
    // Verify REGION format (only id, no text/selectionType)
    const regionMatch = rawDsl.match(/type:REGION,values:List\(([^)]+)\)/);
    assert.ok(regionMatch, "Should find REGION facet block");
    const regionBlock = regionMatch![1];
    assert.ok(!regionBlock.includes("text:"), "REGION should not have text field");
    assert.ok(!regionBlock.includes("selectionType:"), "REGION should not have selectionType field");

    // === ARTIFACT 3: Final URL ===
    const finalUrl = buildPeopleSearchUrl(rawDsl);
    console.log("\n=== ARTIFACT 3: Final URL ===");
    console.log(finalUrl);
    
    // Verify URL structure
    assert.ok(finalUrl.startsWith("https://www.linkedin.com/sales/search/people?query="), 
      "URL should start with correct base");
    assert.ok(finalUrl.includes("viewAllFilters=true"), "URL should have viewAllFilters=true");
    
    // Verify outer encoding
    const queryParam = new URL(finalUrl).searchParams.get("query");
    assert.ok(queryParam, "URL should have query parameter");
    assert.ok(queryParam!.startsWith("("), "Query param should start with ( after decoding");
    
    // Verify double-encoding (inner %20 becomes %2520 after outer encoding)
    assert.ok(finalUrl.includes("%2520"), "Final URL should show double-encoded spaces (%2520)");
    assert.ok(finalUrl.includes("%28"), "Final URL should have outer-encoded opening paren");
    assert.ok(finalUrl.includes("%29"), "Final URL should have outer-encoded closing paren");
    
    // === SUMMARY ===
    console.log("\n=== VALIDATION SUMMARY ===");
    console.log("✅ Raw boolean string constructed");
    console.log("✅ Keywords inner-encoded");
    console.log("✅ DSL contains correct facets");
    console.log("✅ NO SENIORITY_LEVEL for CEO");
    console.log("✅ NO FUNCTION for CEO");
    console.log("✅ REGION IDs: MA (101098412), CT (106914527), RI (104877241)");
    console.log("✅ REGION format: only id (no text/selectionType)");
    console.log("✅ URL outer-encoded with double-encoding for keywords");
    console.log("✅ All validations passed");
  });

  it("should handle explicit Function request for CEO", () => {
    // When user explicitly requests "Function: Operations" for a CEO
    const matches = {
      TITLE: [{ text: "CEO", match: "CONTAINS" as const }],
      FUNCTION: [{ id: 18, text: "Operations", selectionType: "INCLUDED" as const }]
    };
    
    const rawDsl = buildDslFromMatches(matches);
    
    // When explicitly requested, FUNCTION should be present
    assert.ok(rawDsl.includes("type:FUNCTION"), "Explicitly requested FUNCTION should be included");
    assert.ok(rawDsl.includes("id:18"), "Should have Operations (id:18)");
  });

  it("should handle explicit Seniority Level request for CEO", () => {
    // When user explicitly requests "Seniority Level: CXO" for a CEO
    const matches = {
      TITLE: [{ text: "Chief Executive Officer", match: "CONTAINS" as const }],
      SENIORITY_LEVEL: [{ id: 310, text: "CXO", selectionType: "INCLUDED" as const }]
    };
    
    const rawDsl = buildDslFromMatches(matches);
    
    // When explicitly requested, SENIORITY_LEVEL should be present
    assert.ok(rawDsl.includes("type:SENIORITY_LEVEL"), "Explicitly requested SENIORITY_LEVEL should be included");
    assert.ok(rawDsl.includes("id:310"), "Should have CXO (id:310)");
  });

  it("should validate facet ordering", () => {
    const matches = {
      INDUSTRY: [{ id: 4, text: "Software", selectionType: "INCLUDED" as const }],
      TITLE: [{ text: "CEO", match: "CONTAINS" as const }],
      REGION: [{ id: 101098412, text: "Massachusetts" }],
      COMPANY_HEADCOUNT: [{ id: "D", text: "51-200", selectionType: "INCLUDED" as const }],
      COMPANY_TYPE: [{ id: "P", text: "Privately Held", selectionType: "INCLUDED" as const }]
    };
    
    const rawDsl = buildDslFromMatches(matches);
    
    // Extract facet types in order they appear
    const facetTypeMatches = [...rawDsl.matchAll(/type:([A-Z_]+)/g)];
    const facetTypes = facetTypeMatches.map(m => m[1]);
    
    // Verify stable ordering: TITLE, FUNCTION, REGION, SENIORITY_LEVEL, COMPANY_TYPE, COMPANY_HEADCOUNT, YEARS_OF_EXPERIENCE, INDUSTRY
    const expectedOrder = ["TITLE", "REGION", "COMPANY_TYPE", "COMPANY_HEADCOUNT", "INDUSTRY"];
    
    let expectedIdx = 0;
    for (const facetType of facetTypes) {
      if (facetType === expectedOrder[expectedIdx]) {
        expectedIdx++;
      }
    }
    
    assert.strictEqual(expectedIdx, expectedOrder.length, 
      "Facets should appear in the expected order");
  });
});

