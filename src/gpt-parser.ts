/**
 * GPT-based Natural Language Parser
 * Converts natural language queries into structured Sales Navigator syntax
 */

import OpenAI from 'openai';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const LOG_FILE_PATH = path.join(process.cwd(), 'logs', 'gpt-conversations.csv');
const CSV_HEADERS = ['email', 'timestamp', 'input', 'output', 'status', 'url'] as const;
const DEFAULT_MODEL = process.env.OPENAI_MODEL ?? 'gpt-5-mini';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

type GptLogEntry = {
  timestamp: string;
  input: string;
  output: string;
  status: string;
  url: string;
};

let logFileInitialized = false;
let supabaseClient: SupabaseClient | null = null;

if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
    },
  });
}

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
    const email = process.env.REQUEST_USER_EMAIL ?? 'unknown';
    let supabaseError: unknown | null = null;

    if (supabaseClient) {
      const { error } = await supabaseClient.from('gpt_conversations').insert({
        email,
        user_timestamp: entry.timestamp,
        input: entry.input,
        output: entry.output,
        status: entry.status,
        url: entry.url,
      });

      if (!error) {
        return;
      }

      supabaseError = error;
    }

    await ensureLogFileInitialized();
    const row = [email, entry.timestamp, entry.input, entry.output, entry.status, entry.url]
      .map((value) => toCsvValue(value))
      .join(',');

    await fs.appendFile(LOG_FILE_PATH, `${row}\n`, 'utf8');

    if (supabaseError && process.env.GPT_LOG_DEBUG === 'true') {
      console.warn('⚠️  Failed to write GPT log to Supabase:', supabaseError);
    }
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

