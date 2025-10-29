# Troubleshooting Guide

## Common Issues

### Error: "Unknown file extension .ts"

**Problem:**
```bash
npx ts-node src/cli.ts "query"
# TypeError: Unknown file extension ".ts"
```

**Cause:**
This project uses ES modules (`"type": "module"` in package.json). Plain `ts-node` doesn't work with ES modules by default.

**Solutions:**

1. **Use pnpm scripts (recommended):**
   ```bash
   pnpm start "your query"  # Uses compiled JavaScript (fast)
   pnpm run dev "your query"  # Runs TypeScript directly (slower)
   ```

2. **Use the ESM loader directly:**
   ```bash
   node --loader ts-node/esm src/cli.ts "your query"
   # or
   npx ts-node --esm src/cli.ts "your query"
   ```

3. **Use compiled JavaScript:**
   ```bash
   pnpm run build
   node dist/src/cli.js "your query"
   ```

---

### No Facets Matched

**Problem:**
```
Matched Facets:
================
(No facets matched)
```

**Possible Causes:**

1. **Outdated compiled code:**
   ```bash
   pnpm run build  # Rebuild the project
   pnpm start "your query"
   ```

2. **Query doesn't match patterns:**
   - Try adding explicit keywords: "software industry" instead of just "software"
   - Use "in boston" instead of just "boston"
   - Check available patterns in QUICKSTART.md

3. **Data not loaded:**
   - Ensure `facet-store.json` and `Industry IDs.csv` are in the project root
   - Check file permissions

---

### Wrong Matches

**Problem:**
Finding unexpected geographies (e.g., "Houston" when searching for "boston")

**Cause:**
Fuzzy matching with Levenshtein distance can match similar-sounding words.

**Solutions:**
- Use more specific queries
- Check what was actually matched with `--debug` flag
- The fuzzy matching threshold is set to 2 characters difference

---

### Title Patterns Not Matching

**Problem:**
```bash
pnpm start 'title manager'  # Doesn't work
```

**Solution:**
Title patterns require quotes:
```bash
pnpm start 'title "manager" exact'
pnpm start 'title contains "manager"'
```

---

### Company/School Resolution Fails

**Problem:**
```
⚠️  WARNING: Fetching LinkedIn HTML
Failed to fetch company page: https://...
```

**Possible Causes:**
1. **Network issues** - Check your internet connection
2. **LinkedIn blocking** - Too many requests
3. **Invalid URL** - Make sure it's a valid LinkedIn company/school URL
4. **Rate limiting** - Wait a few minutes between requests

**Solutions:**
- Verify the URL in your browser first
- Use only when necessary (respects LinkedIn ToS)
- Wait between requests (built-in 500ms delay)

---

### pnpm start Flags Not Working

**Problem:**
```bash
pnpm start "query" --debug  # Doesn't work
```

**Solution:**
Use `--` to separate pnpm flags from script flags:
```bash
pnpm start "query" -- --debug
pnpm start "query" -- --company-url https://...
```

---

## Debug Tips

### 1. Use Debug Mode
```bash
pnpm start "your query" -- --debug
```
Shows:
- What text patterns were matched
- The internal DSL format
- All matched facets with IDs

### 2. Use Dry Run
```bash
pnpm start "your query" -- --dry-run
```
Shows matched facets without generating the URL

### 3. Check Compiled Code
If `pnpm start` behaves differently than `pnpm run dev`:
```bash
pnpm run build  # Rebuild
pnpm start "your query"
```

### 4. Verify Data Files
```bash
ls -lh "facet-store.json" "Industry IDs.csv"
```
Both files should exist in the project root.

### 5. Check Node Version
```bash
node --version  # Should be 18.x or higher
```

---

## Performance

### Slow Performance?

**Development mode** (`pnpm run dev`) is slower because it:
- Compiles TypeScript on the fly
- Doesn't cache compiled code

**Solution:**
Use production mode:
```bash
pnpm run build
pnpm start "your query"
```

**Benchmarks:**
- `pnpm run dev`: ~2-3 seconds
- `pnpm start`: ~0.5-1 seconds

---

## Getting Help

1. Check this troubleshooting guide
2. Review QUICKSTART.md for usage examples
3. Try with `--debug` flag to see what's happening
4. Verify your Node.js version is 18+
5. Ensure dependencies are installed: `pnpm install`

## Still Having Issues?

Run these diagnostic commands:
```bash
# Check Node version
node --version

# Verify dependencies
pnpm list

# Test the build
pnpm run build

# Run tests
pnpm test

# Try a simple query
pnpm start "software industry" -- --debug
```

