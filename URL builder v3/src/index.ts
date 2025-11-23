import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { SalesNavigatorUrlBuilder } from './urlBuilder';

type CliOptions = {
  inputText?: string;
  inputFile?: string;
  sessionId?: string;
  recentSearchId?: string;
  dataRoot: string;
};

function parseArguments(argv: string[]): CliOptions {
  const args = [...argv];
  const options: CliOptions = { dataRoot: process.cwd() };

  const takeValue = (flag: string): string | undefined => {
    const index = args.indexOf(flag);
    if (index !== -1 && args[index + 1]) {
      const value = args[index + 1];
      args.splice(index, 2);
      return value;
    }
    return undefined;
  };

  options.inputFile = takeValue('--file');
  options.sessionId = takeValue('--session');
  options.recentSearchId = takeValue('--recent');
  const dataRootArg = takeValue('--data-root');
  if (dataRootArg) {
    options.dataRoot = dataRootArg;
  }

  if (!options.inputFile && args[0] && !args[0].startsWith('--')) {
    options.inputText = args[0];
  }

  return options;
}

function buildBuilder(dataRoot: string): SalesNavigatorUrlBuilder {
  const facetStorePath = path.join(dataRoot, 'facet-store.json');
  const geoIdPath = path.join(dataRoot, 'geoId.csv');
  const industryIdsPath = path.join(dataRoot, 'Industry IDs.csv');

  return new SalesNavigatorUrlBuilder({
    facetStorePath,
    geoIdPath,
    industryIdsPath,
  });
}

function printUsage(): void {
  console.log('LinkedIn Sales Navigator URL Builder (TypeScript)');
  console.log('');
  console.log('Usage:');
  console.log('  npm start -- "Function: Sales\\nLocation: San Francisco County, California, United States"');
  console.log('  npm start -- --file input.txt');
  console.log('  npm start (interactive mode)');
  console.log('');
  console.log('Options:');
  console.log('  --file <path>       Read input from a file');
  console.log('  --session <id>      Optional sessionId parameter for the URL');
  console.log('  --recent <id>       Optional recent search id');
  console.log('  --data-root <path>  Directory that contains facet-store.json and CSVs (defaults to CWD)');
  console.log('  --help              Show this help text');
}

function outputUrl(builder: SalesNavigatorUrlBuilder, input: string, options: CliOptions): void {
  const url = builder.buildUrl(input, {
    sessionId: options.sessionId,
    recentSearchId: options.recentSearchId,
  });

  console.log('\nGenerated URL:');
  console.log(url);
  console.log('\nNote: Add a sessionId parameter if your LinkedIn session requires it.');
}

async function runInteractive(builder: SalesNavigatorUrlBuilder, options: CliOptions): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const question = (promptText = ''): Promise<string> =>
    new Promise((resolve) => rl.question(promptText, resolve));

  console.log('============================================================');
  console.log('LinkedIn Sales Navigator URL Builder - Interactive Mode');
  console.log('============================================================');
  console.log('\nEnter your search criteria (one field per line):');
  console.log('  - Function: [name]');
  console.log('  - Location: [location1]; [location2]; ...');
  console.log('  - Title: "[title]"');
  console.log('  - Company Headcount: [size1]; [size2]; ...');
  console.log('  - Keyword: [keywords with OR/AND]');
  console.log('  - Industry: [industry name]');
  console.log('  - Seniority Level: [level]');
  console.log('\nType "done" on a new line when finished, or "quit" to exit');
  console.log('------------------------------------------------------------');

  try {
    while (true) {
      console.log('\nEnter search criteria:');
      const lines: string[] = [];

      while (true) {
        const line = await question('');
        const trimmed = line.trim();

        if (['quit', 'exit', 'q'].includes(trimmed.toLowerCase())) {
          rl.close();
          console.log('\nGoodbye!');
          return;
        }

        if (trimmed.toLowerCase() === 'done' || (!trimmed && lines.length)) {
          break;
        }

        if (trimmed) {
          lines.push(line);
        }
      }

      if (!lines.length) {
        console.log('No input provided. Try again.');
        continue;
      }

      const inputText = lines.join('\n');
      console.log('\nProcessing...');
      outputUrl(builder, inputText, options);
    }
  } catch (error) {
    console.error(`\nError: ${error}`);
    console.error('Please try again.');
  } finally {
    rl.close();
  }
}

async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2);

  if (rawArgs.includes('--help') || rawArgs.includes('-h')) {
    printUsage();
    return;
  }

  const options = parseArguments(rawArgs);
  const builder = buildBuilder(options.dataRoot);

  if (options.inputFile) {
    const filePath = path.resolve(options.inputFile);
    const input = fs.readFileSync(filePath, 'utf8');
    outputUrl(builder, input, options);
    return;
  }

  if (options.inputText) {
    outputUrl(builder, options.inputText, options);
    return;
  }

  await runInteractive(builder, options);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
