/**
 * Sales Navigator URL Healer / Doctor
 * 
 * Post-processes generated URLs to validate structure, encoding, and facet integrity.
 * Automatically repairs common issues before returning URLs to users.
 */

import { isValidFacetId } from "./allowlists.js";

export interface FixReport {
  ok: boolean;
  changed: boolean;
  reasons: string[];
  url: string;          // final (possibly fixed) URL
  rawDsl?: string;      // decoded, repaired DSL
}

const ALLOWED_TYPES = new Set([
  "TITLE",
  "FUNCTION",
  "REGION",
  "GEOGRAPHY",
  "SENIORITY_LEVEL",
  "COMPANY_TYPE",
  "COMPANY_HEADCOUNT",
  "YEARS_OF_EXPERIENCE",
  "INDUSTRY",
  "CURRENT_COMPANY",
  "PAST_COMPANY",
  "SCHOOL",
  // PERSONA removed - unsupported per spec
  "CURRENT_TITLE",
  "YEARS_AT_CURRENT_COMPANY",
  "YEARS_IN_CURRENT_POSITION",
  "GROUP",
  "FOLLOWS_YOUR_COMPANY",
  "VIEWED_YOUR_PROFILE",
  "CONNECTION_OF",
  "PAST_COLLEAGUE",
  "WITH_SHARED_EXPERIENCES",
  "RECENTLY_CHANGED_JOBS",
  "POSTED_ON_LINKEDIN",
  "LEAD_INTERACTIONS",
]);

/**
 * Main healer function: validates and auto-fixes Sales Navigator URLs
 */
export function healSalesNavUrl(inputUrl: string): FixReport {
  const reasons: string[] = [];
  
  try {
    const u = new URL(inputUrl);
    const q = u.searchParams.get("query");
    
    if (!q) {
      return { 
        ok: false, 
        changed: false, 
        reasons: ["missing query param"], 
        url: inputUrl 
      };
    }

    // Detect if the input URL query parameter was not properly encoded
    // Properly encoded: query=%28...
    // Not encoded: query=(...
    const wasNotEncoded = inputUrl.includes("query=(") && !inputUrl.includes("query=%28");
    if (wasNotEncoded) {
      reasons.push("outer encoding missing; applied");
    }

    // Note: searchParams.get() automatically decodes the parameter once
    // So if the URL was properly encoded, q will start with "(" (decoded)
    // If q starts with "%28", it means it was double-encoded (which is wrong)
    
    let rawDsl = q;
    const wasDoubleEncoded = q.startsWith("%28");
    
    if (wasDoubleEncoded) {
      // Double-encoded - decode once more to get raw DSL
      rawDsl = decodeURIComponent(q);
      reasons.push("query was double-encoded; normalized");
    }

    // 2) Normalize whitespace (optional)
    rawDsl = rawDsl.replace(/\s+/g, " ").trim();

    // 3) Parentheses balance & fix tiny off-by-one
    const balanced = isBalanced(rawDsl);
    if (!balanced) {
      const fixed = tryFixParens(rawDsl);
      if (fixed !== rawDsl) {
        reasons.push("unbalanced parentheses; auto-fixed");
        rawDsl = fixed;
      }
    }

    // 4) Validate top-level skeleton
    if (!rawDsl.startsWith("(") || !rawDsl.endsWith(")")) {
      rawDsl = wrapIfNeeded(rawDsl);
      reasons.push("wrapped DSL in top-level parens");
    }

    // 5) Ensure filters list formatting
    const beforeCommaFix = rawDsl;
    rawDsl = fixTrailingCommas(rawDsl);
    if (rawDsl !== beforeCommaFix) {
      reasons.push("fixed trailing commas");
    }

    // 6) Keywords normalization: inner-encode only keywords value
    rawDsl = normalizeKeywordsEncoding(rawDsl, reasons);

    // 7) Filters sanity: types & shapes
    rawDsl = sanitizeFacetBlocks(rawDsl, reasons);

    // 8) Set the query parameter (URLSearchParams will encode it automatically)
    // Note: searchParams.set() does NOT encode parentheses, so we need to manually handle that
    // We'll reconstruct the URL manually to ensure proper encoding
    u.searchParams.delete("query");
    
    const encodedDsl = encodeURIComponent(rawDsl)
      .replace(/\(/g, '%28')
      .replace(/\)/g, '%29');
    
    const finalUrl = `${u.origin}${u.pathname}?query=${encodedDsl}&viewAllFilters=true`;
    
    return {
      ok: true,
      changed: reasons.length > 0,
      reasons,
      url: finalUrl,
      rawDsl
    };
  } catch (e: any) {
    return { 
      ok: false, 
      changed: false, 
      reasons: ["exception: " + e?.message], 
      url: inputUrl 
    };
  }
}