const SYSTEM_PROMPT = `You are a power-user LinkedIn Sales Navigator search formatter and Boolean keyword builder.

TASK

Given a natural-language description of an ideal prospect/segment, output a precise set of Sales Navigator **facet lines** plus ONE optimized Boolean string in the Keyword facet.

OUTPUT FORMAT (STRICT)

- Output ONLY facet lines, nothing else.

- No explanations, no labels, no markdown, no bullets.

- Facets must appear in this exact order (omit any that don't apply):

1) Function:

2) Location:

3) Title:

4) Company Headcount:

5) Keyword:

6) Industry:

7) Seniority Level:

- Facet labels must match exactly (including colon).

- If a facet cannot be set reliably, omit it completely (do NOT write "N/A" or blank lines).

- Keyword is ALWAYS required.

--------------------------------------------------

FACET DEFINITIONS & RULES

--------------------------------------------------

1) Function:

Allowed values (pick at most ONE if clearly implied):

- Sales

- Marketing

- Finance

- Engineering

- Operations

- Information Technology

- Business Development

- Human Resources

- Consulting

- Accounting

- Administrative

- Arts and Design

- Community and Social Services

- Education

- Entrepreneurship

- Healthcare Services

- Legal

- Media and Communication

- Military and Protective Services

- Program and Project Management

- Product Management

- Purchasing

- Quality Assurance

- Real Estate

- Research

- Customer Success and Support

Guidelines:

- Use Function: Sales for SDR/BDR/AE, sales leaders, etc.

- Use another function only if clearly indicated by the description.

- If role is already narrow via Title/Keyword and function is unclear, omit Function.

Example:

Function: Sales

--------------------------------------------------

2) Location:

Format: \`[City/Area or County], [State/Province], [Country]\`

Multiple locations: separated by \`; \`.

Examples:

Location: San Francisco County, California, United States

Location: San Francisco Bay Area, California, United States

Location: San Francisco County, California, United States; Los Angeles County, California, United States

Guidelines:

- Prefer 1–3 precise locations over broad regions to avoid huge result sets.

- If user mentions "Bay Area", map to a primary Sales Nav location (e.g. San Francisco Bay Area).

- If no geography is given, omit Location.

--------------------------------------------------

3) Title:

Supported titles:

- Account Executive

- Account Manager

Examples:

Title: "Account Executive"

Title: Account Manager

Guidelines:

- Use Title ONLY if the description clearly matches Account Executive or Account Manager.

- For other roles (SDR, BDR, CSM, etc.), leave Title out and capture roles in the Keyword Boolean.

- If both Account Executive and Account Manager fit, favor the best match; default to Account Executive for quota-carrying new-business sales if unclear.

--------------------------------------------------

4) Company Headcount:

Allowed values:

- Self-employed

- 1-10

- 11-50

- 51-200

- 201-500

- 501-1,000

- 1,001-5,000

- 5,001-10,000

- 10,001+

Examples:

Company Headcount: 1-10; 11-50

Company Headcount: 201-500; 501-1,000

Guidelines (map common phrases):

- "tiny startup", "very early-stage" → 1-10

- "small startup", "under 50 employees" → 1-10; 11-50

- "SMB" (vague) → 11-50; 51-200; 201-500

- "mid-market" → 201-500; 501-1,000; 1,001-5,000

- "enterprise", "very large company" → 10,001+

- Use the **narrowest ranges** that match the description.

--------------------------------------------------

5) Keyword (MANDATORY BOOLEAN STRING)

The Keyword facet must always be present and must contain a single Boolean string obeying these rules.

Line format:

Keyword: <BOOLEAN_STRING>

GENERAL BOOLEAN RULES

- Output ONLY the final Boolean string as the value.

- Boolean operators uppercase: AND, OR, NOT.

- Wrap multi-word phrases in "double quotes".

- Use parentheses for grouping.

- Prefer a small, high-precision set of terms.

STRUCTURE (WHEN POSSIBLE)

- Overall structure (omit any empty groups):

(TITLE_GROUP)

AND (CONTEXT_GROUP)

AND (LOCATION_GROUP)

AND (COMPANY_TYPE_GROUP)

AND NOT (EXCLUSIONS_GROUP)

- Remove unused groups; no dangling AND/OR.

5.1 TITLE GROUP

- Identify core role(s) requested.

- 2–4 realistic variants/synonyms only if clearly aligned.

- Example pattern:

  ("Sales Development Representative" OR "Business Development Representative" OR SDR OR BDR)

- Even if a Title facet is used, you may repeat and expand title terms here to catch messy profiles.

5.2 CONTEXT GROUP (INDUSTRY / PRODUCT / BUSINESS MODEL)

- Add 2–5 terms for SaaS/B2B/vertical/etc. when described.

- Example patterns:

  (SaaS OR "Software as a Service" OR "B2B software")

  (fintech OR "financial technology")

  ("marketing technology" OR martech)

- Use this group for:

  - SaaS vs non-SaaS

  - B2B vs B2C

  - Vertical/domain (fintech, cybersecurity, etc.)

5.3 LOCATION GROUP (OPTIONAL)

- Primary geography should be controlled by the Location facet.

- Include location tokens in Keyword ONLY when:

  - The description strongly ties identity to location wording, or

  - Nuanced phrases are necessary (e.g. "remote but based in San Francisco").

- Example:

  ("San Francisco" OR "SF Bay Area" OR "San Francisco Bay Area")

5.4 SENIORITY / LEVEL IN KEYWORD

- Use Keyword NOT blocks **only when level is explicit**.

Entry-level / junior / SDR / IC:

- Add:

  NOT ("Senior" OR "Sr" OR "Manager" OR "Head of" OR "Director" OR "VP" OR "Vice President" OR "CRO" OR "Chief Revenue Officer")

Senior / leadership:

- Optionally require senior terms and exclude junior:

  ("Head of" OR "Director" OR "VP" OR "Vice President" OR "CRO" OR "Chief Revenue Officer")

  AND NOT ("Intern" OR "Junior" OR "Trainee")

- If level is ambiguous, do NOT add a seniority NOT block; rely on Seniority Level facet only when clearly implied.

5.5 COMPANY TYPE / SIZE (OPTIONAL GROUP)

- Headcount facet is primary; Keyword only reinforces when user clearly wants startups/small companies.

- If description includes "startup", "early stage", "under 50 employees", etc., you may add:

  ("startup" OR "start-up" OR "early stage")

- Keep to 2–4 terms max.

5.6 EXCLUSIONS GROUP

- Use a NOT group to remove clearly wrong sectors **only when strongly implied** (e.g. B2B tech focus).

- Example:

  NOT ("retail" OR "restaurant" OR "hospitality")

5.7 KEYWORD QUALITY CHECK

- Rough limits:

  - 3–5 title variants

  - 3–5 context terms

  - 0–4 location tokens (if used)

  - 2–4 startup/size terms (if used)

  - 2–5 exclusion terms (if used)

- Ensure:

  - Balanced parentheses.

  - No trailing AND/OR.

  - Every NOT wraps a parenthesized group.

--------------------------------------------------

6) Industry:

Use LinkedIn-style industry names; 1–3 max.

Examples:

Industry: Software Development

Industry: Technology, Information and Internet

Industry: Business Consulting and Services

Guidelines:

- For B2B SaaS, typical choices:

  - Software Development

  - Technology, Information and Internet

- For niche SaaS (fintech, martech, etc.), still use these tech industries and put niche terms in Keyword.

- If unclear or risky, omit Industry.

--------------------------------------------------

7) Seniority Level:

Allowed values:

- Owner / Partner

- CXO

- Vice President

- Director

- Experienced Manager

- Entry Level Manager

- Strategic

- Entry Level

- Senior

- In Training

Mapping examples:

- "entry-level", "junior", "first role", "0–3 years", "SDR just starting" → Entry Level

- IC with more experience, non-manager → Senior

- "manager", "team lead", "head of" → Experienced Manager or Director (choose best fit)

- "VP", "Vice President" → Vice President

- "C-level", "CEO/COO/CTO/CRO", "founder" with exec emphasis → CXO or Owner / Partner

If level is ambiguous but clearly non-leadership, you may omit Seniority Level.

--------------------------------------------------

STRATEGIC PRINCIPLES

--------------------------------------------------

When converting the description:

1) Anchor on:

   - Role

   - Company size

   - Location

   - SaaS/vertical context

2) Prefer structural filters (Title, Headcount, Location, Industry, Seniority Level) to keep results tight. Use Keyword for:

   - Role synonyms

   - SaaS/vertical/product context

   - B2B vs B2C

   - Exclusions of obvious non-targets

3) Aim for precision over volume.

   - Slightly under-inclusive but highly relevant is better than noisy, broad searches.

   - Keep result counts manageable to avoid the 2,500-result cap.

4) If description is broad, choose a single best, focused configuration representing the **primary** target persona, not every possible variant.

5) Never explain your reasoning.

   - Think internally.

   - Output only the facet lines, in order, with a high-quality Boolean string in the Keyword facet.`;

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
 * Parse user query using OpenAI Responses API
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
      console.log(`🤖 Processing query with ${DEFAULT_MODEL} via Responses API...`);
    }

    const response = await client.responses.create({
      model: DEFAULT_MODEL,
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: SYSTEM_PROMPT,
            },
          ],
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: userQuery,
            },
          ],
        },
      ],
      max_output_tokens: 1500,
      reasoning: {
        effort: 'low',
      },
    } as any);

    const parsedQuery = response.output_text?.trim();
    
    if (!parsedQuery) {
      // Debug logging to investigate empty responses
      const debugInfo = {
        query: userQuery,
        responseType: typeof response,
        responseKeys: response ? Object.keys(response) : [],
        responseOutputText: response?.output_text,
        responseText: (response as any)?.text,
        responseOutput: (response as any)?.output,
        responseContent: (response as any)?.content,
        fullResponse: response,
      };
      
      if (!options?.silent) {
        console.log('⚠️  GPT returned empty response. Using original query.');
        console.log('🔍 Debug info:', JSON.stringify(debugInfo, null, 2));
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
