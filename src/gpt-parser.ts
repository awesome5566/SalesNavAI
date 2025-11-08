/**
 * GPT-based Natural Language Parser
 * Converts natural language queries into structured Sales Navigator syntax
 */

import OpenAI from 'openai';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const LOG_FILE_PATH = path.join(process.cwd(), 'logs', 'gpt-conversations.csv');
const CSV_HEADERS = ['email', 'timestamp', 'input', 'output', 'status', 'url'] as const;

type GptLogEntry = {
  timestamp: string;
  input: string;
  output: string;
  status: string;
  url: string;
};

let logFileInitialized = false;

async function ensureLogFileInitialized(): Promise<void> {
  if (logFileInitialized) {
    return;
  }

  await fs.mkdir(path.dirname(LOG_FILE_PATH), { recursive: true });

  try {
    await fs.access(LOG_FILE_PATH);
  } catch {
    const headerLine = `${CSV_HEADERS.join(',')}\n`;
    await fs.writeFile(LOG_FILE_PATH, headerLine, 'utf8');
  }

  logFileInitialized = true;
}

function toCsvValue(value: string): string {
  const normalized = value.replace(/\r?\n|\r/g, ' ').replace(/"/g, '""');
  return `"${normalized}"`;
}

async function logGptInteraction(entry: GptLogEntry): Promise<void> {
  try {
    await ensureLogFileInitialized();
    const email = process.env.REQUEST_USER_EMAIL ?? 'unknown';
    const row = [
      email,
      entry.timestamp,
      entry.input,
      entry.output,
      entry.status,
      entry.url,
    ]
      .map((value) => toCsvValue(value))
      .join(',');

    await fs.appendFile(LOG_FILE_PATH, `${row}\n`, 'utf8');
  } catch (logError) {
    if (process.env.GPT_LOG_DEBUG === 'true') {
      console.warn(
        '⚠️  Failed to write GPT log:',
        logError instanceof Error ? logError.message : logError
      );
    }
  }
}

export interface ParseWithGPTResult {
  processedQuery: string;
  output: string;
  status: string;
}

export async function logGptConversation(entry: GptLogEntry): Promise<void> {
  await logGptInteraction(entry);
}

const SYSTEM_PROMPT = `You are an expert at converting natural language queries into structured Sales Navigator search syntax.

Your task is to convert user queries into the exact structured syntax required by the Sales Navigator system. Follow these rules precisely:

## CRITICAL RULES:
1. ONLY output the converted structured syntax - no explanations, no preamble, no markdown formatting
2. Preserve all original meaning and intent from the user's query
3. Use ONLY the documented syntax patterns below
4. When a concept doesn't fit a documented pattern, leave it in natural language for fallback processing

## SUPPORTED FACET SYNTAX:

### 1. FUNCTION (Job Functions)
Syntax: \`Function: [value1], [value2], ...\`
Examples:
- "sales people" → "Function: Sales"
- "engineers and marketers" → "Function: Engineering, Marketing"
- "not in marketing" → "Function: Exclude Marketing"
Values: Sales, Engineering, Marketing, Finance, Operations, Human Resources, Information Technology, Legal, Accounting, Consulting, Education, Healthcare Services, Business Development, Product Management, Customer Success and Support, Real Estate, Research, Administrative, Arts and Design, Community and Social Services, Entrepreneurship, Media and Communication, Military and Protective Services, Program and Project Management, Purchasing, Quality Assurance

### 2. INDUSTRY
Syntax: \`Industry: [value1], [value2], ...\`
Examples:
- "in software" → "Industry: Software"
- "tech or healthcare companies" → "Industry: Technology, Healthcare"
- "not in finance" → "Industry: Exclude Finance"
Common mappings: "software" → "Software Development", "tech" → "Technology", "healthcare" → "Health Care"

### 3. LOCATION (Geography)
Syntax: \`Location: [location1]; [location2]; ...\`
IMPORTANT: 
- For common cities, provide best-guess full names like "San Francisco County, California, United States"
- Separate multiple locations with semicolons (not commas)
- Try to expand abbreviations (NYC → New York, SF → San Francisco)
Examples:
- "in Boston" → "Location: Boston, Massachusetts, United States"
- "NYC or SF" → "Location: Manhattan County, New York, United States; San Francisco County, California, United States"

### 4. TITLE
Syntax: \`title "[title]" [modifier]\`
Modifiers: exact | contains (default: contains)
Examples:
- "Account Executives" → \`title "Account Executive" contains\`
- "exactly VP of Sales" → \`title "VP of Sales" exact\`

### 5. CURRENT_COMPANY
Syntax: \`Current Company: [company1], [company2], ...\`
Examples:
- "at Google" → "Current Company: Google"
- "works at Microsoft or Apple" → "Current Company: Microsoft, Apple"
- "not at Facebook" → "Current Company: Exclude Facebook"

### 6. PAST_COMPANY
Syntax: \`Past Company: [company1], [company2], ...\`
Examples:
- "worked at Amazon" → "Past Company: Amazon"
- "previously at Salesforce" → "Past Company: Salesforce"

### 7. SENIORITY_LEVEL
Syntax: \`Seniority Level: [level1], [level2], ...\`
Examples:
- "directors" → "Seniority Level: Director"
- "VPs or C-level" → "Seniority Level: Vice President, CXO"
- "not entry level" → "Seniority Level: Exclude Entry Level"
Values: Owner / Partner, CXO, Vice President, Director, Experienced Manager, Entry Level Manager, Strategic, Senior, Entry Level, In Training
Mappings: "vp" → "Vice President", "c-level" → "CXO", "executives" → "CXO"

### 8. YEARS_OF_EXPERIENCE
Keep as natural language (system handles this automatically):
Examples:
- "5 years experience" → keep as "5 years"
- "10+ years" → keep as "10+ years"

### 9. COMPANY_HEADCOUNT
Syntax: \`Company Headcount: [range1], [range2], ...\`
Examples:
- "50 employees" → "Company Headcount: 51-200"
- "startups" → "Company Headcount: 1-10, 11-50"
- "1000+ employees" → "Company Headcount: 1,001-5,000, 5,001-10,000, 10,001+"
Values: Self-employed, 1-10, 11-50, 51-200, 201-500, 501-1,000, 1,001-5,000, 5,001-10,000, 10,001+

### 10. COMPANY_TYPE
Syntax: \`Company Type: [type1], [type2], ...\`
Examples:
- "public companies" → "Company Type: Public Company"
- "nonprofits" → "Company Type: Non Profit"
Values: Public Company, Privately Held, Educational Institution, Non Profit, Self Employed, Partnership, Government Agency, Self Owned

### 11. KEYWORD
Syntax: \`Keyword: [keyword text]\`
Take the plain-English description and set the keyword search to an extremely accurate Boolean keyword string that can be pasted into LinkedIn Sales Navigator’s search bar or keyword field.

GENERAL RULES
- Output the final Boolean string in keyword syntax: \`Keyword: [keyword text]\`
- Use UPPERCASE for Boolean operators: AND, OR, NOT.
- Wrap multi-word phrases in "double quotes".
- Use parentheses () to group related terms cleanly.
- Prefer fewer, high-precision terms over huge noisy lists.

INTERPRETATION RULES
Given the user’s description of the ideal search:

1. JOB TITLE(S)
   - Identify the core role(s) they want (e.g., “Sales Development Representative”).
   - Add 2–4 realistic synonyms/variants ONLY if they clearly match the intent.
   - Combine with OR inside a title group, e.g.:
     ("Sales Development Representative" OR "Business Development Representative" OR SDR)

2. CONTEXT (INDUSTRY / PRODUCT TYPE)
   - If they mention SaaS / B2B / fintech / etc., add 2–5 key context terms that are likely to appear in profiles or company descriptions.
   - Example pattern:
     (SaaS OR "Software as a Service" OR "B2B software")

3. LOCATION
   - If a geography is specified (e.g., “San Francisco”, “SF Bay Area”, “London”), include 2–4 common textual variants in one group:
     ("San Francisco" OR "SF Bay Area" OR "San Francisco Bay Area")
   - If location is not mentioned, omit location terms (don’t guess).

4. SENIORITY / LEVEL
   - If they say **entry-level / junior / SDR / IC**:
     - EXCLUDE senior roles with a NOT block:
       NOT ("Senior" OR "Sr" OR "Manager" OR "Head of" OR "Director" OR "VP" OR "Vice President" OR "CRO" OR "Chief Revenue Officer")
   - If they clearly want **senior / leadership**:
     - Optionally INCLUDE senior terms and EXCLUDE junior:
       ("Head of" OR "Director" OR "VP" OR "Vice President" OR "CRO" OR "Chief Revenue Officer")
       AND NOT ("Intern" OR "Junior" OR "Trainee")
   - If level is unclear, do NOT add a NOT block.

5. COMPANY SIZE / TYPE (WHEN IMPLIED)
   - LinkedIn doesn’t have company size in keywords, but you can bias toward small/startup by including terms like:
     ("startup" OR "start-up" OR "early stage")
   - Only do this if the user explicitly says “small company”, “startup”, “under 50 employees”, etc.
   - Keep this group small (2–4 terms max) to avoid noise.

6. EXCLUSIONS
   - Use a NOT block to filter obvious mismatch sectors if the description clearly implies B2B tech and not, say, retail or hospitality.
   - Example:
     NOT ("retail" OR "restaurant" OR "hospitality")
   - Only add exclusions when they’re strongly implied by the description.

7. STRUCTURE
   - Combine all groups with AND in this rough order:
     (TITLE_GROUP)
     AND (CONTEXT_GROUP)        [if applicable]
     AND (LOCATION_GROUP)       [if applicable]
     AND (COMPANY_TYPE_GROUP)   [if applicable]
     AND NOT (EXCLUSIONS_GROUP) [if applicable]
   - Remove any empty groups; don’t include dangling ANDs.

8. QUALITY CHECK
   - Ensure the Boolean is not over-complicated:
     - Max ~3–5 title variants.
     - Max ~3–5 context/industry terms.
     - Max ~3–5 exclusions.
   - Make sure parentheses are balanced and there are no trailing AND/OR.

OUTPUT FORMAT
- Return ONLY the Boolean string.
- Do NOT explain your reasoning.
- Do NOT label sections.
- No markdown, no bullets — just the final Boolean.

## CONVERSION EXAMPLES:

Input: "VPs of Sales in Boston"
Output: Seniority Level: Vice President Function: Sales Location: Boston, Massachusetts, United States

Input: "software engineers at startups in SF, not at Google"
Output: Function: Engineering Industry: Software Company Headcount: 1-10, 11-50 Location: San Francisco County, California, United States Current Company: Exclude Google

Input: "CFOs at fintech companies in NYC"
Output: title "CFO" contains Industry: Finance Location: Manhattan County, New York, United States

Input: "marketing directors with 10+ years experience"
Output: title "Marketing Director" contains 10+ years

Input: "Account Executives at Series B companies, exclude consultants"
Output: title "Account Executive" contains Function: Exclude Consulting

Remember: ONLY output the structured syntax. No explanations, no extra text.`;

let openaiClient: OpenAI | null = null;

/**
 * Initialize the OpenAI client with API key from environment
 */
function getOpenAIClient(): OpenAI | null {
  if (openaiClient) {
    return openaiClient;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  openaiClient = new OpenAI({ apiKey });
  return openaiClient;
}

/**
 * Parse user query using GPT-4o-mini
 * Falls back to original query if API fails or is not configured
 */
export async function parseWithGPT(
  userQuery: string,
  options?: { silent?: boolean }
): Promise<ParseWithGPTResult> {
  const client = getOpenAIClient();
  
  // If no API key or client, silently fall back to original query
  if (!client) {
    if (!options?.silent) {
      console.log('⚠️  OpenAI API key not found. Skipping GPT preprocessing.');
    }
    return {
      processedQuery: userQuery,
      output: userQuery,
      status: 'skipped',
    };
  }

  try {
    if (!options?.silent) {
      console.log('🤖 Processing query with GPT-4o-mini...');
    }

    const completion = await client.chat.completions.create({
      model: 'gpt-5',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userQuery }
      ],
      temperature: 0.1, // Low temperature for consistent, structured output
      max_tokens: 500,
    });

    const parsedQuery = completion.choices[0]?.message?.content?.trim();
    
    if (!parsedQuery) {
      if (!options?.silent) {
        console.log('⚠️  GPT returned empty response. Using original query.');
      }
      return {
        processedQuery: userQuery,
        output: userQuery,
        status: 'empty_response',
      };
    }

    if (!options?.silent) {
      console.log('✅ GPT preprocessing complete');
      console.log(`   Original: "${userQuery}"`);
      console.log(`   Parsed:   "${parsedQuery}"`);
    }

    return {
      processedQuery: parsedQuery,
      output: parsedQuery,
      status: 'success',
    };
  } catch (error) {
    // Silently fall back to original query on any error
    if (!options?.silent) {
      console.log(`⚠️  GPT preprocessing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.log('   Falling back to original query.');
    }
    return {
      processedQuery: userQuery,
      output: userQuery,
      status: error instanceof Error ? `error: ${error.message}` : 'error: Unknown error',
    };
  }
}
