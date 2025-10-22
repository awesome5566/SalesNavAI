#!/usr/bin/env node
/**
 * CLI for Sales Navigator URL Generator
 */

import { generateUrlFromDescription } from "./generator.js";
import type { GeneratorOptions } from "./types.js";

function printHelp() {
  console.log(`
Sales Navigator URL Generator

USAGE:
  npx ts-node src/cli.ts "your search description"

EXAMPLES:
  npx ts-node src/cli.ts "sales leaders in boston and nyc in the software industry"
  
  npx ts-node src/cli.ts "account executives at hubspot from harvard" \\
    --company-url https://www.linkedin.com/company/hubspot/ \\
    --school-url https://www.linkedin.com/school/harvard-university/

FLAGS:
  --company-url <url>   LinkedIn company URL to resolve (can be repeated)
  --school-url <url>    LinkedIn school URL to resolve (can be repeated)
  --dry-run             Show parsed facets and DSL without printing final URL
  --debug               Verbose output
  --json                Output results in JSON format
  --help, -h            Show this help message

DESCRIPTION PATTERNS:
  Functions:      "sales", "engineering", "operations"
  Industries:     "software industry", "healthcare", "finance"
  Geographies:    "in boston", "nyc", "san francisco"
  Titles:         title "Account Executive" exact
                  title contains "manager"
  Companies:      "at CompanyName" (or use --company-url)
  Schools:        "from SchoolName" (or use --school-url)
`);
}

