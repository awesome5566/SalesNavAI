# Quick Start Guide

## Installation

```bash
npm install
```

## Basic Usage

### Simple Search

```bash
npx ts-node src/cli.ts "software engineers in boston"
```

### Search with Title Filter

```bash
npx ts-node src/cli.ts 'software industry in boston title "Account Executive" exact'
```

### Search with Contains Title

```bash
npx ts-node src/cli.ts 'software industry in boston title contains "manager"'
```

### Multiple Locations

```bash
npx ts-node src/cli.ts "sales leaders in boston or nyc in software industry"
```

### With Debug Output (see DSL)

```bash
npx ts-node src/cli.ts "software engineers in boston" --debug
```

### Dry Run (no URL output)

```bash
npx ts-node src/cli.ts "software engineers in boston" --dry-run
```

## Advanced Usage with Company/School Resolvers

⚠️ **Warning**: These features fetch public LinkedIn pages. Use sparingly and respect LinkedIn ToS.

### Resolve Company ID

```bash
npx ts-node src/cli.ts "account executives at hubspot" \
  --company-url https://www.linkedin.com/company/hubspot/
```

### Resolve School ID

```bash
npx ts-node src/cli.ts "engineers from harvard" \
  --school-url https://www.linkedin.com/school/harvard-university/
```

### Both Company and School

```bash
npx ts-node src/cli.ts "account executives at stripe from stanford" \
  --company-url https://www.linkedin.com/company/stripe/ \
  --school-url https://www.linkedin.com/school/stanford-university/
```

## Running Tests

```bash
npm test
```

## Building for Production

```bash
npm run build
```

Then use the compiled JavaScript:

```bash
node dist/src/cli.js "your search query"
```

## Supported Patterns

### Functions
- "sales", "salespeople", "engineering", "operations"

### Industries
- "software industry" → matches "Software Development"
- "healthcare", "finance", "tech industry"

### Geographies
- "in boston", "nyc" (converts to "new york"), "san francisco"
- Multiple: "in boston or nyc" or "in boston and san francisco"

### Titles
- Exact match: `title "Account Executive" exact`
- Contains match: `title contains "manager"`
- Multiple: `title "VP" exact and title contains "director"`

### Seniority (mapped to PERSONA)
- "vp", "vice president", "c-level", "cxo"

## Tips

1. **Use quotes** around titles: `title "Account Executive" exact`
2. **Multiple locations** use OR logic within the same facet
3. **Different facets** use AND logic (industry AND location AND title)
4. **Debug mode** shows the internal DSL: `--debug`
5. **Dry run** tests parsing without generating URL: `--dry-run`

## Troubleshooting

### No matches found
- Try simplifying your query
- Check spelling
- Use `--debug` to see what was matched

### Wrong matches
- Be more specific with your query
- Use exact match for titles: `title "..." exact`
- Check available data in `Formats copy.json` and `Industry IDs.csv`

### Fuzzy matching too broad
- The matcher uses Levenshtein distance
- Shorter words may match unintended entries
- Use longer, more specific terms

## DSL Format

The tool generates LinkedIn's internal DSL format:

```
(filters:List(
  (type:INDUSTRY,values:List((id:4,text:Software Development,selectionType:INCLUDED))),
  (type:REGION,values:List((id:102380872,text:Boston,selectionType:INCLUDED))),
  (type:TITLE,values:List((text:Account Executive,match:EXACT)))
))
```

This is URL-encoded and appended to the base URL:
```
https://www.linkedin.com/sales/search/people?query=<encoded-dsl>&viewAllFilters=true
```

