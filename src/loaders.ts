/**
 * Data loaders for Formats copy.json and Industry IDs.csv
 */

import { readFileSync } from "fs";
import { parse } from "csv-parse/sync";
import type { FacetIndex, NormalizedFacetStore, RawFacetData, FacetName } from "./types.js";
import { sanitizeText, normalizeForLookup } from "./sanitize.js";

/**
 * Load and normalize Formats copy.json
 * Note: The file contains multiple JSON objects separated by newlines, not a JSON array
 */
export function loadFormatsCopy(path = "Formats copy.json"): Partial<NormalizedFacetStore> {
  const content = readFileSync(path, "utf-8");
  const sanitized = sanitizeText(content);

  // Split JSON objects by pattern }\n{ (close brace, newline, open brace)
  // Replace }\n{ with }\n---SPLIT---\n{ to mark boundaries
  const marked = sanitized.replace(/\}\s*\n\s*\{/g, "}\n---SPLIT---\n{");
  const chunks = marked.split("---SPLIT---");
  
  const jsonObjects: Record<string, RawFacetData>[] = [];
  
  for (const chunk of chunks) {
    const trimmed = chunk.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        jsonObjects.push(JSON.parse(trimmed));
      } catch (e) {
        console.error("Failed to parse JSON chunk:", e);
      }
    }
  }

  // Merge all facets from all objects
  const store: Partial<NormalizedFacetStore> = {};

  for (const obj of jsonObjects) {
    for (const [facetName, facetData] of Object.entries(obj)) {
      const normalizedName = facetName as FacetName;
      
      if (!store[normalizedName]) {
        store[normalizedName] = {
          byId: new Map(),
          byText: new Map(),
        };
      }

      const index = store[normalizedName]!;

      // Add ID-based entries
      for (const { id, text } of facetData.ids) {
        const cleanText = sanitizeText(text);
        const lookupKey = normalizeForLookup(cleanText);
        
        // Only add if not already present (first wins for deduplication)
        if (!index.byId.has(id)) {
          index.byId.set(id, cleanText);
        }
        if (!index.byText.has(lookupKey)) {
          index.byText.set(lookupKey, id);
        }
      }

      // For text-based facets, we can also extract IDs from the texts array if needed
      // but typically those don't have IDs
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
  formatsPath = "Formats copy.json",
  industriesPath = "Industry IDs.csv"
): Partial<NormalizedFacetStore> {
  const store = loadFormatsCopy(formatsPath);
  const industries = loadIndustriesCsv(industriesPath);

  // Merge industries into store (or replace if exists)
  store.INDUSTRY = industries;

  return store;
}

