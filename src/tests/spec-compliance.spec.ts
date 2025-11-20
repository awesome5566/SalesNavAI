/**
 * Specification Compliance Tests
 * 
 * These tests validate that the URL generator follows the exact contract
 * specified in the requirements document.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { facetBlockIdBased, facetBlockTextBased, buildPeopleSearchUrl, buildDslFromMatches } from "../dsl.js";
import type { MatchedValue, FreeTextValue } from "../types.js";

describe("Spec: REGION Facet Format", () => {
  it("should include id, text (inner-encoded), and selectionType (per LinkedIn format)", () => {
    const values: MatchedValue[] = [
      { id: 102277331, text: "San Francisco Bay Area", selectionType: "INCLUDED" }
    ];
    
    const result = facetBlockIdBased("REGION", values);
    
    // Per LinkedIn's actual URLs: REGION should have id, text, and selectionType
    assert.strictEqual(result, "(type:REGION,values:List((id:102277331,text:San%20Francisco%20Bay%20Area,selectionType:INCLUDED)))");
    assert.ok(result.includes("text:"), "REGION should include text field to match LinkedIn format");
    assert.ok(result.includes("selectionType:"), "REGION should include selectionType field to match LinkedIn format");
  });

  it("should handle multiple REGION IDs correctly", () => {
    const values: MatchedValue[] = [
      { id: 101098412, text: "Massachusetts" },
      { id: 106914527, text: "Connecticut" },
      { id: 104877241, text: "Rhode Island" }
    ];
    
    const result = facetBlockIdBased("REGION", values);
    
    assert.strictEqual(result, "(type:REGION,values:List((id:101098412,text:Massachusetts,selectionType:INCLUDED),(id:106914527,text:Connecticut,selectionType:INCLUDED),(id:104877241,text:Rhode%20Island,selectionType:INCLUDED)))");
    assert.ok(result.includes("text:"));
    assert.ok(result.includes("selectionType:"));
  });
});

describe("Spec: TITLE Facet Format", () => {
  it("should include text and match fields", () => {
    const values: FreeTextValue[] = [
      { text: "Sales Development Representative", match: "CONTAINS" }
    ];
    
    const result = facetBlockTextBased("TITLE", values);
    
    assert.strictEqual(result, "(type:TITLE,values:List((text:Sales Development Representative,match:CONTAINS)))");
    assert.ok(result.includes("text:"));
    assert.ok(result.includes("match:"));
  });

  it("should support EXACT match", () => {
    const values: FreeTextValue[] = [
      { text: "CEO", match: "EXACT" }
    ];
    
    const result = facetBlockTextBased("TITLE", values);
    
    assert.strictEqual(result, "(type:TITLE,values:List((text:CEO,match:EXACT)))");
  });
});

describe("Spec: ID-Based Facets (non-REGION)", () => {
  it("FUNCTION should include id and selectionType", () => {
    const values: MatchedValue[] = [
      { id: 25, text: "Sales", selectionType: "INCLUDED" }
    ];
    
    const result = facetBlockIdBased("FUNCTION", values);
    
    assert.strictEqual(result, "(type:FUNCTION,values:List((id:25,selectionType:INCLUDED)))");
    assert.ok(result.includes("id:"));
    assert.ok(result.includes("selectionType:"));
  });

  it("SENIORITY_LEVEL should include id and selectionType", () => {
    const values: MatchedValue[] = [
      { id: 200, text: "VP", selectionType: "INCLUDED" }
    ];
    
    const result = facetBlockIdBased("SENIORITY_LEVEL", values);
    
    assert.strictEqual(result, "(type:SENIORITY_LEVEL,values:List((id:200,selectionType:INCLUDED)))");
  });

  it("COMPANY_TYPE should include id and selectionType", () => {
    const values: MatchedValue[] = [
      { id: "P", text: "Privately Held", selectionType: "INCLUDED" }
    ];
    
    const result = facetBlockIdBased("COMPANY_TYPE", values);
    
    assert.strictEqual(result, "(type:COMPANY_TYPE,values:List((id:P,selectionType:INCLUDED)))");
  });
});

describe("Spec: Facet Ordering", () => {
  it("should follow predictable order: TITLE, FUNCTION, REGION, SENIORITY_LEVEL, COMPANY_TYPE, COMPANY_HEADCOUNT, YEARS_OF_EXPERIENCE, INDUSTRY", () => {
    const matches = {
      INDUSTRY: [{ id: 4, text: "Software", selectionType: "INCLUDED" as const }],
      COMPANY_TYPE: [{ id: "P", text: "Privately Held", selectionType: "INCLUDED" as const }],
      FUNCTION: [{ id: 25, text: "Sales", selectionType: "INCLUDED" as const }],
      TITLE: [{ text: "SDR", match: "CONTAINS" as const }],
      REGION: [{ id: 102277331, text: "San Francisco" }],
      SENIORITY_LEVEL: [{ id: 110, text: "Entry Level", selectionType: "INCLUDED" as const }],
      COMPANY_HEADCOUNT: [{ id: "B", text: "1-10", selectionType: "INCLUDED" as const }],
      YEARS_OF_EXPERIENCE: [{ id: 4, text: "6-10 years", selectionType: "INCLUDED" as const }]
    };
    
    const dsl = buildDslFromMatches(matches);
    
    // Extract facet types in order
    const typeMatches = [...dsl.matchAll(/type:([A-Z_]+)/g)];
    const order = typeMatches.map(m => m[1]);
    
    assert.deepStrictEqual(order, [
      "TITLE",
      "FUNCTION",
      "REGION",
      "SENIORITY_LEVEL",
      "COMPANY_TYPE",
      "COMPANY_HEADCOUNT",
      "YEARS_OF_EXPERIENCE",
      "INDUSTRY"
    ]);
  });
});

describe("Spec: Encoding Protocol", () => {
  it("should inner-encode keywords once", () => {
    const matches = {
      KEYWORD: ["SDR OR \"Sales Development Representative\""]
    };
    
    const dsl = buildDslFromMatches(matches);
    
    // Keywords should be inner-encoded in the DSL
    assert.ok(dsl.includes("spellCorrectionEnabled:true"));
    assert.ok(dsl.includes("keywords:"));
    // The space in the keyword should be %20 at this stage (inner encoded)
    assert.ok(dsl.includes("%20"));
  });

  it("should outer-encode entire DSL including already inner-encoded keywords", () => {
    const dsl = "(spellCorrectionEnabled:true,keywords:SDR%20OR%20%22Sales%20Development%20Representative%22)";
    
    const url = buildPeopleSearchUrl(dsl);
    
    // URL should start with proper base
    assert.ok(url.includes("https://www.linkedin.com/sales/search/people?query="));
    assert.ok(url.includes("&viewAllFilters=true"));
    
    // The inner %20 should become %2520 after outer encoding
    assert.ok(url.includes("%2520"));
    
    // Parentheses should be encoded
    assert.ok(url.includes("%28"));
    assert.ok(url.includes("%29"));
  });
});

describe("Spec: PERSONA Facet Exclusion", () => {
  it("should not include PERSONA facet in DSL", () => {
    const matches = {
      PERSONA: [{ id: 1, text: "Seniority", selectionType: "INCLUDED" as const }],
      FUNCTION: [{ id: 25, text: "Sales", selectionType: "INCLUDED" as const }]
    };
    
    const dsl = buildDslFromMatches(matches);
    
    // PERSONA should not appear in the DSL
    assert.ok(!dsl.includes("PERSONA"), "PERSONA should not be in DSL");
    // But FUNCTION should still be there
    assert.ok(dsl.includes("FUNCTION"), "FUNCTION should be in DSL");
  });
});

describe("Spec: Example URLs", () => {
  it("should generate SDR SaaS URL with San Francisco region", () => {
    const matches = {
      KEYWORD: ["(SDR OR \"Sales Development Representative\") AND (\"SaaS\" OR \"B2B software\")"],
      TITLE: [{ text: "Sales Development Representative", match: "CONTAINS" as const }],
      FUNCTION: [{ id: 25, text: "Sales", selectionType: "INCLUDED" as const }],
      REGION: [{ id: 102277331, text: "San Francisco Bay Area" }]
    };
    
    const dsl = buildDslFromMatches(matches);
    const url = buildPeopleSearchUrl(dsl);
    
    const urlObj = new URL(url);
    const encodedQuery = urlObj.searchParams.get("query");
    assert.ok(encodedQuery, "Query parameter should exist");
    
    const decodedOnce = decodeURIComponent(encodedQuery);
    
    assert.ok(decodedOnce.includes("type:REGION"));
    assert.ok(decodedOnce.includes("id:102277331"));
    // Should contain text and selectionType for REGION (per LinkedIn format)
    assert.ok(/type:REGION[^)]*text:/.test(decodedOnce), "REGION should have text field to match LinkedIn format");
    assert.ok(/type:REGION[^)]*selectionType:/.test(decodedOnce), "REGION should have selectionType field to match LinkedIn format");
  });
});

describe("Spec: CEO Scenarios", () => {
  it("should generate correct URL for startup CEOs in MA/CT/RI (NO SENIORITY, NO FUNCTION)", () => {
    const matches = {
      KEYWORD: ["(\"startup\" OR \"early stage\")"],
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
        { id: 104877241, text: "Rhode Island" }  // CRITICAL: correct RI ID
      ]
    };
    
    const dsl = buildDslFromMatches(matches);
    const url = buildPeopleSearchUrl(dsl);
    
    // CRITICAL ASSERTIONS PER SPEC
    // 1. No SENIORITY_LEVEL facet for CEO
    assert.ok(!dsl.includes("SENIORITY_LEVEL"), "CEO should not have SENIORITY_LEVEL");
    
    // 2. No FUNCTION facet for CEO
    assert.ok(!dsl.includes("FUNCTION"), "CEO should not have FUNCTION");
    
    // 3. Correct REGION IDs for MA, CT, RI
    assert.ok(dsl.includes("id:101098412"), "Should include Massachusetts (101098412)");
    assert.ok(dsl.includes("id:106914527"), "Should include Connecticut (106914527)");
    assert.ok(dsl.includes("id:104877241"), "Should include Rhode Island (104877241)");
    
    // 4. REGION format: id + text + selectionType (per LinkedIn format)
    assert.ok(dsl.match(/type:REGION[^)]*text:/), "REGION should have text field to match LinkedIn format");
    assert.ok(dsl.match(/type:REGION[^)]*selectionType:/), "REGION should have selectionType field to match LinkedIn format");
    
    // 5. Should include other facets
    assert.ok(dsl.includes("type:TITLE"), "Should have TITLE");
    assert.ok(dsl.includes("type:COMPANY_TYPE"), "Should have COMPANY_TYPE");
    assert.ok(dsl.includes("type:COMPANY_HEADCOUNT"), "Should have COMPANY_HEADCOUNT");
    
    // 6. URL structure
    assert.ok(url.includes("https://www.linkedin.com/sales/search/people?query="));
    assert.ok(url.includes("viewAllFilters=true"));
  });

  it("should omit SENIORITY_LEVEL for various leadership titles", () => {
    const leadershipTitles = [
      "Chief Executive Officer",
      "CEO",
      "CFO",
      "CTO",
      "Chief Technology Officer",
      "Founder",
      "President"
    ];
    
    for (const title of leadershipTitles) {
      const matches = {
        TITLE: [{ text: title, match: "CONTAINS" as const }]
      };
      
      const dsl = buildDslFromMatches(matches);
      
      assert.ok(!dsl.includes("SENIORITY_LEVEL"), 
        `Leadership title "${title}" should not have SENIORITY_LEVEL`);
    }
  });

  it("should include SENIORITY_LEVEL when explicitly requested for CEO", () => {
    // This would come from generator with explicitlyRequestedSeniority = true
    const matches = {
      TITLE: [{ text: "CEO", match: "CONTAINS" as const }],
      SENIORITY_LEVEL: [{ id: 310, text: "CXO", selectionType: "INCLUDED" as const }]
    };
    
    const dsl = buildDslFromMatches(matches);
    
    // When explicitly added, it should be included
    assert.ok(dsl.includes("SENIORITY_LEVEL"), "Explicitly requested SENIORITY_LEVEL should be included");
    assert.ok(dsl.includes("id:310"), "Should include CXO id");
  });

  it("should validate REGION IDs are correct for New England states", () => {
    const regionTests = [
      { id: 101098412, name: "Massachusetts" },
      { id: 106914527, name: "Connecticut" },
      { id: 104877241, name: "Rhode Island" }  // NOT 103532695 (NH)
    ];
    
    for (const region of regionTests) {
      const matches = {
        REGION: [{ id: region.id, text: region.name }]
      };
      
      const dsl = buildDslFromMatches(matches);
      
      assert.ok(dsl.includes(`id:${region.id}`), 
        `${region.name} should have ID ${region.id}`);
    }
  });
});

describe("Spec: Edge Cases", () => {
  it("should handle empty filters gracefully", () => {
    const matches = {};
    
    const dsl = buildDslFromMatches(matches);
    
    assert.strictEqual(dsl, "");
  });

  it("should handle only keywords without filters", () => {
    const matches = {
      KEYWORD: ["test keyword"]
    };
    
    const dsl = buildDslFromMatches(matches);
    
    assert.ok(dsl.includes("spellCorrectionEnabled:true"));
    assert.ok(dsl.includes("keywords:"));
    assert.ok(!dsl.includes("filters:"));
  });

  it("should handle filters without keywords", () => {
    const matches = {
      FUNCTION: [{ id: 25, text: "Sales", selectionType: "INCLUDED" as const }]
    };
    
    const dsl = buildDslFromMatches(matches);
    
    assert.ok(dsl.includes("filters:List"));
    assert.ok(dsl.includes("type:FUNCTION"));
    assert.ok(!dsl.includes("keywords:"));
  });

  it("should handle empty values arrays", () => {
    const emptyValues: MatchedValue[] = [];
    
    const result = facetBlockIdBased("FUNCTION", emptyValues);
    
    assert.strictEqual(result, "");
  });
});

