/**
 * Tests for DSL encoder
 */

import { test } from "node:test";
import assert from "node:assert";
import {
  facetBlockIdBased,
  facetBlockTextBased,
  buildFilters,
  encodeQuery,
  buildPeopleSearchUrl,
  buildDslFromMatches,
} from "../dsl.js";

test("facetBlockIdBased creates single value block", () => {
  const result = facetBlockIdBased("FUNCTION", [
    { id: 25, text: "Sales", selectionType: "INCLUDED" },
  ]);
  
  // Simplified format: omits text field for ID-based facets
  assert.strictEqual(result, "(type:FUNCTION,values:List((id:25,selectionType:INCLUDED)))");
});

test("facetBlockIdBased creates multiple value block", () => {
  const result = facetBlockIdBased("REGION", [
    { id: 102380872, text: "Boston", selectionType: "INCLUDED" },
    { id: 105080838, text: "New York", selectionType: "INCLUDED" },
  ]);
  
  // REGION format: ONLY id (no text, no selectionType per spec)
  assert.strictEqual(result, "(type:REGION,values:List((id:102380872),(id:105080838)))");
  assert.ok(!result.includes("text:"), "REGION should not have text field");
  assert.ok(!result.includes("selectionType:"), "REGION should not have selectionType field");
});

test("facetBlockTextBased creates title block", () => {
  const result = facetBlockTextBased("TITLE", [
    { text: "Account Executive", match: "EXACT" },
  ]);
  
  assert.strictEqual(result, "(type:TITLE,values:List((text:Account Executive,match:EXACT)))");
});

test("buildFilters combines multiple blocks", () => {
  const blocks = [
    "(type:FUNCTION,values:List((id:25,selectionType:INCLUDED)))",
    "(type:INDUSTRY,values:List((id:4,selectionType:INCLUDED)))",
  ];
  
  const result = buildFilters(blocks);
  
  assert.ok(result.startsWith("(filters:List("));
  assert.ok(result.includes("type:FUNCTION"));
  assert.ok(result.includes("type:INDUSTRY"));
  assert.ok(result.endsWith("))"));
});

test("buildFilters handles empty blocks", () => {
  const result = buildFilters([]);
  
  assert.strictEqual(result, "");
});

test("encodeQuery returns DSL unchanged (deprecated)", () => {
  // DEPRECATED: encodeQuery is kept for backward compatibility only
  // Use buildPeopleSearchUrl directly instead
  const dsl = "(filters:List((type:FUNCTION,values:List((id:25,selectionType:INCLUDED)))))";
  const result = encodeQuery(dsl);
  
  assert.strictEqual(result, dsl);
});

test("buildPeopleSearchUrl constructs valid URL", () => {
  const dsl =
    "(filters:List((type:FUNCTION,values:List((id:25,selectionType:INCLUDED)))))";
  const result = buildPeopleSearchUrl(dsl);
  
  // encodeURIComponent doesn't encode parentheses, but buildPeopleSearchUrl does
  const expected = encodeURIComponent(dsl)
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29');
  
  assert.strictEqual(
    result,
    `https://www.linkedin.com/sales/search/people?query=${expected}&viewAllFilters=true`
  );
});

test("buildPeopleSearchUrl omits query when empty", () => {
  const result = buildPeopleSearchUrl("");

  assert.strictEqual(
    result,
    "https://www.linkedin.com/sales/search/people?viewAllFilters=true"
  );
});

test("buildPeopleSearchUrl properly encodes DSL (query starts with %28)", () => {
  const dsl = "(spellCorrectionEnabled:true,keywords:test,filters:List((type:FUNCTION,values:List((id:25,selectionType:INCLUDED)))))";
  const result = buildPeopleSearchUrl(dsl);
  
  // The query parameter should start with %28 (encoded '('), not raw '('
  assert.ok(result.includes("query=%28"), "Query parameter should start with %28 (encoded parenthesis)");
  assert.ok(!result.includes("query=("), "Query parameter should NOT start with raw '('");
});

test("buildDslFromMatches creates complete DSL", () => {
  const matches = {
    FUNCTION: [{ id: 25, text: "Sales", selectionType: "INCLUDED" }],
    INDUSTRY: [{ id: 4, text: "Software", selectionType: "INCLUDED" }],
    TITLE: [{ text: "Account Executive", match: "EXACT" }],
  };
  
  const result = buildDslFromMatches(matches as any);
  
  assert.ok(result.includes("type:FUNCTION"));
  assert.ok(result.includes("type:INDUSTRY"));
  assert.ok(result.includes("type:TITLE"));
  assert.ok(result.includes("id:25"));
  assert.ok(result.includes("id:4"));
  assert.ok(result.includes("text:Account Executive"));
});

