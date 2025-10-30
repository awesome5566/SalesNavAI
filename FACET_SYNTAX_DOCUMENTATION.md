# Sales Navigator Search Facet Syntax Documentation

This document provides comprehensive documentation for all Sales Navigator search facets, including their syntax patterns, supported values, and testing results.

## Overview

Sales Navigator uses a structured DSL (Domain Specific Language) syntax for building search URLs. Each facet follows a specific pattern that must be used for proper URL generation.

## Facet Syntax Patterns

### 1. FUNCTION Facet
**Purpose:** Filter by job functions (e.g., Sales, Engineering, Marketing)

**Syntax:** `Function: [value1], [value2], ...`

**Supported Patterns:**
- ✅ `Function: Sales` - Single function
- ✅ `Function: Sales, Engineering` - Multiple functions
- ✅ `Function: Exclude Sales` - Exclude specific function
- ✅ `Function: Sales, Exclude Engineering` - Mixed include/exclude
- ✅ `function: sales` - Case insensitive
- ❌ `sales leaders` - Old natural language syntax (not supported)
- ❌ `looking for salespeople` - Old natural language syntax (not supported)

**Available Values:** Accounting, Administrative, Arts and Design, Business Development, Community and Social Services, Consulting, Education, Engineering, Entrepreneurship, Finance, Healthcare Services, Human Resources, Information Technology, Legal, Marketing, Media and Communication, Military and Protective Services, Operations, Product Management, Program and Project Management, Purchasing, Quality Assurance, Real Estate, Research, Sales, Customer Success and Support

**Testing Results:**
- All structured syntax patterns work correctly
- Supports multiple values separated by commas
- Supports exclude logic with "Exclude" keyword
- Case insensitive
- Old natural language patterns are not supported

---

### 2. INDUSTRY Facet
**Purpose:** Filter by industry sectors

**Syntax:** `Industry: [value1], [value2], ...`

**Supported Patterns:**
- ✅ `Industry: Software` - Single industry (maps to "Software Development")
- ✅ `Industry: Software, Healthcare` - Multiple industries
- ✅ `Industry: Exclude Tech` - Exclude industry (maps to multiple tech-related industries)
- ✅ `Industry: Software, Exclude Healthcare` - Mixed include/exclude
- ✅ `industry: software` - Case insensitive
- ❌ `software industry` - Old natural language syntax (not supported)
- ❌ `in the tech industry` - Old natural language syntax (not supported)

**Available Values:** Technology, Information and Internet, Software Development, Technology, Information and Media, Movies, Videos, and Sound, Professional Training and Coaching, Transportation, Logistics, Supply Chain and Storage, Accommodation and Food Services, Renewable Energy Power Generation, Renewable Energy Equipment Manufacturing, Engineering Services, Services for Renewable Energy, Digital Accessibility Services, Accessible Hardware Manufacturing, Accessible Architecture and Design, Robot Manufacturing, Robotics Engineering, Surveying and Mapping Services, Retail Pharmacies, Climate Technology Product Manufacturing, Climate Data and Analytics, Alternative Fuel Vehicle Manufacturing, Smart Meter Manufacturing, Fuel Cell Manufacturing, Regenerative Design, Funeral Services, Death Care Services, Energy Technology

**Testing Results:**
- Structured syntax works correctly
- Supports synonym mapping (e.g., "Software" → "Software Development")
- Supports multiple values and exclude logic
- Case insensitive
- Old natural language patterns are not supported

---

### 3. REGION/GEOGRAPHY Facet (Location)
**Purpose:** Filter by geographic location

**Syntax:** `Location: [location1]; [location2]; ...`

**Supported Patterns:**
- ✅ `Location: San Francisco County, California, United States` - Exact location name from database
- ✅ `Location: Manhattan County, New York, United States` - Exact location name from database
- ❌ `Location: Boston` - City names alone don't work
- ❌ `Location: San Francisco` - City names alone don't work
- ❌ `Location: NYC` - Abbreviations don't work
- ❌ `Location: SF` - Abbreviations don't work
- ❌ `in boston or nyc` - Old natural language syntax (not supported)
- ❌ `based in Boston` - Old natural language syntax (not supported)

**Important Notes:**
- Location names must exactly match entries in the geoId.csv database
- Common city names like "Boston" or "San Francisco" don't work directly
- Must use full qualified names like "San Francisco County, California, United States"
- Abbreviations like "NYC" and "SF" are not supported
- Multiple locations separated by semicolons (not commas)

**Testing Results:**
- Only exact matches with full location names work
- Most common city names are not recognized
- Old natural language patterns are not supported

---

### 4. TITLE Facet
**Purpose:** Filter by job title

**Syntax:** `title "[title]" [modifier]`

