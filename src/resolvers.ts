/**
 * HTML-based resolvers for LinkedIn organization IDs
 * ⚠️ Use responsibly. Respect LinkedIn Terms of Service.
 * Only resolve IDs for URLs you explicitly provide.
 */

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const TIMEOUT_MS = 10000;

/**
 * Fetch HTML with retry logic
 */
async function fetchWithRetry(
  url: string,
  retries = 1
): Promise<string | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const response = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Cache-Control": "no-cache",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }
        return null;
      }

      return await response.text();
    } catch (error) {
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }
      console.error(`Failed to fetch ${url}:`, error);
      return null;
    }
  }

  return null;
}

/**
 * Extract organization ID from LinkedIn HTML
 */
function extractOrganizationId(html: string): number | null {
  // Look for urn:li:organization:XXXXXXX
  const match = html.match(/urn:li:organization:(\d+)/);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }
  return null;
}

/**
 * Resolve company ID from LinkedIn company page URL
 * Example: https://www.linkedin.com/company/hubspot/
 */
export async function resolveCompanyIdFromHtml(
  url: string,
  silent = false
): Promise<number | null> {
  if (!silent) {
    console.warn(
      "⚠️  WARNING: Fetching LinkedIn HTML. Use responsibly and respect LinkedIn ToS."
    );
    console.warn(`    Fetching: ${url}`);
  }

  const html = await fetchWithRetry(url);
  if (!html) {
    if (!silent) {
      console.error(`Failed to fetch company page: ${url}`);
    }
    return null;
  }

  const id = extractOrganizationId(html);
  if (id) {
    if (!silent) {
      console.log(`✓ Resolved company ID: ${id}`);
    }
  } else {
    if (!silent) {
      console.error(`Could not extract organization ID from ${url}`);
    }
  }

  // Polite delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  return id;
}

/**
 * Resolve school ID from LinkedIn school page URL
 * Example: https://www.linkedin.com/school/harvard-university/
 */
export async function resolveSchoolIdFromHtml(
  url: string,
  silent = false
): Promise<number | null> {
  if (!silent) {
    console.warn(
      "⚠️  WARNING: Fetching LinkedIn HTML. Use responsibly and respect LinkedIn ToS."
    );
    console.warn(`    Fetching: ${url}`);
  }

  const html = await fetchWithRetry(url);
  if (!html) {
    if (!silent) {
      console.error(`Failed to fetch school page: ${url}`);
    }
    return null;
  }

  const id = extractOrganizationId(html);
  if (id) {
    if (!silent) {
      console.log(`✓ Resolved school ID: ${id}`);
    }
  } else {
    if (!silent) {
      console.error(`Could not extract organization ID from ${url}`);
    }
  }

  // Polite delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  return id;
}

/**
 * Resolve multiple company URLs in parallel (with concurrency limit)
 */
export async function resolveCompanyIds(
  urls: string[],
  concurrency = 2,
  silent = false
): Promise<Map<string, number>> {
  const results = new Map<string, number>();
  const queue = [...urls];

  while (queue.length > 0) {
    const batch = queue.splice(0, concurrency);
    const promises = batch.map(async (url) => {
      const id = await resolveCompanyIdFromHtml(url, silent);
      if (id !== null) {
        results.set(url, id);
      }
    });
    await Promise.all(promises);
  }

  return results;
}

/**
 * Resolve multiple school URLs in parallel (with concurrency limit)
 */
export async function resolveSchoolIds(
  urls: string[],
  concurrency = 2,
  silent = false
): Promise<Map<string, number>> {
  const results = new Map<string, number>();
  const queue = [...urls];

  while (queue.length > 0) {
    const batch = queue.splice(0, concurrency);
    const promises = batch.map(async (url) => {
      const id = await resolveSchoolIdFromHtml(url, silent);
      if (id !== null) {
        results.set(url, id);
      }
    });
    await Promise.all(promises);
  }

  return results;
}

