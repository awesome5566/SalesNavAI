# Sales Navigator URL Generator

A zero-API-key, local-first CLI tool that converts natural language descriptions into shareable LinkedIn Sales Navigator "People" search URLs.

## Features

- 🤖 **AI-powered preprocessing** using GPT-4o-mini to convert natural language to structured syntax
- 🎯 **Rule-based NLP matching** for functions, industries, geographies, titles, and more
- 📊 **Local data loading** from `facet-store.json` and `Industry IDs.csv`
- 🔗 **On-demand HTML resolvers** for company/school LinkedIn URLs (use sparingly)
- 🧪 **Fully tested** with comprehensive unit tests
- 🚀 **TypeScript** with full type safety

## Installation

```bash
pnpm install
```

### Environment Setup

The tool uses GPT-4o-mini to automatically convert natural language queries into the structured syntax required by Sales Navigator. To enable this feature:

1. Copy the `.env.example` file to `.env`:
```bash
cp .env.example .env
```

2. Add your OpenAI API key to the `.env` file:
```
OPENAI_API_KEY=your_openai_api_key_here
```

Get your API key from [OpenAI Platform](https://platform.openai.com/api-keys).

**Note:** If no API key is provided, the tool will fall back to using the original query directly with rule-based matching. The GPT preprocessing enhances the natural language understanding but is not strictly required.

## Usage

With GPT preprocessing enabled, you can use either natural language or structured syntax:

### Natural Language Queries (GPT-powered)

```bash
# Natural language - GPT converts to structured syntax
pnpm run start "Find me VPs of Sales in Boston"
pnpm run start "Software engineers at Google with 5+ years experience"
pnpm run start "Marketing directors in fintech companies"
```

### Structured Syntax (Direct)

```bash
# Structured syntax - works with or without GPT
pnpm run start "Function: Sales in boston and nyc Industry: Software"
```

Or using the dev mode (slower, runs TypeScript directly):

```bash
pnpm run dev "Function: Sales in boston and nyc Industry: Software"
```

### With Title Filters

```bash
pnpm start "title 'Account Executive' exact in boston"
```

### With Company/School Resolution

```bash
pnpm start "account executives Current Company: hubspot from harvard" -- \
  --company-url https://www.linkedin.com/company/hubspot/ \
  --school-url https://www.linkedin.com/school/harvard-university/
```

Note: The `--` before flags is required when using `pnpm start`.

### Dry Run (Show Parsing Only)

```bash
pnpm start "Function: Sales Industry: Software" -- --dry-run
```

### Debug Mode

```bash
pnpm start "Function: Engineering Industry: Technology in sf" -- --debug
```

## Description Patterns

The CLI understands various structured patterns:

| Pattern | Examples |
|---------|----------|
| **Functions** | "Function: Sales", "Function: Engineering, Operations", "Function: Exclude Marketing" |
| **Industries** | "Industry: Software", "Industry: Healthcare, Finance", "Industry: Exclude Technology" |
| **Geographies** | "in boston", "nyc", "san francisco" |
| **Titles** | `title "Account Executive" exact`, `title contains "manager"` |
| **Companies** | "Current Company: HubSpot", "Current Company: HubSpot, Salesforce", "Current Company: Exclude Google" |
| **Past Companies** | "Past Company: Google", "Past Company: Google, Microsoft", "Past Company: Exclude Apple" |
| **Combined** | "Past Company: Google, Microsoft / Current Company: HubSpot" |
| **Schools** | "from SchoolName" (or use `--school-url`) |
| **Company Headcount** | "Company Headcount: 1-10", "Company Headcount: Self Employed", "Company Headcount: 1-10, 11-50, 51-200" |
| **Company Type** | "Company Type: privately held", "Company Type: public company, educational institution" |
| **Seniority Level** | "Seniority Level: director", "Seniority Level: CXO, Vice President", "Seniority Level: Exclude CXO" |

### Company Separator Syntax

When using both Past Company and Current Company in the same query, use `/` to separate them:

- **With separator**: `"Past Company: Google, Microsoft / Current Company: HubSpot"`
- **Without separator**: `"Past Company: Google, Microsoft Current Company: HubSpot"` (also works)

The `/` separator prevents parsing issues when company names might be ambiguous.

### Company Headcount Syntax

The Company Headcount filter uses a specific syntax format:

- **Format**: `Company Headcount: X` (case-insensitive)
- **Single ranges**: `Company Headcount: 1-10`
- **Multiple ranges**: `Company Headcount: 1-10, 11-50, 51-200`
- **Self Employed**: `Company Headcount: Self Employed` (matches both "Self Employed" and "Self-employed", case-insensitive)
- **Single numbers**: `Company Headcount: 50` (maps to appropriate range: 11-50)

**Supported ranges:**
- 1-10
- 11-50  
- 51-200
- 201-500
- 501-1000
- 1001-5000
- 5000+

**Examples:**
```bash
# Single range
pnpm start "Function: Sales Company Headcount: 1-10"

# Multiple ranges  
pnpm start "Function: Engineering Company Headcount: 1-10, 11-50, 51-200"

# Self employed
pnpm start "Function: Consulting Company Headcount: Self Employed"

# Case insensitive
pnpm start "Function: Operations company headcount: 51-200"
```

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
pnpm run build
```

### Test

```bash
pnpm test
```

### Run Locally

Production mode (uses compiled JavaScript, fast):
```bash
pnpm start "your search query here"
```

Development mode (runs TypeScript directly, slower):
```bash
pnpm run dev "your search query here"
```

### Web Interface

The project includes a React web interface for easier use:

```bash
# Start the full application (backend + frontend + server)
./start.sh

# Or manually:
pnpm run build          # Build backend
pnpm run frontend:build # Build frontend
pnpm run server         # Start Express server
```

The web interface will be available at `http://localhost:3001`

### Available Scripts

- `pnpm start` - Run CLI with compiled JavaScript (fast)
- `pnpm run dev` - Run CLI with TypeScript directly (slower)
- `pnpm run build` - Compile TypeScript to JavaScript
- `pnpm test` - Run unit tests
- `pnpm run frontend` - Start Vite dev server for React app
- `pnpm run frontend:build` - Build React application
- `pnpm run server` - Start Express server
- `pnpm run dev:full` - Run full development stack concurrently

## Project Structure

```
SalesNavAI/
├── src/                    # TypeScript source code
│   ├── types.ts           # TypeScript type definitions
│   ├── sanitize.ts        # Text sanitization utilities
│   ├── loaders.ts         # JSON/CSV data loaders
│   ├── gpt-parser.ts      # GPT-4o-mini preprocessing
│   ├── nlp.ts             # Rule-based text matchers
│   ├── resolvers.ts       # HTML-based LinkedIn ID resolvers
│   ├── dsl.ts             # DSL construction and encoding
│   ├── generator.ts       # Main URL generation logic
│   ├── cli.ts             # Command-line interface
│   └── tests/             # Unit tests
│       ├── sanitize.spec.ts
│       ├── loaders.spec.ts
│       ├── nlp.spec.ts
│       ├── dsl.spec.ts
│       └── resolvers.spec.ts
├── frontend/              # React web application
│   └── src/
│       ├── App.tsx        # Main React component
│       ├── components/    # React components
│       │   ├── AuthModal.tsx
│       │   └── AccountManagement.tsx
│       ├── contexts/      # React contexts
│       │   └── AuthContext.tsx
│       └── utils/         # Frontend utilities
│           └── supabase.ts
├── dist/                  # Compiled JavaScript (backend)
├── dist-frontend/         # Built React application
├── facet-store.json       # Facet data with IDs
├── Industry IDs.csv       # Industry mappings
├── server.js              # Express server for web interface
├── start.sh               # Start script for full application
├── stop.sh                # Stop script for application
└── package.json           # Dependencies and scripts
```

## Data Files

- `facet-store.json` - Facet data with IDs (GEOGRAPHY, FUNCTION, etc.)
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
pnpm start "Function: Engineering in seattle Industry: Software"
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
pnpm start "Function: Sales Seniority Level: Vice President in boston or san francisco, title contains 'director', Industry: Software"
```

### Example 3: With Company Headcount

```bash
pnpm start "Function: Sales Company Headcount: 1-10, 11-50 in boston"
```

### Example 4: With Company Type and Seniority Level

```bash
pnpm start "Function: Sales Company Type: privately held Seniority Level: director, vice president"
```

### Example 5: With Seniority Level Exclude

```bash
pnpm start "Function: Engineering Seniority Level: Exclude CXO, Exclude Owner / Partner in san francisco"
```

### Example 6: With Resolvers

```bash
pnpm start "Function: Sales Current Company: stripe from stanford" -- \
  --company-url https://www.linkedin.com/company/stripe/ \
  --school-url https://www.linkedin.com/school/stanford-university/
```

## License

MIT

## Contributing

PRs welcome! Please include tests for new features.