**Supported Patterns:**
- ✅ `title "Account Executive" exact` - Exact title match
- ✅ `title "Manager" contains` - Contains title text
- ✅ `title "VP"` - Default contains match
- ❌ `title: Software Engineer` - Colon syntax not supported
- ❌ `Account Executive` - Unquoted titles not supported
- ❌ `looking for managers` - Old natural language syntax (not supported)

**Modifiers:**
- `exact` - Exact match
- `contains` - Contains match (default if no modifier)

**Testing Results:**
- Requires quoted title strings
- Supports exact and contains modifiers
- Default behavior is "contains" when no modifier specified
- Colon syntax (title:) is not supported
- Old natural language patterns are not supported

---

### 5. CURRENT_COMPANY Facet
**Purpose:** Filter by current company

**Syntax:** `Current Company: [company1], [company2], ...`

**Supported Patterns:**
- ✅ `Current Company: HubSpot` - Single company
- ✅ `Current Company: Google, Microsoft` - Multiple companies
- ✅ `Current Company: Exclude Apple` - Exclude company
- ✅ `Current Company: HubSpot, Exclude Google` - Mixed include/exclude
- ❌ `at Google` - Old natural language syntax (not supported)
- ❌ `works at Microsoft` - Old natural language syntax (not supported)

**Important Notes:**
- Company names are resolved to LinkedIn company IDs either from local data or via URL lookups
- Supports exclude logic with "Exclude" keyword
- Stops parsing at "/" separator or "Past Company:" keyword
- Ignores text containing school-related keywords (university, academy, etc.)

**Testing Results:**
- Structured syntax works correctly
- Supports multiple companies and exclude logic
- Case insensitive for keywords
- Old natural language patterns ("at", "works at") are not supported

---

### 6. PAST_COMPANY Facet
**Purpose:** Filter by past companies

**Syntax:** `Past Company: [company1], [company2], ...`

**Supported Patterns:**
- ✅ `Past Company: Google` - Single past company
- ✅ `Past Company: Apple, Microsoft` - Multiple past companies
- ✅ `Past Company: Exclude HubSpot` - Exclude past company
- ✅ `Past Company: Google, Exclude Apple` - Mixed include/exclude
- ❌ `worked at Google` - Old natural language syntax (not supported)
- ❌ `from Microsoft` - Old natural language syntax (not supported)

**Important Notes:**
- Past company IDs use URN format: `urn:li:organization:[numeric_id]`
- Supports exclude logic with "Exclude" keyword
- Stops parsing at "/" separator or "Current Company:" keyword
- Ignores text containing school-related keywords

**Testing Results:**
- Structured syntax works correctly
- Supports multiple companies and exclude logic
- Case insensitive for keywords
- Old natural language patterns ("worked at", "from") are not supported

---

### 7. SENIORITY_LEVEL Facet
**Purpose:** Filter by seniority level

**Syntax:** `Seniority Level: [level1], [level2], ...`

**Supported Patterns:**
- ✅ `Seniority Level: Director` - Single seniority level
- ✅ `Seniority Level: Director, Vice President` - Multiple levels
- ✅ `Seniority Level: Exclude CXO` - Exclude seniority level
- ✅ `Seniority Level: Director, Exclude CXO` - Mixed include/exclude
- ✅ `seniority level: director` - Case insensitive
- ❌ `directors` - Old natural language syntax (not supported)
- ❌ `looking for VPs` - Old natural language syntax (not supported)

**Available Values:**
- Owner / Partner (also accepts: owner, partner)
- CXO (also accepts: c-level, executive)
- Vice President (also accepts: vp)
- Director
- Experienced Manager (also accepts: manager)
- Entry Level Manager
- Strategic
- Senior
- Entry Level
- In Training (also accepts: training)

**Testing Results:**
- Structured syntax works correctly
- Supports synonym mapping (e.g., "vp" → "Vice President")
- Supports multiple values and exclude logic
- Case insensitive
- Old natural language patterns are not supported

---

### 8. YEARS_OF_EXPERIENCE Facet
**Purpose:** Filter by years of professional experience

**Syntax:** Natural language patterns (no structured syntax required)

**Supported Patterns:**
- ✅ `5 years` - Maps to "3 to 5 years"
- ✅ `10+ years` - Maps to "6 to 10 years"
- ✅ `3 to 5 years` - Direct match
- ✅ `senior level` - Maps to "6 to 10 years"
- ✅ `experienced` - Maps to "6 to 10 years"

**Available Values:**
- Less than 1 year
- 1 to 2 years
- 3 to 5 years
- 6 to 10 years
- More than 10 years

**Testing Results:**
- Uses pattern matching rather than structured syntax
- Maps numeric inputs to appropriate experience buckets
- Recognizes seniority keywords ("senior", "experienced", "veteran", "seasoned")

---

### 9. COMPANY_HEADCOUNT Facet
**Purpose:** Filter by company size (employee headcount)

**Syntax:** `Company Headcount: [range1], [range2], ...`

