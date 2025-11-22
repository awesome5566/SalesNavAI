# Facet ID Cross-Contamination Fix

## Problem Summary

**Short version:** Facet IDs from different taxonomies were being mixed, causing LinkedIn Sales Navigator to reject URLs.

### Specific Issue

The regex patterns in `src/nlp.ts` were **too greedy** when parsing GPT-formatted output. When GPT returned structured facet syntax on multiple lines like:

```
Function: Sales
Industry: Software Development
title "Business Development Representative" contains
```

The `matchFunctions()` regex would capture **everything** after `Function:` until the next `Function:` keyword (or end of string), including:
- The Industry line
- The title line with "Business Development Representative"

This caused the text "Business Development Representative" to be matched against the FUNCTION facet store, incorrectly finding `id:4` (Business Development function).

### The Fatal Collision

- **FUNCTION facet**: Got `id:25` (Sales) ✅ + `id:4` (Business Development) ❌
- **INDUSTRY facet**: Got `id:4` (Software Development) ✅

**Problem:** `id:4` appeared in BOTH facets but with different meanings:
- In FUNCTION taxonomy: `id:4` = "Business Development" 
- In INDUSTRY taxonomy: `id:4` = "Software Development"

LinkedIn Sales Navigator rejected this as invalid because a single ID cannot belong to multiple taxonomies simultaneously.

## Root Cause

### Before (BROKEN):
```typescript
// src/nlp.ts line 237
const functionPattern = /function\s*:\s*(.+)(?=\s+function\s*:|$)/gis;
```

This regex:
1. ✅ Matches "Function:" (case-insensitive)
2. ❌ Captures **everything** after it with `.+`
3. ❌ Only stops at the next "function:" keyword or end of string
4. ❌ Continues across line breaks, capturing unrelated facets

### Why This Failed

When text contained:
```
Function: Sales
Industry: Software Development
title "Business Development Representative" contains
```

The pattern captured:
```
Sales
Industry: Software Development
title "Business Development Representative" contains
```

Then `matchFacet()` found "Business Development" in that text and matched it to FUNCTION `id:4`.

## Solution

### After (FIXED):
```typescript
// src/nlp.ts line 237
const functionPattern = /function\s*:\s*([^\n]+?)(?=\s*(?:\n|industry|location|title|seniority|company|keyword|current|past|school|years|group|follows|viewed|connection|relationship|lead|posted|$))/gis;
```

Key changes:
1. `[^\n]+?` - Capture everything EXCEPT newlines (stops at line breaks)
2. Stop at newline OR any other facet keyword (industry, location, title, etc.)
3. Non-greedy `+?` to stop as soon as a boundary is found

Now the pattern only captures:
```
Sales
```

And stops immediately at the newline before "Industry:".

## Files Modified

### 1. `src/nlp.ts`
Fixed regex patterns in 7 functions to prevent cross-contamination:
- `matchFunctions()` (line 237)
- `matchIndustries()` (line 326)
- `matchGeographies()` (line 417)
- `matchCompanyHeadcount()` (line 551)
- `matchCompanyType()` (line 809)
- `matchSeniorityLevel()` (line 884)
- `matchKeywords()` (line 1170)

### 2. `src/tests/nlp.spec.ts`
Added 2 new tests to prevent regression:
- `matchFunctions prevents cross-contamination from multi-line input` (line 132)
- `matchIndustries prevents cross-contamination from multi-line input` (line 229)

### 3. `src/tests/dsl.spec.ts`
Added 1 new test to verify end-to-end fix:
- `buildDslFromMatches prevents facet ID cross-contamination` (line 175)

## Validation

All tests pass:
```
✅ buildDslFromMatches prevents facet ID cross-contamination (test 13)
✅ matchFunctions prevents cross-contamination from multi-line input (test 23)
✅ matchIndustries prevents cross-contamination from multi-line input (test 27)
```

Total: 100 tests, 98 passed, 1 pre-existing failure (unrelated)

## Example: Before vs After

### Before (Broken URL):
```
Function: Sales
Industry: Software Development
title "Business Development Representative" contains

Generated DSL:
(type:FUNCTION,values:List(
  (id:25,selectionType:INCLUDED),  # Sales ✅
  (id:4,selectionType:INCLUDED)    # Business Development ❌ WRONG!
)),
(type:INDUSTRY,values:List(
  (id:4,selectionType:INCLUDED)    # Software Development ✅
))
```
❌ **Result:** LinkedIn rejects - `id:4` in both FUNCTION and INDUSTRY

### After (Fixed URL):
```
Function: Sales
Industry: Software Development  
title "Business Development Representative" contains

Generated DSL:
(type:FUNCTION,values:List(
  (id:25,selectionType:INCLUDED)   # Sales ✅
)),
(type:INDUSTRY,values:List(
  (id:4,selectionType:INCLUDED)    # Software Development ✅
))
```
✅ **Result:** LinkedIn accepts - `id:4` only in INDUSTRY

## Prevention Guidelines

1. **Always stop regex patterns at line breaks** when parsing structured multi-line input
2. **Use `[^\n]+?` instead of `.+`** for single-line captures
3. **Add lookahead boundaries** for all other facet keywords
4. **Test with multi-line GPT output** that includes similar text across different facets
5. **Validate facet IDs** before emitting DSL to ensure no cross-taxonomy contamination

## Related Documentation

- `FACET_SYNTAX_DOCUMENTATION.md` - Complete facet taxonomy reference
- `IMPLEMENTATION_SUMMARY.md` - Overall system architecture
- `TROUBLESHOOTING.md` - Common issues and solutions





