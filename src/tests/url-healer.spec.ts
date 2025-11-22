/**
 * Tests for URL healer / validator
 */

import { test } from "node:test";
import assert from "node:assert";
import { healSalesNavUrl } from "../url-healer.js";

test("healer detects and fixes missing outer encoding", () => {
  // URL with raw DSL (not encoded)
  const rawUrl = "https://www.linkedin.com/sales/search/people?query=(spellCorrectionEnabled:true,keywords:test)&viewAllFilters=true";
  
  const result = healSalesNavUrl(rawUrl);
  
  assert.ok(result.ok, "Should succeed");
  assert.ok(result.changed, "Should detect changes needed");
  assert.ok(result.reasons.includes("outer encoding missing; applied"), "Should report missing encoding");
  assert.ok(result.url.includes("query=%28"), "Fixed URL should start with %28");
});

test("healer accepts properly encoded URL without changes", () => {
  // Properly encoded URL
  const goodUrl = "https://www.linkedin.com/sales/search/people?query=%28spellCorrectionEnabled%3Atrue%2Ckeywords%3Atest%29&viewAllFilters=true";
  
  const result = healSalesNavUrl(goodUrl);
  
  assert.ok(result.ok, "Should succeed");
  assert.ok(!result.changed, "Should not need changes");
  assert.strictEqual(result.reasons.length, 0, "Should have no warnings");
});

test("healer fixes unbalanced parentheses", () => {
  const unbalanced = "https://www.linkedin.com/sales/search/people?query=%28spellCorrectionEnabled%3Atrue%2Ckeywords%3Atest&viewAllFilters=true";
  
  const result = healSalesNavUrl(unbalanced);
  
  assert.ok(result.ok, "Should succeed");
  assert.ok(result.changed, "Should detect changes");
  assert.ok(result.reasons.some(r => r.includes("parentheses")), "Should mention parentheses fix");
});

test("healer fixes trailing commas", () => {
  const dsl = "(filters:List((type:FUNCTION,values:List((id:25,selectionType:INCLUDED)),)))";
  const encoded = encodeURIComponent(dsl).replace(/\(/g, '%28').replace(/\)/g, '%29');
  const url = `https://www.linkedin.com/sales/search/people?query=${encoded}&viewAllFilters=true`;
  
  const result = healSalesNavUrl(url);
  
  assert.ok(result.ok, "Should succeed");
  assert.ok(result.changed, "Should fix trailing commas");
  assert.ok(result.reasons.some(r => r.includes("comma")), "Should mention comma fix");
});

test("healer normalizes double-encoded keywords", () => {
  // Simulate keywords that got encoded twice
  const doubleEncoded = encodeURIComponent(encodeURIComponent("(SDR OR BDR)"));
  const dsl = `(spellCorrectionEnabled:true,keywords:${doubleEncoded})`;
  const encoded = encodeURIComponent(dsl).replace(/\(/g, '%28').replace(/\)/g, '%29');
  const url = `https://www.linkedin.com/sales/search/people?query=${encoded}&viewAllFilters=true`;
  
  const result = healSalesNavUrl(url);
  
  assert.ok(result.ok, "Should succeed");
  assert.ok(result.changed, "Should normalize encoding");
  assert.ok(result.reasons.some(r => r.includes("keywords")), "Should mention keywords normalization");
});

test("healer drops unsupported facet types", () => {
  const dsl = "(filters:List((type:INVALID_TYPE,values:List((id:123))),(type:FUNCTION,values:List((id:25)))))";
  const encoded = encodeURIComponent(dsl).replace(/\(/g, '%28').replace(/\)/g, '%29');
  const url = `https://www.linkedin.com/sales/search/people?query=${encoded}&viewAllFilters=true`;
  
  const result = healSalesNavUrl(url);
  
  assert.ok(result.ok, "Should succeed");
  assert.ok(result.changed, "Should drop invalid facet");
  assert.ok(result.reasons.some(r => r.includes("INVALID_TYPE")), "Should mention dropped type");
  // Result should still have FUNCTION facet
  assert.ok(result.url.includes("FUNCTION"), "Should keep valid facets");
});

test("healer validates TITLE facet structure", () => {
  // TITLE facet without match field
  const dsl = "(filters:List((type:TITLE,values:List((text:Account Executive)))))";
  const encoded = encodeURIComponent(dsl).replace(/\(/g, '%28').replace(/\)/g, '%29');
  const url = `https://www.linkedin.com/sales/search/people?query=${encoded}&viewAllFilters=true`;
  
  const result = healSalesNavUrl(url);
  
  assert.ok(result.ok, "Should succeed");
  // Should warn about malformed TITLE but keep it
  assert.ok(result.reasons.some(r => r.includes("TITLE")), "Should mention TITLE issue");
});

test("healer drops ID-based facets without IDs", () => {
  const dsl = "(filters:List((type:FUNCTION,values:List((text:Sales))),(type:INDUSTRY,values:List((id:4)))))";
  const encoded = encodeURIComponent(dsl).replace(/\(/g, '%28').replace(/\)/g, '%29');
  const url = `https://www.linkedin.com/sales/search/people?query=${encoded}&viewAllFilters=true`;
  
  const result = healSalesNavUrl(url);
  
  assert.ok(result.ok, "Should succeed");
  assert.ok(result.changed, "Should drop facet without ID");
  assert.ok(result.reasons.some(r => r.includes("FUNCTION") && r.includes("without id")), "Should mention dropped FUNCTION");
  // Should keep INDUSTRY with valid ID
  assert.ok(result.url.includes("INDUSTRY"), "Should keep valid INDUSTRY facet");
});

test("healer handles URL with no query parameter", () => {
  const url = "https://www.linkedin.com/sales/search/people?viewAllFilters=true";
  
  const result = healSalesNavUrl(url);
  
  assert.ok(!result.ok, "Should fail");
  assert.ok(result.reasons.includes("missing query param"), "Should report missing query");
});

test("healer handles malformed URL", () => {
  const url = "not-a-valid-url";
  
  const result = healSalesNavUrl(url);
  
  assert.ok(!result.ok, "Should fail");
  assert.ok(result.reasons.some(r => r.includes("exception")), "Should report exception");
});

test("healer preserves complex valid URL", () => {
  // Build a complex but valid URL
  const dsl = "(spellCorrectionEnabled:true,keywords:%28SDR%20OR%20BDR%29,filters:List((type:FUNCTION,values:List((id:25,selectionType:INCLUDED))),(type:INDUSTRY,values:List((id:4,selectionType:INCLUDED))),(type:TITLE,values:List((text:Sales Development Representative,match:CONTAINS)))))";
  const encoded = encodeURIComponent(dsl).replace(/\(/g, '%28').replace(/\)/g, '%29');
  const url = `https://www.linkedin.com/sales/search/people?query=${encoded}&viewAllFilters=true`;
  
  const result = healSalesNavUrl(url);
  
  assert.ok(result.ok, "Should succeed");
  // Should not need changes if already properly formatted
  assert.ok(!result.changed || result.reasons.length === 0, "Should not need significant changes");
});





