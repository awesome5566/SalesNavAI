/**
 * Data loaders for facet-store.json and Industry IDs.csv
 */

import { readFileSync } from "fs";
import { parse } from "csv-parse/sync";
import type { FacetIndex, NormalizedFacetStore, FacetName } from "./types.js";
import { sanitizeText, normalizeForLookup } from "./sanitize.js";

/**
 * Load and normalize facet-store.json
 * New structure with facets containing ids arrays with records
 */
export function loadFacetStore(path = "facet-store.json"): Partial<NormalizedFacetStore> {
  const content = readFileSync(path, "utf-8");
  const sanitized = sanitizeText(content);
  
  const facetData = JSON.parse(sanitized);
  const store: Partial<NormalizedFacetStore> = {};

  for (const [facetName, facetInfo] of Object.entries(facetData)) {
    const normalizedName = facetName as FacetName;
    
    if (!store[normalizedName]) {
      store[normalizedName] = {
        byId: new Map(),
        byText: new Map(),
      };
    }

    const index = store[normalizedName]!;
    const facetDataTyped = facetInfo as any;

    // Process IDs array - each ID has records with text values
    if (facetDataTyped.ids && Array.isArray(facetDataTyped.ids)) {
      for (const idEntry of facetDataTyped.ids) {
        const id = idEntry.id;
        if (idEntry.records && Array.isArray(idEntry.records)) {
          for (const record of idEntry.records) {
            if (record.text) {
              const cleanText = sanitizeText(record.text);
              const lookupKey = normalizeForLookup(cleanText);
              
              // Only add if not already present (first wins for deduplication)
              if (!index.byId.has(id)) {
                index.byId.set(id, cleanText);
              }
              if (!index.byText.has(lookupKey)) {
                index.byText.set(lookupKey, id);
              }
            }
          }
        }
      }
    }

    // Process texts array for text-based facets
    if (facetDataTyped.texts && Array.isArray(facetDataTyped.texts)) {
      for (const textEntry of facetDataTyped.texts) {
        if (textEntry.text) {
          const cleanText = sanitizeText(textEntry.text);
          const lookupKey = normalizeForLookup(cleanText);
          
          // For text-based facets, we don't have IDs, so we use a synthetic ID
          if (!index.byText.has(lookupKey)) {
            const syntheticId = cleanText.length; // Use text length as synthetic ID
            index.byText.set(lookupKey, syntheticId);
            index.byId.set(syntheticId, cleanText);
          }
        }
      }
    }
  }

  return store;
}

/**
 * Load and normalize Industry IDs.csv
 * Columns: displayValue,id,headline,headlineV2/text
 */
export function loadIndustriesCsv(path = "Industry IDs.csv"): FacetIndex {
  const content = readFileSync(path, "utf-8");
  const sanitized = sanitizeText(content);

  const records = parse(sanitized, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  const index: FacetIndex = {
    byId: new Map(),
    byText: new Map(),
  };

  for (const record of records) {
    const displayValue = sanitizeText(record.displayValue || "");
    const id = parseInt(record.id, 10);

    if (displayValue && !isNaN(id)) {
      const lookupKey = normalizeForLookup(displayValue);
      
      // First wins for deduplication
      if (!index.byId.has(id)) {
        index.byId.set(id, displayValue);
      }
      if (!index.byText.has(lookupKey)) {
        index.byText.set(lookupKey, id);
      }
    }
  }

  return index;
}

/**
 * Load all data and merge into a complete store
 */
export function loadAllData(
  facetStorePath = "facet-store.json",
  industriesPath = "Industry IDs.csv"
): Partial<NormalizedFacetStore> {
  const store = loadFacetStore(facetStorePath);
  const industries = loadIndustriesCsv(industriesPath);

  // Merge industries into store (or replace if exists)
  store.INDUSTRY = industries;

  return store;
}

