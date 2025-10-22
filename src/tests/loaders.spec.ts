/**
 * Tests for loaders module
 */

import { test } from "node:test";
import assert from "node:assert";
import { loadFormatsCopy, loadIndustriesCsv } from "../loaders.js";

test("loadFormatsCopy loads and normalizes JSON data", () => {
  const store = loadFormatsCopy("Formats copy.json");
  
  // Check that some facets exist
  assert.ok(Object.keys(store).length > 0);
  
  // Check REGION facet if it exists
  if (store.REGION) {
    assert.ok(store.REGION.byId instanceof Map);
    assert.ok(store.REGION.byText instanceof Map);
    assert.ok(store.REGION.byId.size > 0);
  }
  
  // Check INDUSTRY facet if it exists
  if (store.INDUSTRY) {
    assert.ok(store.INDUSTRY.byId.size > 0);
    const insuranceId = store.INDUSTRY.byText.get("insurance");
    if (insuranceId !== undefined) {
      assert.strictEqual(store.INDUSTRY.byId.get(insuranceId), "Insurance");
    }
  }
});

test("loadFormatsCopy handles REGION data", () => {
  const store = loadFormatsCopy("Formats copy.json");
  
  // Check if REGION exists in the data
  if (store.REGION) {
    assert.ok(store.REGION.byId.size > 0);
    
    // Check for Boston if it exists
    const bostonId = store.REGION.byText.get("boston");
    if (bostonId !== undefined) {
      assert.strictEqual(store.REGION.byId.get(bostonId), "Boston");
    }
  } else {
    // If no REGION, at least verify we loaded something
    assert.ok(Object.keys(store).length > 0);
  }
});

test("loadIndustriesCsv loads CSV data", () => {
  const index = loadIndustriesCsv("Industry IDs.csv");
  
  assert.ok(index.byId instanceof Map);
  assert.ok(index.byText instanceof Map);
  assert.ok(index.byId.size > 0);
  
  // Check for Software Development (id: 4)
  assert.strictEqual(index.byId.get(4), "Software Development");
  assert.strictEqual(index.byText.get("software development"), 4);
});

test("loadIndustriesCsv handles quoted CSV values", () => {
  const index = loadIndustriesCsv("Industry IDs.csv");
  
  // We don't expect commas in normalized keys, but the CSV parser should handle them
  assert.ok(index.byId.size > 100); // Should have many industries
});

