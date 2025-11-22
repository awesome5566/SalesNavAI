# LinkedIn Sales Navigator URL Builder

This program converts user-friendly search criteria into properly formatted LinkedIn Sales Navigator URLs.

## Features

- Converts natural language input into Sales Navigator search URLs
- Supports multiple locations, company headcounts, and other filters
- Handles keyword searches with boolean operators (OR, AND)
- Maps function names, locations, industries, and other parameters to their LinkedIn IDs

## Requirements

- Python 3.6 or higher
- The following data files (included):
  - `facet-store.json` - Contains mappings for functions, headcounts, seniority levels, etc.
  - `geoId.csv` - Contains location names and their numeric IDs
  - `Industry IDs.csv` - Contains industry names and their IDs

## Usage

### Basic Usage

Run the script with example input:

```bash
python3 url_builder.py
```

### Using Custom Input

You can provide input in two ways:

1. **Command line argument:**
   ```bash
   python3 url_builder.py "Function: Sales
   Location: San Francisco County, California, United States
   Title: Account Executive"
   ```

2. **From a file:**
   ```bash
   python3 url_builder.py --file input.txt
   ```

### Input Format

The input should follow this format:

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

### Supported Values

#### Functions
- Sales, Marketing, Finance, Engineering, Operations, Information Technology, Business Development, Human Resources, Consulting, and more (see `facet-store.json`)

#### Company Headcount
- Self-employed
- 1-10
- 11-50
- 51-200
- 201-500
- 501-1,000
- 1,001-5,000
- 5,001-10,000
- 10,001+

#### Seniority Levels
- Owner / Partner
- CXO
- Vice President
- Director
- Experienced Manager
- Entry Level Manager
- Senior
- Entry Level
- In Training

#### Locations
Any location from `geoId.csv`. Format should match exactly, e.g.:
- "San Francisco County, California, United States"
- "Los Angeles County, California, United States"

#### Industries
Any industry from `Industry IDs.csv`

#### Titles
Common titles are supported. If a title is not found, you may need to add it to the `title_mapping` dictionary in the code.

## Output

The program generates a LinkedIn Sales Navigator URL that you can use directly in your browser. The URL includes:

- All specified filters properly encoded
- Keywords with boolean operators
- Proper URL encoding for special characters

**Note:** The generated URL may not include a `sessionId` parameter. You may need to add this manually if LinkedIn requires it for your session.

## Programmatic Usage

You can also use the `SalesNavigatorURLBuilder` class in your own Python code:

```python
from url_builder import SalesNavigatorURLBuilder

# Initialize the builder
builder = SalesNavigatorURLBuilder(
    'facet-store.json',
    'geoId.csv',
    'Industry IDs.csv'
)

# Build a URL
input_text = """
Function: Sales
Location: San Francisco County, California, United States
Title: "Account Executive"
"""

url = builder.build_url(
    input_text,
    session_id='your-session-id',  # Optional
    recent_search_id='5032030010'   # Optional
)

print(url)
```

## Limitations

1. **Title IDs**: The `facet-store.json` file has limited title mappings. Common titles like "Account Executive" are hardcoded, but you may need to add others to the `title_mapping` dictionary.

2. **Session IDs**: Session IDs are session-specific and must be obtained from an active LinkedIn session. The program can accept them as a parameter but cannot generate them.

3. **Recent Search IDs**: These are optional and can be provided if you're continuing a previous search.

## Troubleshooting

### Location Not Found
If you get a warning that a location wasn't found:
- Check that the location name exactly matches the format in `geoId.csv`
- Ensure proper capitalization and punctuation
- The format should be: "[County/Region], [State/Province], [Country]"

### Function/Industry Not Found
- Verify the name matches exactly what's in the data files
- Check for typos or extra spaces
- Some values may be case-sensitive

### Title Not Found
- Add the title and its ID to the `title_mapping` dictionary in `url_builder.py`
- You may need to find the title ID by inspecting a Sales Navigator URL that uses that title

## File Structure

```
.
├── url_builder.py          # Main program
├── facet-store.json        # Function, headcount, seniority mappings
├── geoId.csv              # Location mappings
├── Industry IDs.csv       # Industry mappings
└── README.md              # This file
```

## License

This program is provided as-is for building LinkedIn Sales Navigator URLs.