test("buildDslFromMatches handles new facets", () => {
  const matches = {
    SENIORITY_LEVEL: [{ id: 320, text: "Owner / Partner", selectionType: "INCLUDED" }],
    YEARS_AT_CURRENT_COMPANY: [{ id: 2, text: "1 to 2 years", selectionType: "INCLUDED" }],
    CURRENT_TITLE: [{ id: 11, text: "Account Manager", selectionType: "INCLUDED" }],
    GROUP: [{ id: 1817569, text: "CBA Law Practice Management & Technology Section", selectionType: "INCLUDED" }],
    FOLLOWS_YOUR_COMPANY: [{ id: "CF", text: "Following your company", selectionType: "INCLUDED" }],
    VIEWED_YOUR_PROFILE: [{ id: "VYP", text: "Viewed your profile recently", selectionType: "INCLUDED" }],
    PAST_COLLEAGUE: [{ id: "PCOLL", text: "Past colleague", selectionType: "INCLUDED" }],
    RECENTLY_CHANGED_JOBS: [{ id: "RPC", text: "Recently changed jobs", selectionType: "INCLUDED" }],
    POSTED_ON_LINKEDIN: [{ id: "RPOL", text: "Posted on LinkedIn", selectionType: "INCLUDED" }],
    LEAD_INTERACTIONS: [{ id: "LIVP", text: "Viewed profile", selectionType: "INCLUDED" }],
  };
  
  const result = buildDslFromMatches(matches as any);
  
  assert.ok(result.includes("type:SENIORITY_LEVEL"));
  assert.ok(result.includes("type:YEARS_AT_CURRENT_COMPANY"));
  assert.ok(result.includes("type:CURRENT_TITLE"));
  assert.ok(result.includes("type:GROUP"));
  assert.ok(result.includes("type:FOLLOWS_YOUR_COMPANY"));
  assert.ok(result.includes("type:VIEWED_YOUR_PROFILE"));
  assert.ok(result.includes("type:PAST_COLLEAGUE"));
  assert.ok(result.includes("type:RECENTLY_CHANGED_JOBS"));
  assert.ok(result.includes("type:POSTED_ON_LINKEDIN"));
  assert.ok(result.includes("type:LEAD_INTERACTIONS"));
  assert.ok(result.includes("id:320"));
  assert.ok(result.includes("id:2"));
  assert.ok(result.includes("id:11"));
  assert.ok(result.includes("id:1817569"));
});

test("buildDslFromMatches pre-encodes keywords", () => {
  const matches = {
    KEYWORD: ['(SDR OR "Sales Development Representative") AND NOT ("Retail")'],
    FUNCTION: [{ id: 25, text: "Sales", selectionType: "INCLUDED" }],
  };
  
  const result = buildDslFromMatches(matches as any);
  
  // Keywords should be pre-encoded
  assert.ok(result.includes("spellCorrectionEnabled:true"));
  assert.ok(result.includes("keywords:"));
  // Check that the keyword is encoded (contains %20 for spaces, %22 for quotes)
  assert.ok(result.includes("%20") || result.includes("%22"));
  // Should also include the function filter
  assert.ok(result.includes("type:FUNCTION"));
  assert.ok(result.includes("id:25"));
});

test("buildDslFromMatches prevents facet ID cross-contamination", () => {
  // This test verifies the fix for the bug where id:4 appeared in both
  // FUNCTION and INDUSTRY facets with different meanings:
  // - FUNCTION id:4 = "Business Development" 
  // - INDUSTRY id:4 = "Software Development"
  // This caused LinkedIn to reject the URL
  
  const matches = {
    FUNCTION: [
      { id: 25, text: "Sales", selectionType: "INCLUDED" }
      // Should NOT include id:4 (Business Development) here
    ],
    INDUSTRY: [
      { id: 4, text: "Software Development", selectionType: "INCLUDED" }
      // id:4 is valid here in INDUSTRY context
    ],
    TITLE: [
      { text: "Sales Development Representative", match: "CONTAINS" }
    ],
  };
  
  const result = buildDslFromMatches(matches as any);
  
  // Parse the DSL to verify structure
  assert.ok(result.includes("type:FUNCTION"), "Should include FUNCTION facet");
  assert.ok(result.includes("type:INDUSTRY"), "Should include INDUSTRY facet");
  assert.ok(result.includes("type:TITLE"), "Should include TITLE facet");
  
  // Extract FUNCTION block - should only contain id:25
  const functionMatch = result.match(/type:FUNCTION,values:List\(([^)]+)\)/);
  assert.ok(functionMatch, "Should find FUNCTION block");
  const functionBlock = functionMatch[1];
  
  // CRITICAL: Verify FUNCTION only has id:25 (Sales), NOT id:4
  assert.ok(functionBlock.includes("id:25"), "FUNCTION should include id:25 (Sales)");
  assert.ok(!functionBlock.includes("id:4"), 
    "FUNCTION should NOT include id:4 - this was the bug! id:4 is for INDUSTRY only");
  
  // Extract INDUSTRY block - should contain id:4
  const industryMatch = result.match(/type:INDUSTRY,values:List\(([^)]+)\)/);
  assert.ok(industryMatch, "Should find INDUSTRY block");
  const industryBlock = industryMatch[1];
  
  // Verify INDUSTRY has id:4 (Software Development)
  assert.ok(industryBlock.includes("id:4"), 
    "INDUSTRY should include id:4 (Software Development)");
  
  // Verify no duplicate id:4 in the entire DSL
  const allId4Matches = result.match(/id:4\b/g) || [];
  assert.strictEqual(allId4Matches.length, 1, 
    "id:4 should appear exactly once (in INDUSTRY only), not in multiple facets");
});

