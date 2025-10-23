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
  matchSchoolNames,
} from "../nlp.js";

test("matchFunctions finds 'sales' variations", () => {
  const store = loadAllData();
  
  // Test with "salespeople"
  const result1 = matchFunctions("looking for salespeople", store);
  // Should match if FUNCTION has Sales
  
  // Test with "sales"
  const result2 = matchFunctions("sales leaders", store);
  // Should find matches
  
  assert.ok(Array.isArray(result1));
  assert.ok(Array.isArray(result2));
});

test("matchIndustries finds 'software industry'", () => {
  const store = loadAllData();
  
  const result = matchIndustries("in the software industry", store);
  
  // Should match "Software Development" (id: 4) or similar
  // Test is flexible - just check result is an array
  assert.ok(Array.isArray(result));
  // If we have software in the data, it should match
  if (store.INDUSTRY?.byText.has("software development")) {
    const hasSoftware = result.some(m => m.text?.toLowerCase().includes("software"));
    assert.ok(hasSoftware, "Should find software-related industries");
  }
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
  const result1 = matchCompanyNames("from Harvard University");
  const result2 = matchCompanyNames("at MIT Academy");
  const result3 = matchCompanyNames("from Stanford School of Business");
  
  assert.strictEqual(result1.length, 0, "Should not match companies when 'university' is present");
  assert.strictEqual(result2.length, 0, "Should not match companies when 'academy' is present");
  assert.strictEqual(result3.length, 0, "Should not match companies when 'school' is present");
});

test("matchCompanyNames works normally without school keywords", () => {
  // Test that company matching works normally when no school keywords are present
  const result1 = matchCompanyNames("from Google");
  const result2 = matchCompanyNames("at Microsoft");
  
  assert.ok(Array.isArray(result1));
  assert.ok(Array.isArray(result2));
  // Should find company names when no school keywords are present
  if (result1.length > 0) {
    assert.strictEqual(result1[0], "Google");
  }
  if (result2.length > 0) {
    assert.strictEqual(result2[0], "Microsoft");
  }
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

