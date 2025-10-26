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
  
  assert.strictEqual(result, "(type:FUNCTION,values:List((id:25,text:Sales,selectionType:INCLUDED)))");
});

test("facetBlockIdBased creates multiple value block", () => {
  const result = facetBlockIdBased("REGION", [
    { id: 102380872, text: "Boston", selectionType: "INCLUDED" },
    { id: 105080838, text: "New York", selectionType: "INCLUDED" },
  ]);
  
  assert.ok(result.includes("id:102380872"));
  assert.ok(result.includes("id:105080838"));
  assert.ok(result.includes("text:Boston"));
  assert.ok(result.includes("text:New York"));
});

test("facetBlockTextBased creates title block", () => {
  const result = facetBlockTextBased("TITLE", [
    { text: "Account Executive", match: "EXACT" },
  ]);
  
  assert.strictEqual(result, "(type:TITLE,values:List((text:Account Executive,match:EXACT)))");
});

test("buildFilters combines multiple blocks", () => {
  const blocks = [
    "(type:FUNCTION,values:List((id:25,text:Sales,selectionType:INCLUDED)))",
    "(type:INDUSTRY,values:List((id:4,text:Software,selectionType:INCLUDED)))",
  ];
  
  const result = buildFilters(blocks);
  
  assert.ok(result.startsWith("(filters:List("));
  assert.ok(result.includes("type:FUNCTION"));
  assert.ok(result.includes("type:INDUSTRY"));
  assert.ok(result.endsWith("))"));
});

test("buildFilters handles empty blocks", () => {
  const result = buildFilters([]);
  
  assert.strictEqual(result, "(filters:List())");
});

test("encodeQuery URL-encodes DSL", () => {
  const dsl = "(filters:List((type:FUNCTION,values:List((id:25,text:Sales,selectionType:INCLUDED)))))";
  const result = encodeQuery(dsl);
  
  // Should be URL-encoded (colons, commas)
  assert.ok(result.includes("%3A")); // : encoded
  assert.ok(result.includes("%2C")); // , encoded
  // Check that special characters are encoded and decode correctly
  assert.strictEqual(decodeURIComponent(result), dsl);
});

test("buildPeopleSearchUrl constructs valid URL", () => {
  const encoded = "test%20query";
  const result = buildPeopleSearchUrl(encoded);
  
  assert.strictEqual(
    result,
    "https://www.linkedin.com/sales/search/people?query=test%20query&viewAllFilters=true"
  );
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

