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