**Supported Patterns:**
- ✅ `Company Headcount: 1-10` - Direct range
- ✅ `Company Headcount: 51-200, 201-500` - Multiple ranges
- ✅ `Company Headcount: Self Employed` - Special case (also accepts "self-employed")
- ✅ `Company Headcount: 100` - Maps single number to appropriate range (51-200)
- ✅ `company headcount: 1-10` - Case insensitive
- ❌ `headcount of 10` - Old natural language syntax (not supported)
- ❌ `50 employees` - Old natural language syntax (not supported)

**Available Values:**
- Self-employed (also accepts: self employed, self-employed)
- 1-10
- 11-50
- 51-200
- 201-500
- 501-1,000
- 1,001-5,000
- 5,001-10,000
- 10,001+

**Testing Results:**
- Structured syntax works correctly
- Supports single ranges, multiple ranges, and single numbers
- Case insensitive
- Old natural language patterns are not supported

---

### 10. COMPANY_TYPE Facet
**Purpose:** Filter by company type

**Syntax:** `Company Type: [type1], [type2], ...`

**Supported Patterns:**
- ✅ `Company Type: Public Company` - Single type
- ✅ `Company Type: Public Company, Non Profit` - Multiple types
- ✅ `company type: privately held` - Case insensitive
- ❌ `public company` - Old natural language syntax (not supported)
- ❌ `private companies` - Old natural language syntax (not supported)

**Available Values:**
- Public Company
- Privately Held
- Educational Institution
- Non Profit (also accepts: nonprofit)
- Self Employed
- Partnership
- Government Agency
- Self Owned

**Testing Results:**
- Structured syntax works correctly
- Supports multiple types
- Case insensitive
- Old natural language patterns are not supported

---

### 11. KEYWORD Facet
**Purpose:** Free-text keyword search across profiles

**Syntax:** `Keyword: [keyword text]`

**Supported Patterns:**
- ✅ `Keyword: Free Diver` - Single keyword
- ✅ `Keyword: scuba diver sales` - Multi-word keyword
- ✅ `keyword: test` - Case insensitive
- ❌ `Free Diver` - Without keyword prefix (not supported)
- ❌ `looking for Free Diver` - Old natural language syntax (not supported)

**Important Notes:**
- Keywords use a special query structure: `(spellCorrectionEnabled:true,keywords:...)`
- Can be combined with other filters
- Spaces in keywords are double-encoded in the URL: `Free Diver` → `Free%2520Diver`
- Supports multiple keywords separated by spaces

**Testing Results:**
- Structured syntax works correctly
- Case insensitive
- Properly encodes spaces for URLs
- Works with combined filters
- Old natural language patterns are not supported

---

## Additional Facets (Not Fully Tested)

The following facets exist in the codebase but were not comprehensively tested:

- YEARS_AT_CURRENT_COMPANY
- YEARS_IN_CURRENT_POSITION
- CURRENT_TITLE
- GROUP
- FOLLOWS_YOUR_COMPANY
- VIEWED_YOUR_PROFILE
- CONNECTION_OF
- PAST_COLLEAGUE
- WITH_SHARED_EXPERIENCES
- RECENTLY_CHANGED_JOBS
- POSTED_ON_LINKEDIN
- LEAD_INTERACTIONS
- SCHOOL
- PERSONA

## Note on KEYWORD Facet

The KEYWORD facet is a special case that uses a different URL structure than other facets. Instead of being part of the `filters` array, keywords are added at the top level of the query with the format:
```
(spellCorrectionEnabled:true,keywords:[keyword text],filters:List(...))
```

When no other filters are present, the URL format is:
```
(spellCorrectionEnabled:true,keywords:[keyword text])
```

## URL Generation

All facets are combined into a single DSL query that gets URL-encoded for the Sales Navigator URL:

```
https://www.linkedin.com/sales/search/people?query=[encoded_dsl]&viewAllFilters=true
```

**Example DSL:**
```
(filters:List((type:FUNCTION,values:List((id:25,text:Sales,selectionType:INCLUDED))),(type:INDUSTRY,values:List((id:4,text:Software Development,selectionType:INCLUDED)))))
```

## Key Findings

1. **Structured Syntax Required**: Most facets require specific structured syntax (e.g., "Function:", "Industry:", "Location:")
2. **Case Insensitive**: Keywords are generally case insensitive
3. **Exclude Logic**: Most facets support "Exclude" keyword for negative filtering
4. **Multiple Values**: Most facets support comma-separated multiple values
5. **Old Syntax Not Supported**: Natural language patterns from previous versions are no longer supported
6. **Exact Matching**: Location and some other facets require exact matches from the database
7. **Special Cases**: Some facets have unique syntax requirements (e.g., TITLE requires quotes)

## Recommendations

1. Always use the structured syntax patterns documented above
2. Test facet combinations to ensure they work together
3. For locations, use the exact names from the geoId.csv database
4. For companies, ensure proper resolution (local data or URL lookup)
5. Avoid old natural language patterns as they are not supported
