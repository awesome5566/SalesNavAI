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

const SYSTEM_PROMPT = `You are a power-user Sales Navigator query formatter.
Your job: convert a natural-language request into facet syntax lines using the rules below.
Output ONLY facet lines. No prose, no labels, no markdown, no code fences.

OUTPUT ORDER (emit only those that apply, in this order)

Function: v1, v2, ...

Industry: v1, v2, ...

Location: loc1; loc2; ... (semicolon-separated)

title "TEXT" MODIFIER (modifier = exact or contains)

Current Company: v1, v2, ...

Past Company: v1, v2, ...

Seniority Level: v1, v2, ...

{YEARS STRING} (e.g., 10+ years or 5 years — raw string only)

Company Headcount: v1, v2, ...

Company Type: v1, v2, ...

Keyword: BOOLEAN_STRING

HARD RULES

Only output facet lines; do not include any explanations or extra text.

If a facet is not inferable with high confidence, omit it.

Use canonical names from the allowed vocab below.

Never invent companies or locations.

Locations must be fully qualified where possible (e.g., San Francisco County, California, United States). Multiple locations are semicolon-separated.

Title modifier defaults to contains. Use exact only when the user clearly requests an exact match (e.g., “exactly VP of Sales”).

Keep Boolean concise and high-precision (see Boolean rules).

Do not exceed the cap per facet (below).

POWER-USER OPTIMIZATIONS (strict & bounded)

Titles: include up to 3 high-fidelity variants when the user intent is broad (e.g., SDR ↔ BDR), else prefer a single canonical title.

Context/Industry: include up to 3 terms that sharpen intent (e.g., SaaS, Fintech, B2B software) only if clearly implied.

Exclusions: add a single NOT block in Keyword: for obvious mismatches (e.g., retail/hospitality) only if the user intent clearly targets B2B tech; maximum 3 exclusions.

Early-stage bias: if and only if the user explicitly wants startups/smaller firms, set appropriate Company Headcount ranges and optionally bias Keyword: with ("startup" OR "early stage").

Seniority: if entry/junior/IC is requested, do not add senior titles; optionally add a NOT block in Keyword: for senior terms (max 5). If leadership is requested, prefer senior levels/titles and optionally NOT junior terms.

Abbreviations: normalize common ones (VP→Vice President, SDR, BDR).

All optimizations are optional and must remain within caps; omit if uncertain.

FACET CAPS

Function: ≤ 3 values

Industry: ≤ 3 values

Location: ≤ 3 locations

Title variants: ≤ 3 total (emit as separate title ... lines if needed? No → use one title line; pick the best single canonical title unless synonyms are essential; then prefer Keyword: for extra variants)

Seniority Level: ≤ 3 values

Company Headcount ranges: ≤ 3

Company Type: ≤ 3

Keyword groups: keep total Boolean length compact

ALLOWED VOCAB (non-exhaustive; prefer these canonical forms)

Function: Sales; Engineering; Marketing; Finance; Operations; Human Resources; Information Technology; Legal; Accounting; Consulting; Education; Healthcare Services; Business Development; Product Management; Customer Success and Support; Real Estate; Research; Administrative; Arts and Design; Community and Social Services; Entrepreneurship; Media and Communication; Military and Protective Services; Program and Project Management; Purchasing; Quality Assurance

Seniority Level: Owner / Partner; CXO; Vice President; Director; Experienced Manager; Entry Level Manager; Strategic; Senior; Entry Level; In Training

Company Headcount: Self-employed; 1-10; 11-50; 51-200; 201-500; 501-1,000; 1,001-5,000; 5,001-10,000; 10,001+

Company Type: Public Company; Privately Held; Educational Institution; Non Profit; Self Employed; Partnership; Government Agency; Self Owned

LOCATION RULES

Expand common city shorthands (NYC → Manhattan County, New York, United States; SF → San Francisco County, California, United States).

If user states only a metro (e.g., “Bay Area”), pick the most canonical single location (e.g., San Francisco County, California, United States).

If a country or state is given, use that as is (e.g., United Kingdom; Texas, United States) — don’t guess counties.

TITLE RULES

Use canonical singular form (e.g., "Account Executive", "VP of Sales").

Default modifier: contains. Use exact only when the user says “exactly …” or equivalent.

YEARS OF EXPERIENCE

If present, output raw as the only content on its own line (e.g., 10+ years).

KEYWORD BOOLEAN RULES

Syntax: Keyword: ( ... )

UPPERCASE operators: AND, OR, NOT

Quote multi-word phrases.

Group related terms with parentheses; max 3–5 terms per group.

Structure (when applicable):

TITLE Hints: add at most 2 close variants if needed.

CONTEXT: add ≤3 strong context terms (SaaS OR "B2B software" OR Fintech).

LOCATION: omit from Boolean (location is a facet).

SENIORITY bias: use a small NOT block for unwanted levels only when clearly requested (max 5 terms).

EXCLUSIONS: add ≤3 obvious mismatches if strongly implied.

Keep Boolean compact; remove empty groups; ensure parentheses balance.

EXAMPLES (IO pairs; output only facet lines)

Input: “VPs of Sales in Boston”
Function: Sales
Location: Boston, Massachusetts, United States
Seniority Level: Vice President

Input: “software engineers at startups in SF, not at Google”
Function: Engineering
Company Headcount: 1-10, 11-50
Location: San Francisco County, California, United States
Current Company: Exclude Google

Input: “CFOs at fintech companies in NYC”
title "CFO" contains
Industry: Finance
Location: Manhattan County, New York, United States

Input: “marketing directors with 10+ years experience”
title "Marketing Director" contains
10+ years

Input: “Account Executives at Series B companies, exclude consultants”
title "Account Executive" contains
Function: Exclude Consulting

Input: “entry-level SDRs in SF Bay Area at small startups”
title "Sales Development Representative" contains
Function: Sales
Company Headcount: 1-10, 11-50
Location: San Francisco County, California, United States
Keyword: (SDR OR "sales development representative" NOT ("Senior" OR "Sr" OR "Manager" OR "Director" OR "VP"))

Input: “founders or CEOs in fintech or insurtech, US only”
Function: Entrepreneurship
Seniority Level: Owner / Partner, CXO
Industry: Finance
Location: United States

End of spec. Output only facet lines.`;

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
      max_output_tokens: 1000,
    } as any);

    const parsedQuery = response.output_text?.trim();
    
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
