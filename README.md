# Sales Navigator URL Generator

A zero-API-key, local-first CLI tool that converts natural language descriptions into shareable LinkedIn Sales Navigator "People" search URLs.

## Features

- 🎯 **Rule-based NLP matching** for functions, industries, geographies, titles, and more
- 📊 **Local data loading** from `Formats copy.json` and `Industry IDs.csv`
- 🔗 **On-demand HTML resolvers** for company/school LinkedIn URLs (use sparingly)
- 🧪 **Fully tested** with comprehensive unit tests
- 🚀 **TypeScript** with full type safety

## Installation

```bash
npm install
```

## Usage

### Basic Search

```bash
npm run start "sales leaders in boston and nyc in the software industry"
```

Or using the dev mode (slower, runs TypeScript directly):

```bash
npm run dev "sales leaders in boston and nyc in the software industry"
```

### With Title Filters

```bash
npm start "title 'Account Executive' exact in boston"
```

### With Company/School Resolution

```bash
npm start "account executives at hubspot from harvard" -- \
  --company-url https://www.linkedin.com/company/hubspot/ \
  --school-url https://www.linkedin.com/school/harvard-university/
```

Note: The `--` before flags is required when using `npm start`.

### Dry Run (Show Parsing Only)

```bash
npm start "sales leaders in software" -- --dry-run
```

### Debug Mode

```bash
npm start "engineering managers in sf" -- --debug
```

## Description Patterns

The CLI understands various natural language patterns:

| Pattern | Examples |
|---------|----------|
| **Functions** | "sales", "engineering", "operations", "salespeople" |
| **Industries** | "software industry", "healthcare", "finance" |
| **Geographies** | "in boston", "nyc", "san francisco" |
| **Titles** | `title "Account Executive" exact`, `title contains "manager"` |
| **Companies** | "at CompanyName" (or use `--company-url`) |
| **Schools** | "from SchoolName" (or use `--school-url`) |

## DSL Structure

The tool generates LinkedIn's internal DSL format:

```
(filters:List(
  (type:FUNCTION,values:List((id:25,text:Sales,selectionType:INCLUDED))),
  (type:INDUSTRY,values:List((id:4,text:Software,selectionType:INCLUDED))),
  (type:REGION,values:List((id:102380872,text:Boston)))
))
```

**Logic:**
- Multiple facets = **AND** (different `type:` blocks)
- Values within a facet = **OR** (multiple entries in `values:List(...)`)

## Development

### Build

```bash
npm run build
```

### Test

```bash
npm test
```

### Run Locally

Production mode (uses compiled JavaScript, fast):
```bash
npm start "your search query here"
```

Development mode (runs TypeScript directly, slower):
```bash
npm run dev "your search query here"
```

## Project Structure

```
src/
├── types.ts          # TypeScript type definitions
├── sanitize.ts       # Text sanitization utilities
├── loaders.ts        # JSON/CSV data loaders
├── nlp.ts            # Rule-based text matchers
├── resolvers.ts      # HTML-based LinkedIn ID resolvers
├── dsl.ts            # DSL construction and encoding
├── generator.ts      # Main URL generation logic
├── cli.ts            # Command-line interface
└── tests/            # Unit tests
    ├── sanitize.spec.ts
    ├── loaders.spec.ts
    ├── nlp.spec.ts
    ├── dsl.spec.ts
    └── resolvers.spec.ts
```

## Data Files

- `Formats copy.json` - Watcher exports with facet IDs (GEOGRAPHY, FUNCTION, etc.)
- `Industry IDs.csv` - Industry mappings (displayValue, id, headline)

## Resolvers & LinkedIn ToS

⚠️ **Warning:** The HTML resolvers fetch public LinkedIn pages to extract organization IDs. Use responsibly:

- Only resolve URLs you explicitly provide via `--company-url` or `--school-url`
- Don't automate mass scraping
- Respect LinkedIn's Terms of Service and robots.txt
- Consider rate limiting and polite delays (built-in: 500ms between requests)

## Examples

### Example 1: Simple Search

```bash
npx ts-node src/cli.ts "software engineers in seattle"
```

**Output:**
```
Matched Facets:
================
FUNCTION: Engineering (5)
INDUSTRY: Software Development (4)
REGION: Seattle (104116203)

Sales Navigator URL:
====================
https://www.linkedin.com/sales/search/people?query=...
```

### Example 2: Complex Search

```bash
npx ts-node src/cli.ts "vp of sales in boston or san francisco, title contains 'director', software industry"
```

### Example 3: With Resolvers

```bash
npx ts-node src/cli.ts "sales at stripe from stanford" \
  --company-url https://www.linkedin.com/company/stripe/ \
  --school-url https://www.linkedin.com/school/stanford-university/
```

## License

MIT

## Contributing

PRs welcome! Please include tests for new features.

