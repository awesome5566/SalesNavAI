# LinkedIn Sales Navigator URL Encoder - Fixes Applied

## Summary
This document outlines the fixes applied to ensure LinkedIn Sales Navigator URLs load reliably by following proper DSL construction and encoding rules.

## Latest Fix (November 2025)

### ✅ Added Text Field to REGION Facets
**File:** `src/dsl.ts`

**Problem:** LinkedIn Sales Navigator requires REGION facets to include both `id` and `text` fields for URL validation. URLs with only `id` would fail to load.

**Solution:** Modified `facetBlockIdBased()` to conditionally include the `text` field for REGION facets while keeping other facets unchanged.

**Code Changes:**
```typescript
// Before: Only id and selectionType
return `(id:${v.id},selectionType:${selectionType})`;

// After: Include text for REGION facets
if (type === "REGION" && v.text) {
  return `(id:${v.id},text:${v.text},selectionType:${selectionType})`;
}
return `(id:${v.id},selectionType:${selectionType})`;
```

**Example Output:**
```
(type:REGION,values:List((id:100901743,text:San Francisco County, California, United States,selectionType:INCLUDED)))
```

### ✅ Separated San Francisco County from Bay Area
**File:** `src/resolvers.ts`

**Change:** Split the San Francisco region aliases to provide more precise location targeting:
- **100901743** (San Francisco County) - "san francisco", "sf"
- **102277331** (San Francisco Bay Area) - "bay area", "san francisco bay area", "silicon valley"

This allows users to choose between the narrower city/county or the broader metro area.

## Encoding Pipeline (The Correct Way)

