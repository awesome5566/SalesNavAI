import fs from 'fs';
import path from 'path';

export type BuilderPaths = {
  facetStorePath: string;
  geoIdPath: string;
  industryIdsPath: string;
};

export type ParsedInput = {
  functionName: string | null;
  location: string[];
  title: string | null;
  companyHeadcount: string[];
  keyword: string | null;
  industry: string | null;
  seniorityLevel: string | null;
};

type FacetLookups = Record<string, Record<string, string>>;

export class SalesNavigatorUrlBuilder {
  private facetStore: FacetLookups;
  private geoMapping: Record<string, string>;
  private industryMapping: Record<string, string>;
  private titleMapping: Record<string, string>;

  constructor(paths: BuilderPaths) {
    this.facetStore = this.loadFacetStore(paths.facetStorePath);
    this.geoMapping = this.loadGeoMapping(paths.geoIdPath);
    this.industryMapping = this.loadIndustryMapping(paths.industryIdsPath);
    this.titleMapping = {
      'Account Executive': '20',
      'Account Manager': '11',
      // Extend this mapping as needed
    };
  }

  private loadFacetStore(filePath: string): FacetLookups {
    const absolutePath = path.resolve(filePath);
    const raw = fs.readFileSync(absolutePath, 'utf8');
    const data = JSON.parse(raw) as Record<string, any>;
    const lookups: FacetLookups = {};

    const buildLookup = (key: string) => {
      lookups[key] = {};
      const ids = data[key]?.ids ?? [];
      ids.forEach((item: any) => {
        const records = item?.records ?? [];
        records.forEach((record: any) => {
          if (record?.selectionType === 'INCLUDED') {
            const text = (record.text ?? '').trim();
            if (text) {
              lookups[key][text] = String(item.id);
            }
          }
        });
      });
    };

    ['COMPANY_HEADCOUNT', 'FUNCTION', 'SENIORITY_LEVEL', 'INDUSTRY', 'CURRENT_TITLE'].forEach(buildLookup);

    return lookups;
  }

  private loadGeoMapping(filePath: string): Record<string, string> {
    const content = fs.readFileSync(path.resolve(filePath), 'utf8');
    const rows = parseDelimitedRecords(content, ';');
    const mapping: Record<string, string> = {};

    rows.forEach((row) => {
      const address = (row['ADDRESS'] || row['\ufeffADDRESS'] || '').trim();
      const geoId = (row['GEO_ID'] || '').trim();
      if (address && geoId) {
        mapping[address] = geoId;
      }
    });

    return mapping;
  }

  private loadIndustryMapping(filePath: string): Record<string, string> {
    const content = fs.readFileSync(path.resolve(filePath), 'utf8');
    const rows = parseDelimitedRecords(content, ',');
    const mapping: Record<string, string> = {};

    rows.forEach((row) => {
      const displayValue = (row['displayValue'] || '').trim();
      const headline = (row['headline'] || '').trim();
      const headlineV2 = (row['headlineV2/text'] || '').trim();
      const industryId = (row['id'] || '').trim();

      if (!industryId) {
        return;
      }

      if (displayValue) {
        mapping[displayValue] = industryId;
      }
      if (headline) {
        mapping[headline] = industryId;
      }
      if (headlineV2) {
        mapping[headlineV2] = industryId;
      }
    });

    return mapping;
  }

  private encodeForQuery(text: string): string {
    return encodeURIComponent(encodeURIComponent(text));
  }

  private parseInput(inputText: string): ParsedInput {
    const result: ParsedInput = {
      functionName: null,
      location: [],
      title: null,
      companyHeadcount: [],
      keyword: null,
      industry: null,
      seniorityLevel: null,
    };

    const lines = inputText.split(/\r?\n/);
    lines.forEach((rawLine) => {
      const line = rawLine.trim();
      if (!line) {
        return;
      }

      const separatorIndex = line.indexOf(':');
      if (separatorIndex === -1) {
        return;
      }

      const key = line.slice(0, separatorIndex).trim().toLowerCase();
      const value = line.slice(separatorIndex + 1).trim();

      switch (key) {
        case 'function':
          result.functionName = value;
          break;
        case 'location': {
          const locations = value
            .split(';')
            .map((loc) => loc.trim())
            .filter(Boolean);
          result.location = locations;
          break;
        }
        case 'title':
          result.title = value.replace(/^"|"$/g, '');
          break;
        case 'company headcount': {
          const headcounts = value
            .split(';')
            .map((hc) => hc.trim())
            .filter(Boolean);
          result.companyHeadcount = headcounts;
          break;
        }
        case 'keyword':
          result.keyword = value;
          break;
        case 'industry':
          result.industry = value;
          break;
        case 'seniority level':
          result.seniorityLevel = value;
          break;
        default:
          break;
      }
    });

    return result;
  }

  private buildFilterValue(idValue: string, textValue: string): string {
    const encodedText = this.encodeForQuery(textValue);
    return `(id%3A${idValue}%2Ctext%3A${encodedText}%2CselectionType%3AINCLUDED)`;
  }

  private buildFilter(filterType: string, values: Array<{ id: string; text: string }>): string | null {
    if (!values.length) {
      return null;
    }

    const valueParts = values.map((value) => this.buildFilterValue(value.id, value.text));
    const valuesList = valueParts.join('%2C');
    return `(type%3A${filterType}%2Cvalues%3AList(${valuesList}))`;
  }

  private getFunctionId(functionName: string): string | undefined {
    return this.facetStore['FUNCTION']?.[functionName];
  }

  private getHeadcountId(headcount: string): string | undefined {
    return this.facetStore['COMPANY_HEADCOUNT']?.[headcount];
  }

