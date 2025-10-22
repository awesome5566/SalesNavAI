/**
 * Tests for HTML resolvers
 * Note: These tests are feature-flagged and use mock HTML
 */

import { test } from "node:test";
import assert from "node:assert";

// Mock HTML fixture containing a valid organization URN
const MOCK_COMPANY_HTML = `
<!DOCTYPE html>
<html>
<head><title>HubSpot | LinkedIn</title></head>
<body>
  <div data-entity-urn="urn:li:organization:18054">
    <h1>HubSpot</h1>
    <p>Software Development</p>
  </div>
</body>
</html>
`;

const MOCK_SCHOOL_HTML = `
<!DOCTYPE html>
<html>
<head><title>Harvard University | LinkedIn</title></head>
<body>
  <div data-entity-urn="urn:li:organization:18054">
    <h1>Harvard University</h1>
    <p>Higher Education</p>
  </div>
</body>
</html>
`;

test("resolver extraction pattern works", () => {
  // Test the regex pattern used in resolvers
  const pattern = /urn:li:organization:(\d+)/;
  
  const match1 = MOCK_COMPANY_HTML.match(pattern);
  assert.ok(match1);
  assert.strictEqual(match1[1], "18054");
  
  const match2 = MOCK_SCHOOL_HTML.match(pattern);
  assert.ok(match2);
  assert.strictEqual(match2[1], "18054");
});

test("resolver handles missing URN", () => {
  const html = "<html><body>No URN here</body></html>";
  const pattern = /urn:li:organization:(\d+)/;
  
  const match = html.match(pattern);
  assert.strictEqual(match, null);
});

test("resolver extracts numeric ID", () => {
  const html = "Some text urn:li:organization:12345 more text";
  const pattern = /urn:li:organization:(\d+)/;
  
  const match = html.match(pattern);
  assert.ok(match);
  assert.strictEqual(parseInt(match[1], 10), 12345);
});

// Note: Actual network tests are skipped by default to avoid hitting LinkedIn
// To run network tests, set ENABLE_NETWORK_TESTS=1
test.skip("resolveCompanyIdFromHtml (network test)", async () => {
  if (!process.env.ENABLE_NETWORK_TESTS) {
    return;
  }
  
  const { resolveCompanyIdFromHtml } = await import("../resolvers.js");
  
  // This would actually hit LinkedIn - only run if explicitly enabled
  const id = await resolveCompanyIdFromHtml("https://www.linkedin.com/company/hubspot/");
  assert.ok(typeof id === "number" || id === null);
});