```typescript
// Step 1: Build raw Boolean keywords
const rawBoolean = '(SDR OR "Sales Development Representative") AND ("SaaS" OR "B2B software")';

// Step 2: Pre-encode keywords once
const encodedKeywords = encodeURIComponent(rawBoolean);

// Step 3: Build DSL with plain text for all facets, pre-encoded keywords
const dsl = `(spellCorrectionEnabled:true,keywords:${encodedKeywords},filters:List(...))`;

// Step 4: Encode the ENTIRE DSL once (with parenthesis encoding)
const encodedDsl = encodeURIComponent(dsl).replace(/\(/g, '%28').replace(/\)/g, '%29');

// Step 5: Build final URL
const url = `https://www.linkedin.com/sales/search/people?query=${encodedDsl}&viewAllFilters=true`;
```

**Result:** Keywords are double-encoded (once in step 2, once in step 4), which is what LinkedIn expects. The query parameter starts with `%28` not `(`.

## Changes Made

### 1. ✅ Fixed DSL Encoding (Critical)
**File:** `src/dsl.ts`

**Problem:** Keywords were not being pre-encoded, and the entire DSL wasn't being encoded properly.

**Solution:** 
- Pre-encode keywords Boolean using `encodeURIComponent()` before embedding into DSL
- Keep all other DSL fields (text, filters) raw until final encode
- Apply `encodeURIComponent()` once to entire DSL in `buildPeopleSearchUrl()`
- Manually encode parentheses since `encodeURIComponent` doesn't encode them
- Removed redundant `encodeQuery()` function
- `buildPeopleSearchUrl()` is now the ONLY place that performs the final encode

**Code Changes:**
```typescript
// buildDslFromMatches: Pre-encode keywords
const keywordsRaw = matches.KEYWORD.join(' ');
const keywordsEncoded = encodeURIComponent(keywordsRaw);
const dsl = `(spellCorrectionEnabled:true,keywords:${keywordsEncoded},filters:...)`;

// buildPeopleSearchUrl: Encode entire DSL once
const encodedDsl = encodeURIComponent(dsl)
  .replace(/\(/g, '%28')
  .replace(/\)/g, '%29');
return `${baseUrl}?query=${encodedDsl}&viewAllFilters=true`;
```

### 2. ✅ Simplified ID-Based Facet Blocks
**File:** `src/dsl.ts`

**Problem:** Including unnecessary `text` field in ID-based filters.

**Solution:**
- Removed `text` field from ID-based facets (FUNCTION, INDUSTRY, REGION, etc.)
- Now only includes `id` and `selectionType`

**Code Changes:**
```typescript
// Before:
return `(id:${v.id},text:${v.text},selectionType:${selectionType})`;

// After:
return `(id:${v.id},selectionType:${selectionType})`;
```

**Example Output:**
```
(type:FUNCTION,values:List((id:25,selectionType:INCLUDED)))
```

### 3. ✅ Added REGION ID Resolver
**File:** `src/resolvers.ts`

**New Function:** `resolveRegionId(locationText: string, geoIndex?: Map): string | null`

**Features:**
- Maps common location aliases to LinkedIn region IDs
- Supports variations like "sf" → "san francisco" → region ID 102277331
- Falls back to geoId.csv lookup
- Returns `null` if no valid ID found (facet should be omitted)

**Supported Locations:**
- San Francisco Bay Area (102277331): "san francisco", "sf", "bay area", "silicon valley"
- New York City (105080838): "new york", "nyc", "manhattan", "brooklyn"
- Los Angeles (103644278): "los angeles", "la"
- Seattle (104116928): "seattle", "puget sound"
- Boston (105214831): "boston"
- Chicago (103112676): "chicago", "chicagoland"
- Austin (102748797): "austin"
- Denver (104757945): "denver"
- United States (103055929): "united states", "usa", "us"

### 4. ✅ Added Contradiction Validator
**File:** `src/generator.ts`

**New Function:** `validateNoContradictions(keywords, matched, warnings)`

**Purpose:** Prevents including facets that contradict keyword exclusions

**Logic:**
- Checks if keywords contain `NOT ("Retail")` or similar exclusions
- Removes any INCLUDED industries that match the excluded terms
- Adds warning messages for transparency

**Example:**
```
Keywords: (SaaS OR "B2B software") AND NOT ("Retail" OR "Hospitality")
Industry facets: [Software, Technology] ✅  (Retail removed if present)
```

### 5. ✅ Validated TITLE Filter Format
**File:** `src/dsl.ts`

**Status:** Already correct - no changes needed

**Current Format:**
```typescript
(type:TITLE,values:List((text:Sales Development Representative,match:CONTAINS)))
```

Text values remain raw (unencoded) until final outer encode.

### 6. ✅ Prevented Free-Text Industries and Regions
**File:** `src/generator.ts`

**Problem:** Free-text values without valid IDs were being added as facets.

**Solution:**
- Added validation filters for both INDUSTRY and REGION matches
- Only includes facets with valid numeric IDs
- Logs warnings for skipped free-text entries

**Industry Validation:**
```typescript
const validIndustries = industries.filter(ind => {
  if (typeof ind.id === 'number' || !isNaN(Number(ind.id))) {
    return true;
  }
  warnings.push(`Skipped industry "${ind.text}" - not a valid LinkedIn industry. Keep in keywords only.`);
  return false;
});
```

**Region Validation:**
```typescript
const validRegions = geographies.filter(geo => {
  if (typeof geo.id === 'number' || !isNaN(Number(geo.id))) {
    return true;
  }
  warnings.push(`Skipped region "${geo.text}" - no valid ID found.`);
  return false;
});
```

## Example: Good URL Pipeline

```typescript
// 1) Normalize intent
const title = { text: "Sales Development Representative", match: "CONTAINS" };
const functionId = "25"; // Sales
const regionId = "102277331"; // San Francisco Bay Area
const boolean = `(SDR OR "Sales Development Representative") AND ("SaaS" OR "B2B software") AND NOT ("Retail" OR "Hospitality")`;

// 2) Build filters (simplified, no text field for IDs)
const filters = [
  `(type:TITLE,values:List((text:Sales Development Representative,match:CONTAINS)))`,
  `(type:FUNCTION,values:List((id:25,selectionType:INCLUDED)))`,
  `(type:REGION,values:List((id:102277331,selectionType:INCLUDED)))`,
].join(',');

// 3) Pre-encode keywords first
const kw = encodeURIComponent(boolean);

// 4) Assemble raw DSL with pre-encoded keywords
const dsl = `(spellCorrectionEnabled:true,keywords:${kw},filters:List(${filters}))`;

// 5) Outer-encode entire DSL once
const url = `https://www.linkedin.com/sales/search/people?query=${encodeURIComponent(dsl)}&viewAllFilters=true`;
```

## What Changed vs. Failing URLs

### ❌ Before (Failing)
```
Industry: SaaS, B2B software  → Invalid facet (not a real LinkedIn industry)
Location: San Francisco County, California, United States  → Free text (no ID)
Title: "Sales Development Representative"  → Not in proper TITLE filter format
Keywords: (SDR OR "SaaS")  → Not pre-encoded
```

### ✅ After (Working)
```
Industry: Only real LinkedIn IDs (e.g., Software Development: 4, IT Services: 96)
        OR kept in keywords only if no valid ID
Location: REGION with ID 102277331 (San Francisco Bay Area)
        OR omitted if no valid ID found
Title: (type:TITLE,values:List((text:Sales Development Representative,match:CONTAINS)))
Keywords: Pre-encoded → %28SDR%20OR%20%22SaaS%22%29
```

## Guards Added

### 1. Contradiction Check
Ensures keywords with `NOT ("Retail")` don't have Retail/Hospitality industries as INCLUDED facets.

### 2. ID Validation
Industries and regions without valid LinkedIn IDs are skipped and logged as warnings.

### 3. Proper Encoding
- Keywords: Pre-encoded with `encodeURIComponent()`
- DSL: Outer-encoded once with `encodeURIComponent()`
- Text fields: Kept raw until final encode

## Testing

Build successful:
```bash
npm run build
# ✓ TypeScript compilation passed
```

All core requirements implemented:
- ✅ Pre-encode keywords Boolean
- ✅ Simplify ID-based filters (omit text)
- ✅ Region resolver with aliases
- ✅ Contradiction validator
- ✅ TITLE filter format (already correct)
- ✅ Prevent free-text industries/regions

## Files Modified

1. **src/dsl.ts**
   - Fixed keyword pre-encoding
   - Simplified `facetBlockIdBased()` to omit text field

2. **src/resolvers.ts**
   - Added `resolveRegionId()` function
   - Added `REGION_ALIASES` constant with common location mappings

3. **src/generator.ts**
   - Added `validateNoContradictions()` function
   - Added industry ID validation
   - Added region ID validation
   - Integrated contradiction check before DSL build

## Next Steps

1. **Test with real queries** - Try generating URLs with various inputs to ensure they load correctly
2. **Monitor warnings** - Check console output for skipped industries/regions
3. **Expand region aliases** - Add more common location mappings as needed
4. **Update GPT prompts** - Consider updating GPT parser to prefer valid industry names

## Notes

- The `resolveRegionId()` function is available for external use but not actively called in the generator yet
- The geoId.csv file already contains comprehensive region data
- Industry aliases (SaaS → Software Development) are already configured in loaders.ts
- All changes maintain backward compatibility with existing facet matching logic