/**
 * Check if parentheses are balanced
 */
function isBalanced(s: string): boolean {
  let count = 0;
  for (const ch of s) {
    if (ch === "(") count++;
    if (ch === ")") count--;
    if (count < 0) return false;
  }
  return count === 0;
}

/**
 * Try to fix unbalanced parentheses
 */
function tryFixParens(s: string): string {
  let open = 0, close = 0;
  for (const ch of s) {
    if (ch === "(") open++;
    else if (ch === ")") close++;
  }
  
  if (open > close) {
    return s + ")".repeat(open - close);
  }
  
  if (close > open) {
    // trim from end
    let toDrop = close - open;
    const arr = s.split("");
    for (let i = arr.length - 1; i >= 0 && toDrop > 0; i--) {
      if (arr[i] === ")") {
        arr[i] = "";
        toDrop--;
      }
    }
    return arr.join("");
  }
  
  return s;
}

/**
 * Wrap DSL in parentheses if needed
 */
function wrapIfNeeded(s: string): string {
  let t = s.trim();
  if (!t.startsWith("(")) t = "(" + t;
  if (!t.endsWith(")")) t = t + ")";
  return t;
}

/**
 * Remove trailing commas before closing parens
 */
function fixTrailingCommas(s: string): string {
  return s.replace(/,\s*\)/g, ")");
}

/**
 * Normalize keywords encoding (should be inner-encoded once)
 */
function normalizeKeywordsEncoding(dsl: string, reasons: string[]): string {
  // Extract keywords:<VALUE>[,|)]
  const m = /keywords\s*:\s*([^,]+?)(?=,\s*filters\s*:|,\s*\w+\s*:|\)$)/i.exec(dsl);
  if (!m) return dsl; // no keywords

  const original = m[1];

  let decodedOnce = original;
  
  // If double-encoded (%2520 style), decode once
  if (/%25/i.test(original)) {
    decodedOnce = decodeURIComponent(original);
    reasons.push("keywords looked double-encoded; normalized");
  }

  // We want: inner-encoded value, no outer quotes
  // If decodedOnce still contains spaces or quotes, inner-encode it
  const needsEncode = /[ "]/.test(decodedOnce);
  const inner = needsEncode ? encodeURIComponent(decodedOnce) : decodedOnce;

  // Rebuild
  const before = dsl.slice(0, m.index);
  const after = dsl.slice(m.index + m[0].length);
  const rebuilt = before + `keywords:${inner}` + after;
  
  return rebuilt;
}

/**
 * Sanitize and validate facet blocks
 * Per spec:
 * - Drop PERSONA facets (unsupported)
 * - REGION facets must ONLY have id (no text, no selectionType)
 * - TITLE facets must have text and match
 * - All other ID-based facets must have id and validate against allowlists
 */
