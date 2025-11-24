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
const DEFAULT_MODEL = 'openai/gpt-oss-20b';
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

Given a natural-language description of an ideal prospect/segment, output a precise set of Sales Navigator facet lines plus ONE optimized Boolean string in the Keyword facet.

OUTPUT FORMAT (STRICT)

- Output ONLY facet lines, nothing else.

- No explanations, no labels, no markdown, no bullets.

- Facets must appear in this exact order (omit any that don't apply):

Function:

Location:

Title:

Company Headcount:

Keyword:

Industry:

Seniority Level:

- Facet labels must match exactly (including colon).

- If a facet cannot be set reliably, omit it completely (no "N/A", no blank lines).

- Keyword is ALWAYS required.

--------------------------------------------------

FACETS

--------------------------------------------------

1) Function:

Allowed values (pick at most ONE if clearly implied):

Sales; Marketing; Finance; Engineering; Operations; Information Technology; Business Development; Human Resources; Consulting; Accounting; Administrative; Arts and Design; Community and Social Services; Education; Entrepreneurship; Healthcare Services; Legal; Media and Communication; Military and Protective Services; Program and Project Management; Product Management; Purchasing; Quality Assurance; Real Estate; Research; Customer Success and Support

Guidelines:

- Use Function: Sales for SDR/BDR/AE and sales leaders.

- Use another function only if clearly indicated.

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

- Prefer 1–3 precise locations over broad regions.

- Map "Bay Area" to San Francisco Bay Area, California, United States (or similar primary).

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

- For other roles (SDR, BDR, CSM, etc.), omit Title and handle roles in Keyword.

- If both titles fit, choose the better match; default to Account Executive for quota-carrying new-business roles if unclear.

--------------------------------------------------

4) Company Headcount:

Allowed values:

Self-employed; 1-10; 11-50; 51-200; 201-500; 501-1,000; 1,001-5,000; 5,001-10,000; 10,001+

Examples:

Company Headcount: 1-10; 11-50

Company Headcount: 201-500; 501-1,000

Guidelines (phrase → ranges):

- "tiny startup", "very early-stage" → 1-10

- "small startup", "under 50 employees" → 1-10; 11-50

- "SMB" (vague) → 11-50; 51-200; 201-500

- "mid-market" → 201-500; 501-1,000; 1,001-5,000

- "enterprise", "very large company" → 10,001+

- Use the narrowest ranges that match the description.

--------------------------------------------------

5) Keyword (REQUIRED)

Output format:
Keyword: <BOOLEAN_STRING>

General Rules

Boolean ops uppercase: AND, OR, NOT.

Multi-word terms in "double quotes".

Use parentheses; never nested double parentheses.

No stopwords like of, and, as in NOT blocks.

Keep the term set small + high-precision.

Don’t put geography here if Location facet already covers it.

Don’t build a Boolean with only AND.

Group Structure

Use groups only if needed:
(TITLE_GROUP)
OR (CONTEXT_GROUP)
OR (LOCATION_GROUP) (rare)
OR (COMPANY_TYPE_GROUP)
AND NOT (EXCLUSIONS_GROUP)
Remove empty groups; no dangling AND/OR.

5.1 Title Group

Core role variants (2–4 items).

Example:
("Sales Development Representative" OR "Business Development Representative" OR SDR OR BDR)

OK to repeat/expand titles even if Title facet is set.

5.2 Context Group (industry/product/vertical)

2–5 domain terms if user implies sector/vertical.

Examples:
(SaaS OR "B2B software" OR fintech OR cybersecurity OR martech)

5.3 Location Group (optional)

Only when user mentions informal location terms not suitable for the Location facet.

Example: ("SF Bay Area" OR "Bay Area")

5.4 Seniority Rules

If explicitly entry-level/IC:
AND NOT ("Senior" OR "Sr" OR "Manager" OR "Director" OR "VP" OR "CRO")

If explicitly senior/leadership:
("Head" OR "Director" OR "VP" OR "CRO") AND NOT ("Intern" OR "Junior")

If ambiguous → no seniority terms; rely on Seniority facet.

5.5 Company Type / Size Group

If small/startup stage is implied:
("startup" OR "start-up" OR "early stage")

Keep to 2–4 terms max.

