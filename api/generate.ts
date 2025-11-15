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
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authHeader = req.headers.authorization;
  const bearerPrefix = "Bearer ";

  if (!authHeader || !authHeader.startsWith(bearerPrefix)) {
    return res.status(401).json({ error: "Authorization header missing" });
  }

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
    return res.status(200).json(payload);
  } catch (error) {
    console.error("API error:", error);
    return res.status(500).json({
      error: "Failed to generate URL",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  } finally {
    process.env.REQUEST_USER_EMAIL = previousRequestEmail;
  }
}