function sanitizeFacetBlocks(dsl: string, reasons: string[]): string {
  // 1) ensure filters:List(...) exists as a single block if present
  // 2) verify facet types and basic shapes; drop unknown types gracefully
  const filtersMatch = /filters\s*:\s*List\s*\((.*)\)\s*\)?$/i.exec(dsl);
  if (!filtersMatch) return dsl;

  const block = filtersMatch[1];
  // split top-level facet tuples: ) , (  — we'll do a shallow splitter
  const parts = splitTopLevel(block);

  const sanitized: string[] = [];
  
  for (const p of parts) {
    const typeMatch = /type\s*:\s*([A-Z_]+)/.exec(p);
    if (!typeMatch) {
      reasons.push("dropped unknown facet (no type)");
      continue;
    }
    
    const type = typeMatch[1];
    
    // Explicitly drop PERSONA (unsupported per spec)
    if (type === "PERSONA") {
      reasons.push("dropped PERSONA facet (unsupported per spec)");
      continue;
    }
    
    if (!ALLOWED_TYPES.has(type)) {
      reasons.push(`dropped unsupported facet: ${type}`);
      continue;
    }

    // TITLE must have text/match
    if (type === "TITLE") {
      if (!/text\s*:/.test(p) || !/match\s*:\s*(CONTAINS|EXACT)/.test(p)) {
        reasons.push("malformed TITLE facet (missing text or match); kept as-is");
        // Keep as-is for manual review
      }
      sanitized.push(p);
    } 
    // REGION must ONLY have id (no text, no selectionType)
    else if (type === "REGION") {
      if (!/\bid\s*:/.test(p)) {
        reasons.push("dropped REGION facet without id");
        continue;
      }
      // Check if REGION has text or selectionType (should not per spec)
      if (/text\s*:/.test(p) || /selectionType\s*:/.test(p)) {
        // Fix REGION format: extract IDs and rebuild
        const idMatches = p.match(/id\s*:\s*(\d+)/g);
        if (idMatches && idMatches.length > 0) {
          const ids = idMatches.map(m => m.match(/\d+/)?.[0]).filter(Boolean);
          const valuesList = ids.map(id => `(id:${id})`).join(",");
          const fixed = `(type:REGION,values:List(${valuesList}))`;
          sanitized.push(fixed);
          reasons.push("fixed REGION facet format (removed text/selectionType, kept only id)");
          continue;
        } else {
          reasons.push("dropped malformed REGION facet");
          continue;
        }
      }
      sanitized.push(p);
    } 
    // All other ID-based facets: must have id and validate against allowlist
    else {
      if (!/\bid\s*:/.test(p)) {
        reasons.push(`dropped ${type} facet without id`);
        continue;
      }
      
      // Validate IDs against allowlist (for facets that have allowlists)
      const validated = validateFacetIds(type, p, reasons);
      if (validated) {
        sanitized.push(validated);
      }
    }
  }
  
  const rebuilt = dsl.replace(block, sanitized.join(","));
  return rebuilt;
}

/**
 * Validate and filter IDs in a facet block against allowlist
 * Returns the cleaned facet block or null if no valid IDs remain
 */
function validateFacetIds(type: string, facetBlock: string, reasons: string[]): string | null {
  // Only validate facets that have allowlists
  const facetsWithAllowlists = ['SENIORITY_LEVEL', 'FUNCTION', 'COMPANY_HEADCOUNT', 'COMPANY_TYPE'];
  if (!facetsWithAllowlists.includes(type)) {
    return facetBlock; // No allowlist, return as-is
  }
  
  // Extract all (id:X,...) patterns
  const valuePattern = /\(id\s*:\s*([^,)]+)[^)]*\)/g;
  const matches = [...facetBlock.matchAll(valuePattern)];
  
  if (matches.length === 0) {
    return facetBlock; // No IDs found, return as-is
  }
  
  // Filter to only valid IDs
  const validValues: string[] = [];
  for (const match of matches) {
    const id = match[1].trim();
    // Remove quotes if present
    const cleanId = id.replace(/['"]/g, '');
    
    if (isValidFacetId(type, cleanId)) {
      validValues.push(match[0]); // Keep the full (id:X,selectionType:Y) block
    } else {
      reasons.push(`dropped ${type} id=${id} (not in allowlist)`);
    }
  }
  
  if (validValues.length === 0) {
    reasons.push(`dropped ${type} facet (no valid IDs in allowlist)`);
    return null;
  }
  
  // Rebuild the facet block with only valid values
  const valuesListContent = validValues.join(',');
  return `(type:${type},values:List(${valuesListContent}))`;
}

/**
 * Split top-level comma-separated facet blocks
 */
function splitTopLevel(s: string): string[] {
  const out: string[] = [];
  let depth = 0, start = 0;
  
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(s.slice(start, i).trim());
      start = i + 1;
    }
  }
  
  const last = s.slice(start).trim();
  if (last) out.push(last);
  
  return out.filter(Boolean);
}

/**
 * Optional: Quick smoke-test to verify URL loads (network request)
 * Use responsibly and only for your own account within LinkedIn ToS
 */
export async function smokeTest(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "manual",
      headers: { 
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" 
      }
    });
    
    // Sales Nav typically 302s to an internal page; accept 200–399 as "likely OK"
    return res.status >= 200 && res.status < 400;
  } catch (e) {
    return false;
  }
}

