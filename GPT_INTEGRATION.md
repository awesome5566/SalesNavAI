# GPT Integration for Natural Language Processing

This project now includes GPT-4o-mini integration to convert natural language queries into structured Sales Navigator syntax.

## Setup

### 1. Get an OpenAI API Key

1. Visit [OpenAI Platform](https://platform.openai.com/api-keys)
2. Sign in or create an account
3. Create a new API key

### 2. Configure Environment Variables

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your OpenAI API key:
   ```
   OPENAI_API_KEY=sk-your-actual-api-key-here
   ```

## How It Works

### Automatic Preprocessing

When you submit a query, the system automatically:

1. **Sends your query to GPT-4o-mini** with a comprehensive system prompt
2. **Converts natural language to structured syntax**
3. **Falls back to original query** if GPT is unavailable or fails
4. **Processes the structured syntax** with existing rule-based matching

### Example Conversions

**Input:** "VPs of Sales in Boston"
**GPT Output:** `Seniority Level: Vice President Function: Sales Location: Boston, Massachusetts, United States`

**Input:** "software engineers at startups in SF, not at Google"
**GPT Output:** `Function: Engineering Industry: Software Company Headcount: 1-10, 11-50 Location: San Francisco County, California, United States Current Company: Exclude Google`

**Input:** "CFOs at fintech companies in NYC"
**GPT Output:** `title "CFO" contains Industry: Finance Location: Manhattan County, New York, United States`

### Graceful Fallback

If any of the following occur, the system falls back to the original query without errors:

- No `OPENAI_API_KEY` in environment
- OpenAI API is unreachable
- API rate limit exceeded
- GPT returns an empty response

## Usage

### CLI

```bash
# Set your API key in .env first
echo "OPENAI_API_KEY=sk-your-key-here" > .env

# Run as normal - GPT preprocessing is automatic
npx ts-node src/cli.ts "VPs of Sales in Boston at tech companies"
```

### Server API

```bash
# Make sure .env file exists with your API key
pnpm run server

# Query the API (GPT preprocessing happens automatically)
curl -X POST http://localhost:3001/api/generate \
  -H "Content-Type: application/json" \
  -d '{"query": "VPs of Sales in Boston at tech companies"}'
```

### Frontend

The frontend automatically benefits from GPT preprocessing when making requests through the server.

## Monitoring

### With Silent Mode (JSON output)

```bash
npx ts-node src/cli.ts "your query" --json
```

GPT preprocessing happens silently, no console output about GPT.

### With Debug Output

```bash
npx ts-node src/cli.ts "your query"
```

You'll see:
```
🤖 Processing query with GPT-4o-mini...
✅ GPT preprocessing complete
   Original: "VPs of Sales in Boston"
   Parsed:   "Seniority Level: Vice President Function: Sales Location: Boston, Massachusetts, United States"
```

## Cost Considerations

GPT-4o-mini is very cost-effective:
- **Input:** ~$0.15 per 1M tokens
- **Output:** ~$0.60 per 1M tokens

Typical query:
- System prompt: ~1,500 tokens (sent each time)
- User query: ~10-50 tokens
- Response: ~50-200 tokens
- **Cost per query:** ~$0.0003 (less than a cent)

## System Prompt

The GPT system prompt is designed to:
- Convert natural language to exact structured syntax
- Follow all documented facet patterns
- Preserve user intent
- Handle edge cases (locations, exclusions, etc.)
- Output ONLY structured syntax (no explanations)

The full system prompt is in `src/gpt-parser.ts` and is based on `FACET_SYNTAX_DOCUMENTATION.md`.

## Troubleshooting

### "OpenAI API key not found"

Make sure you have a `.env` file with `OPENAI_API_KEY=your-key-here`

### GPT responses seem wrong

The system will fall back to rule-based matching, so you'll still get results. You can:
1. Check your API key is valid
2. Verify you have API credits
3. Try with `--debug` to see what GPT is outputting

### API rate limits

If you hit rate limits, the system will silently fall back to the original query and continue working.

## Development

### Testing GPT Integration

```bash
# Build the project
pnpm run build

# Test with a natural language query
node dist/cli.js "software engineers in San Francisco" --json

# Check that GPT preprocessing is working
node dist/cli.js "VPs of Sales in Boston"
```

### Modifying the System Prompt

Edit `src/gpt-parser.ts` and update the `SYSTEM_PROMPT` constant. Then rebuild:

```bash
pnpm run build
```