function parseArgs(args: string[]): {
  description: string;
  options: GeneratorOptions;
  dryRun: boolean;
  json: boolean;
  showHelp: boolean;
} {
  const companyUrls: string[] = [];
  const schoolUrls: string[] = [];
  let debug = false;
  let dryRun = false;
  let json = false;
  let showHelp = false;
  const descParts: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      showHelp = true;
    } else if (arg === "--company-url") {
      i++;
      if (i < args.length) {
        companyUrls.push(args[i]);
      }
    } else if (arg === "--school-url") {
      i++;
      if (i < args.length) {
        schoolUrls.push(args[i]);
      }
    } else if (arg === "--debug") {
      debug = true;
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--json") {
      json = true;
    } else if (!arg.startsWith("--")) {
      descParts.push(arg);
    }
  }

  return {
    description: descParts.join(" "),
    options: {
      resolveCompanies: companyUrls.length > 0 ? companyUrls : undefined,
      resolveSchools: schoolUrls.length > 0 ? schoolUrls : undefined,
      debug,
    },
    dryRun,
    json,
    showHelp,
  };
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    printHelp();
    process.exit(0);
  }

  const { description, options, dryRun, json, showHelp } = parseArgs(args);

  if (showHelp) {
    printHelp();
    process.exit(0);
  }

  if (!description.trim()) {
    console.error("Error: No search description provided.\n");
    printHelp();
    process.exit(1);
  }

  // Enable silent mode when JSON output is requested to prevent console pollution
  if (json) {
    options.silent = true;
  }

  try {
    const result = await generateUrlFromDescription(description, options);

    if (json) {
      // Output JSON format for API
      const facets: Record<string, string> = {};
      
      if (result.matched.FUNCTION && result.matched.FUNCTION.length > 0) {
        facets.FUNCTION = result.matched.FUNCTION.map((f) => `${f.text} (${f.id})`).join(", ");
      }
      if (result.matched.INDUSTRY && result.matched.INDUSTRY.length > 0) {
        facets.INDUSTRY = result.matched.INDUSTRY.map((i) => `${i.text} (${i.id})`).join(", ");
      }
      if (result.matched.REGION && result.matched.REGION.length > 0) {
        facets.REGION = result.matched.REGION.map((g) => `${g.text} (${g.id})`).join(", ");
      }
      if (result.matched.PERSONA && result.matched.PERSONA.length > 0) {
        facets.PERSONA = result.matched.PERSONA.map((s) => `${s.text} (${s.id})`).join(", ");
      }
      if (result.matched.TITLE && result.matched.TITLE.length > 0) {
        facets.TITLE = result.matched.TITLE.map((t) => `"${t.text}" (${t.match})`).join(", ");
      }
      if (result.matched.CURRENT_COMPANY && result.matched.CURRENT_COMPANY.length > 0) {
        facets.CURRENT_COMPANY = result.matched.CURRENT_COMPANY.map((c) => `${c.text} (${c.id})`).join(", ");
      }
      if (result.matched.SCHOOL && result.matched.SCHOOL.length > 0) {
        facets.SCHOOL = result.matched.SCHOOL.map((s) => `${s.text} (${s.id})`).join(", ");
      }
      if (result.matched.YEARS_OF_EXPERIENCE && result.matched.YEARS_OF_EXPERIENCE.length > 0) {
        facets.YEARS_OF_EXPERIENCE = result.matched.YEARS_OF_EXPERIENCE.map((y) => `${y.text} (${y.id})`).join(", ");
      }

      const jsonOutput = {
        url: result.url,
        facets: Object.keys(facets).length > 0 ? facets : "(No facets matched)",
        dsl: options.debug || dryRun ? result.dslDecoded : undefined,
        warnings: result.warnings.length > 0 ? result.warnings : undefined
      };

      console.log(JSON.stringify(jsonOutput, null, 2));
    } else {
      // Original console output
      console.log(`Analyzing: "${description}"\n`);

      // Print matched facets
      console.log("Matched Facets:");
      console.log("================");

      if (result.matched.FUNCTION && result.matched.FUNCTION.length > 0) {
        const items = result.matched.FUNCTION.map((f) => `${f.text} (${f.id})`).join(", ");
        console.log(`FUNCTION: ${items}`);
      }

      if (result.matched.INDUSTRY && result.matched.INDUSTRY.length > 0) {
        const items = result.matched.INDUSTRY.map((i) => `${i.text} (${i.id})`).join(", ");
        console.log(`INDUSTRY: ${items}`);
      }

      if (result.matched.REGION && result.matched.REGION.length > 0) {
        const items = result.matched.REGION.map((g) => `${g.text} (${g.id})`).join(", ");
        console.log(`REGION: ${items}`);
      }

      if (result.matched.PERSONA && result.matched.PERSONA.length > 0) {
        const items = result.matched.PERSONA.map((s) => `${s.text} (${s.id})`).join(", ");
        console.log(`PERSONA: ${items}`);
      }

      if (result.matched.TITLE && result.matched.TITLE.length > 0) {
        const items = result.matched.TITLE.map((t) => `"${t.text}" (${t.match})`).join(", ");
        console.log(`TITLE: ${items}`);
      }

      if (result.matched.CURRENT_COMPANY && result.matched.CURRENT_COMPANY.length > 0) {
        const items = result.matched.CURRENT_COMPANY.map((c) => `${c.text} (${c.id})`).join(", ");
        console.log(`CURRENT_COMPANY: ${items}`);
      }

    if (result.matched.SCHOOL && result.matched.SCHOOL.length > 0) {
      const items = result.matched.SCHOOL.map((s) => `${s.text} (${s.id})`).join(", ");
      console.log(`SCHOOL: ${items}`);
    }

    if (result.matched.YEARS_OF_EXPERIENCE && result.matched.YEARS_OF_EXPERIENCE.length > 0) {
      const items = result.matched.YEARS_OF_EXPERIENCE.map((y) => `${y.text} (${y.id})`).join(", ");
      console.log(`YEARS_OF_EXPERIENCE: ${items}`);
    }

      // Check if no matches found
      if (Object.keys(result.matched).length === 0) {
        console.log("(No facets matched)");
      }

      console.log();

      // Print warnings
      if (result.warnings.length > 0) {
        console.log("Warnings:");
        console.log("=========");
        for (const warning of result.warnings) {
          console.log(`⚠️  ${warning}`);
        }
        console.log();
      }

      // Print DSL (if debug or dry-run)
      if (options.debug || dryRun) {
        console.log("DSL (decoded):");
        console.log("==============");
        console.log(result.dslDecoded);
        console.log();
      }

      // Print URL (unless dry-run)
      if (!dryRun) {
        console.log("Sales Navigator URL:");
        console.log("====================");
        console.log(result.url);
      }
    }
  } catch (error) {
    console.error("Error generating URL:", error);
    process.exit(1);
  }
}

main();

