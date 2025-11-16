/**
 * Data loaders for facet-store.json and Industry IDs.csv
 */

import { readFileSync } from "fs";
import { join } from "path";
import { parse } from "csv-parse/sync";
import type { FacetIndex, NormalizedFacetStore, FacetName } from "./types.js";
import { sanitizeText, normalizeForLookup } from "./sanitize.js";

/**
 * Load and normalize facet-store.json
 * New structure with facets containing ids arrays with records
 */
export function loadFacetStore(path?: string): Partial<NormalizedFacetStore> {
  const filePath = path || join(process.cwd(), "facet-store.json");
  const content = readFileSync(filePath, "utf-8");
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
export function loadIndustriesCsv(path?: string): FacetIndex {
  const filePath = path || join(process.cwd(), "Industry IDs.csv");
  const content = readFileSync(filePath, "utf-8");
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

  // Add common aliases for SaaS/B2B software/startup terms
  const aliases: Record<string, number> = {
    "saas": 4,                    // Software Development
    "software": 4,                // Software Development
    "b2b software": 4,            // Software Development
    "computer software": 4,       // Software Development
    "internet": 6,                // Technology, Information and Internet
    "tech": 6,                    // Technology, Information and Internet
    "technology": 6,              // Technology, Information and Internet
  };

  for (const [alias, id] of Object.entries(aliases)) {
    const lookupKey = normalizeForLookup(alias);
    // Only add if not already present
    if (!index.byText.has(lookupKey)) {
      index.byText.set(lookupKey, id);
    }
  }

  return index;
}

/**
 * Load and normalize geoId.csv
 * Columns: ADDRESS,COUNTRY_CODE,GEO_ID
 */
export function loadGeoIdsCsv(path?: string): FacetIndex {
  const filePath = path || join(process.cwd(), "geoId.csv");
  const content = readFileSync(filePath, "utf-8");
  const sanitized = sanitizeText(content);

  const records = parse(sanitized, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    delimiter: ';',
  });

  const index: FacetIndex = {
    byId: new Map(),
    byText: new Map(),
  };

  for (const record of records) {
    const address = sanitizeText(record.ADDRESS || "");
    const geoId = record.GEO_ID;

    if (address && geoId) {
      const lookupKey = normalizeForLookup(address);
      
      // First wins for deduplication
      if (!index.byId.has(geoId)) {
        index.byId.set(geoId, address);
      }
      if (!index.byText.has(lookupKey)) {
        index.byText.set(lookupKey, geoId);
      }
    }
  }

  return index;
}

/**
 * Load all data and merge into a complete store
 */
export function loadAllData(
  facetStorePath?: string,
  industriesPath?: string,
  geoIdsPath?: string
): Partial<NormalizedFacetStore> {
  const store = loadFacetStore(facetStorePath || join(process.cwd(), "facet-store.json"));
  const industries = loadIndustriesCsv(industriesPath || join(process.cwd(), "Industry IDs.csv"));
  const geoIds = loadGeoIdsCsv(geoIdsPath || join(process.cwd(), "geoId.csv"));

  // Merge industries into store (or replace if exists)
  store.INDUSTRY = industries;
  
  // Merge geo IDs into store as REGION facet (for person location searches)
  store.REGION = geoIds;

  return store;
}