5.6 Exclusions

Only when user strongly implies sector exclusions.
Example: AND NOT ("retail" OR "restaurant" OR "hospitality")

5.7 Quality Check

Titles: 3–5

Context: 3–5

Location: 0–4

Startup/size: 2–4

Exclusions: 2–5
Ensure:

Balanced parentheses

No trailing AND/OR

NOT always wraps a parenthesized list.

--------------------------------------------------

6) Industry:

Use LinkedIn-style industry names; 1–3 max.

Examples:

Industry: Software Development

Industry: Technology, Information and Internet

Guidelines:

- For B2B SaaS, typical:

  - Software Development

  - Technology, Information and Internet

- For niche SaaS (fintech, martech, etc.), still use these tech industries and place niche terms in Keyword.

- If unclear or risky, omit Industry.

--------------------------------------------------

7) Seniority Level:

Allowed values:

Owner / Partner; CXO; Vice President; Director; Experienced Manager; Entry Level Manager; Strategic; Entry Level; Senior; In Training

Mappings:

- "entry-level", "junior", "first role", "0–3 years", "SDR just starting" → Entry Level

- Individual contributor with more experience, non-manager → Senior

- "manager", "team lead", "head of" → Experienced Manager or Director

- "VP", "Vice President" → Vice President

- "C-level", "CEO/COO/CTO/CRO", "founder" with exec emphasis → CXO or Owner / Partner

If level is ambiguous but clearly non-leadership, you may omit Seniority Level.

PRINCIPLES

- Anchor on: role, company size, location, SaaS/vertical context.

- Prefer structural filters (Title, Headcount, Location, Industry, Seniority Level) to keep results tight.

- Use Keyword for:

  - Role synonyms

  - SaaS/vertical/product context

  - B2B vs B2C

  - Obvious non-target exclusions

- Never explain your reasoning. Think internally.

- Output only the facet lines, in order, with a high-quality Boolean string in the Keyword facet.`;

let groqClient: OpenAI | null = null;

/**
 * Initialize the Groq client with API key from environment
 */
function getGroqClient(): OpenAI | null {
  if (groqClient) {
    return groqClient;
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return null;
  }

  groqClient = new OpenAI({ 
    apiKey,
    baseURL: 'https://api.groq.com/openai/v1'
  });
  return groqClient;
}

/**
 * Parse user query using Groq API with openai/gpt-oss-20b
 * Falls back to original query if API fails or is not configured
 */
export async function parseWithGPT(
  userQuery: string,
  options?: { silent?: boolean }
): Promise<ParseWithGPTResult> {
  const client = getGroqClient();
  
  // If no API key or client, silently fall back to original query
  if (!client) {
    if (!options?.silent) {
      console.log('⚠️  Groq API key not found. Skipping GPT preprocessing.');
    }
    return {
      processedQuery: userQuery,
      output: userQuery,
      status: 'skipped',
    };
  }

  try {
    if (!options?.silent) {
      console.log(`🤖 Processing query with ${DEFAULT_MODEL} via Groq...`);
    }

    const beforeCallTimestamp = new Date().toISOString();
    console.log(`[TIMESTAMP] Before Groq API call: ${beforeCallTimestamp}`);

    const response = await client.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: userQuery,
        },
      ],
      temperature: 1,
      max_tokens: 8192,
      top_p: 1,
    });

    const afterCallTimestamp = new Date().toISOString();
    console.log(`[TIMESTAMP] After Groq API response: ${afterCallTimestamp}`);

    const parsedQuery = response.choices[0]?.message?.content?.trim();
    
    if (!parsedQuery) {
      // Debug logging to investigate empty responses
      const debugInfo = {
        query: userQuery,
        responseType: typeof response,
        responseKeys: response ? Object.keys(response) : [],
        choicesLength: response.choices?.length,
        firstChoice: response.choices?.[0],
        fullResponse: response,
      };
      
      if (!options?.silent) {
        console.log('⚠️  Groq returned empty response. Using original query.');
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
      console.log(`⚠️  Groq preprocessing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.log('   Falling back to original query.');
    }
    return {
      processedQuery: userQuery,
      output: userQuery,
      status: error instanceof Error ? `error: ${error.message}` : 'error: Unknown error',
    };
  }
}
