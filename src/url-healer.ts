/**
 * Sales Navigator URL Healer / Doctor
 * 
 * Post-processes generated URLs to validate structure, encoding, and facet integrity.
 * Automatically repairs common issues before returning URLs to users.
 */

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
  "PERSONA",
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
    if (!ALLOWED_TYPES.has(type)) {
      reasons.push(`dropped unsupported facet: ${type}`);
      continue;
    }

    // TITLE must have text/match, others must have id
    if (type === "TITLE") {
      if (!/text\s*:/.test(p) || !/match\s*:\s*(CONTAINS|EXACT)/.test(p)) {
        reasons.push("malformed TITLE facet (missing text or match); kept as-is");
        // Keep as-is for manual review
      }
    } else {
      if (!/\bid\s*:/.test(p)) {
        reasons.push(`dropped ${type} facet without id`);
        continue;
      }
    }
    
    sanitized.push(p);
  }
  
  const rebuilt = dsl.replace(block, sanitized.join(","));
  return rebuilt;
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

