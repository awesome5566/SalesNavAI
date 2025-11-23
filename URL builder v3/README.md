# LinkedIn Sales Navigator URL Builder (TypeScript)

This TypeScript CLI converts user-friendly search criteria into properly formatted LinkedIn Sales Navigator URLs.

## Features
- Converts structured text input into Sales Navigator search URLs
- Supports multiple locations, company headcounts, industries, titles, and keywords
- Maps functions, locations, industries, and seniority levels to their LinkedIn IDs using the provided CSV/JSON data
- Interactive CLI plus single-input and file-driven modes

## Requirements
- Node.js 18+ and npm
- Data files in the project root:
  - `facet-store.json` (mappings for functions, headcounts, seniority levels, etc.)
  - `geoId.csv` (location names and their numeric IDs)
  - `Industry IDs.csv` (industry names and their IDs)

## Setup
Install dependencies:

```bash
npm install
```

## Usage

### Interactive
Run the CLI with no arguments:

```bash
npm start
```

### Single input string

```bash
npm start -- "Function: Sales\nLocation: San Francisco County, California, United States\nTitle: \"Account Executive\""
```

### From a file

```bash
npm start -- --file input.txt
```

### Options
- `--session <id>`: Optional `sessionId` query parameter
- `--recent <id>`: Optional recent search id
- `--data-root <path>`: Directory containing the data files (defaults to current working directory)
- `--help`: Show usage

## Input Format

```
Function: [Function Name]

Location: [Location 1]; [Location 2]; [Location 3]

Title: "[Job Title]"

Company Headcount: [Size 1]; [Size 2]; [Size 3]

Keyword: [Search Keywords with OR/AND operators]

Industry: [Industry Name]

Seniority Level: [Seniority Level]
```

**Example:**

```
Function: Sales

Location: San Francisco County, California, United States; Los Angeles County, California, United States

Title: "Account Executive"

Company Headcount: 1-10; 11-50; 51-200

Keyword: "Account Executive" OR AE OR "B2B SaaS" OR SaaS OR "software sales"
```

## Programmatic Usage

```typescript
import { SalesNavigatorUrlBuilder } from './dist/urlBuilder';

const builder = new SalesNavigatorUrlBuilder({
  facetStorePath: 'facet-store.json',
  geoIdPath: 'geoId.csv',
  industryIdsPath: 'Industry IDs.csv',
});

const inputText = `
Function: Sales
Location: San Francisco County, California, United States
Title: "Account Executive"
`;

const url = builder.buildUrl(inputText, {
  sessionId: 'your-session-id', // Optional
  recentSearchId: '5032030010', // Optional
});

console.log(url);
```

Run `npm run build` to compile to `dist/`, or use `npm start` for ts-node execution.

## Output
The program generates a LinkedIn Sales Navigator URL that includes:
- All specified filters properly encoded
- Keywords with boolean operators
- URL-safe encoding for special characters

**Note:** The generated URL may not include a `sessionId` parameter. Provide it via `--session` or the programmatic option if your LinkedIn session requires it.

## Limitations
1. **Title IDs**: `facet-store.json` has limited title mappings. Common titles like "Account Executive" are hardcoded; add more in `titleMapping` inside `src/urlBuilder.ts` if needed.
2. **Session IDs**: Session IDs must be obtained from an active LinkedIn session and passed to the tool; they cannot be generated.
3. **Recent Search IDs**: Optional; supply one if continuing a previous search.

## Troubleshooting
- **Location not found**: Ensure the location matches `geoId.csv` exactly, including capitalization and punctuation.
- **Function/Industry not found**: Verify the name against the data files; values may be case-sensitive.
- **Title not found**: Add the title and ID to the `titleMapping` dictionary in `src/urlBuilder.ts`.

## File Structure

```
.
├── src
│   ├── index.ts          # CLI entry point
│   └── urlBuilder.ts     # URL builder logic
├── facet-store.json      # Function, headcount, seniority mappings
├── geoId.csv             # Location mappings
├── Industry IDs.csv      # Industry mappings
├── package.json          # Node project definition
├── tsconfig.json         # TypeScript configuration
└── README.md             # This file
```

## License
This program is provided as-is for building LinkedIn Sales Navigator URLs.
