import { createClient } from "@supabase/supabase-js";
import { generateUrlFromDescription } from "../src/generator.js";
import { buildGeneratorJsonResponse } from "../src/json-output.js";

type RequestLike = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type ResponseLike = {
  status(code: number): ResponseLike;
  json(body: unknown): ResponseLike | void;
  setHeader(name: string, value: string): void;
};

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Supabase admin credentials are not configured");
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false },
});

function parseBody(body: RequestLike["body"]): Record<string, unknown> {
  if (!body) return {};
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch (error) {
      throw new Error("Invalid JSON body");
    }
  }
  return body as Record<string, unknown>;
}

export default async function handler(req: RequestLike, res: ResponseLike) {
  const routeHitTimestamp = new Date().toISOString();
  console.log(`[TIMESTAMP] Route hit: ${routeHitTimestamp}`);

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authHeader = req.headers.authorization;
  const bearerPrefix = "Bearer ";

  // Type guard: ensure authHeader is a string
  if (!authHeader || typeof authHeader !== "string" || !authHeader.startsWith(bearerPrefix)) {
    return res.status(401).json({ error: "Authorization header missing" });
  }

  // Now TypeScript knows authHeader is a string
  const accessToken = authHeader.slice(bearerPrefix.length).trim();

  if (!accessToken) {
    return res.status(401).json({ error: "Invalid authorization token" });
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);

  if (userError || !userData?.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  let requestBody: Record<string, unknown>;

  try {
    requestBody = parseBody(req.body);
  } catch (error) {
    return res.status(400).json({ error: (error as Error).message });
  }

  const query = typeof requestBody.query === "string" ? requestBody.query.trim() : "";

  if (!query) {
    return res.status(400).json({ error: "Query is required" });
  }

  const previousRequestEmail = process.env.REQUEST_USER_EMAIL;
  if (userData.user.email) {
    process.env.REQUEST_USER_EMAIL = userData.user.email;
  }

  try {
    const result = await generateUrlFromDescription(query);
    const payload = buildGeneratorJsonResponse(result);
    
    const beforeSendTimestamp = new Date().toISOString();
    console.log(`[TIMESTAMP] Before sending response to browser: ${beforeSendTimestamp}`);
    
    // Add diagnostic information
    return res.status(200).json({
      ...payload,
      diagnostics: {
        gptStatus: result.gptStatus || 'unknown',
        pythonStatus: result.pythonStatus || 'unknown',
        hasUrl: !!payload.url,
        urlLength: payload.url?.length || 0,
      }
    });
  } catch (error) {
    console.error("API error:", error);
    
    // Enhanced error response with diagnostics
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorWithStatus = error as any;
    const diagnostics = {
      errorType: error instanceof Error ? error.constructor.name : 'Unknown',
      errorMessage,
      // Extract status from error if available (from generator)
      gptStatus: errorWithStatus.gptStatus || 'unknown',
      pythonStatus: errorWithStatus.pythonStatus || 'unknown',
      // Check if it's a URL builder error (formerly Python, now TypeScript)
      isPythonError: errorMessage.includes('Python') || errorMessage.includes('python') || errorMessage.includes('TypeScript URL builder'),
      // Check if it's a GPT error
      isGPTError: errorMessage.includes('GPT') || errorMessage.includes('OpenAI'),
    };
    
    return res.status(500).json({
      error: "Failed to generate URL",
      details: errorMessage,
      diagnostics,
    });
  } finally {
    process.env.REQUEST_USER_EMAIL = previousRequestEmail;
  }
}