  private getLocationId(location: string): string | undefined {
    const direct = this.geoMapping[location];
    if (direct) {
      return direct;
    }

    const lower = location.toLowerCase();
    return Object.entries(this.geoMapping).find(([key]) => key.toLowerCase() === lower)?.[1];
  }

  private getTitleId(title: string): string | undefined {
    const direct = this.facetStore['CURRENT_TITLE']?.[title];
    if (direct) {
      return direct;
    }

    const mapped = this.titleMapping[title];
    if (mapped) {
      return mapped;
    }

    const lower = title.toLowerCase();
    const match = Object.entries(this.titleMapping).find(([key]) => key.toLowerCase() === lower);
    return match?.[1];
  }

  private getIndustryId(industry: string): string | undefined {
    return this.industryMapping[industry];
  }

  private getSeniorityId(seniority: string): string | undefined {
    return this.facetStore['SENIORITY_LEVEL']?.[seniority];
  }

  buildUrl(inputText: string, options?: { sessionId?: string; recentSearchId?: string }): string {
    const parsed = this.parseInput(inputText);
    const queryParts: string[] = [];

    queryParts.push('spellCorrectionEnabled%3Atrue');

    if (options?.recentSearchId) {
      queryParts.push(`recentSearchParam%3A(id%3A${options.recentSearchId}%2CdoLogHistory%3Atrue)`);
    } else {
      queryParts.push('recentSearchParam%3A(doLogHistory%3Atrue)');
    }

    const filters: string[] = [];

    if (parsed.functionName) {
      const funcId = this.getFunctionId(parsed.functionName);
      if (funcId) {
        const filter = this.buildFilter('FUNCTION', [{ id: funcId, text: parsed.functionName }]);
        if (filter) {
          filters.push(filter);
        }
      } else {
        console.warn(`Warning: Function '${parsed.functionName}' not found in facet store`);
      }
    }

    if (parsed.location.length) {
      const locationValues = parsed.location
        .map((loc) => ({ id: this.getLocationId(loc), text: loc }))
        .filter((item): item is { id: string; text: string } => Boolean(item.id));

      parsed.location
        .filter((loc) => !this.getLocationId(loc))
        .forEach((loc) => console.warn(`Warning: Location '${loc}' not found in geoId.csv`));

      const filter = this.buildFilter('REGION', locationValues);
      if (filter) {
        filters.push(filter);
      }
    }

    if (parsed.title) {
      const titleId = this.getTitleId(parsed.title);
      if (titleId) {
        const filter = this.buildFilter('CURRENT_TITLE', [{ id: titleId, text: parsed.title }]);
        if (filter) {
          filters.push(filter);
        }
      } else {
        console.warn(`Warning: Title '${parsed.title}' not found in mappings. Title filter will be skipped.`);
        console.warn('  You may need to add this title to the title mapping.');
      }
    }

    if (parsed.companyHeadcount.length) {
      const values = parsed.companyHeadcount
        .map((hc) => ({ id: this.getHeadcountId(hc), text: hc }))
        .filter((item): item is { id: string; text: string } => Boolean(item.id));

      parsed.companyHeadcount
        .filter((hc) => !this.getHeadcountId(hc))
        .forEach((hc) => console.warn(`Warning: Company headcount '${hc}' not found`));

      const filter = this.buildFilter('COMPANY_HEADCOUNT', values);
      if (filter) {
        filters.push(filter);
      }
    }

    if (parsed.industry) {
      const industryId = this.getIndustryId(parsed.industry);
      if (industryId) {
        const filter = this.buildFilter('INDUSTRY', [{ id: industryId, text: parsed.industry }]);
        if (filter) {
          filters.push(filter);
        }
      } else {
        console.warn(`Warning: Industry '${parsed.industry}' not found`);
      }
    }

    if (parsed.seniorityLevel) {
      const seniorityId = this.getSeniorityId(parsed.seniorityLevel);
      if (seniorityId) {
        const filter = this.buildFilter('SENIORITY_LEVEL', [{ id: seniorityId, text: parsed.seniorityLevel }]);
        if (filter) {
          filters.push(filter);
        }
      } else {
        console.warn(`Warning: Seniority level '${parsed.seniorityLevel}' not found`);
      }
    }

    if (filters.length) {
      const filtersStr = filters.join('%2C');
      queryParts.push(`filters%3AList(${filtersStr})`);
    }

    if (parsed.keyword) {
      const encodedKeyword = this.encodeForQuery(parsed.keyword);
      queryParts.push(`keywords%3A${encodedKeyword}`);
    }

    const queryString = queryParts.join('%2C');
    const urlParts = [`query=(${queryString})`];

    if (options?.sessionId) {
      urlParts.push(`sessionId=${encodeURIComponent(options.sessionId)}`);
    }

    urlParts.push('viewAllFilters=true');

    return `https://www.linkedin.com/sales/search/people?${urlParts.join('&')}`;
  }
}

function parseDelimitedRecords(content: string, delimiter: string): Array<Record<string, string>> {
  const lines = content.split(/\r?\n/).filter((line) => line.trim() !== '');
  if (!lines.length) {
    return [];
  }

  const headers = splitLine(lines[0], delimiter).map((header) => stripBom(header.trim()));
  const rows: Array<Record<string, string>> = [];

  for (let i = 1; i < lines.length; i += 1) {
    const values = splitLine(lines[i], delimiter);
    if (!values.length) {
      continue;
    }

    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = values[index] ? values[index].trim() : '';
    });
    rows.push(record);
  }

  return rows;
}

function splitLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

function stripBom(value: string): string {
  return value.replace(/^\ufeff/, '');
}
