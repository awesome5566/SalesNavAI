"""
LinkedIn Sales Navigator URL Builder Library

This module provides the SalesNavigatorURLBuilder class for converting
structured facet input into LinkedIn Sales Navigator URLs.
Adapted for Vercel serverless function use.
"""

import json
import csv
import urllib.parse
import os
from typing import Dict, List, Optional, Tuple


class SalesNavigatorURLBuilder:
    """Builds LinkedIn Sales Navigator URLs from user input."""
    
    def __init__(self, facet_store_path: str, geo_id_path: str, industry_ids_path: str):
        """Initialize the URL builder with data files."""
        self.facet_store = self._load_facet_store(facet_store_path)
        self.geo_mapping = self._load_geo_mapping(geo_id_path)
        self.industry_mapping = self._load_industry_mapping(industry_ids_path)
        
        # Common title mappings (since CURRENT_TITLE in JSON is limited)
        # These can be extended or loaded from a separate file
        self.title_mapping = {
            'Account Executive': '20',
            'Account Manager': '11',
            # Add more as needed
        }
        
    def _load_facet_store(self, path: str) -> Dict:
        """Load facet-store.json and create lookup dictionaries."""
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Create reverse lookups for easier searching
        lookups = {}
        
        # Company Headcount
        lookups['COMPANY_HEADCOUNT'] = {}
        for item in data.get('COMPANY_HEADCOUNT', {}).get('ids', []):
            for record in item.get('records', []):
                if record.get('selectionType') == 'INCLUDED':
                    text = record.get('text', '').strip()
                    if text:
                        lookups['COMPANY_HEADCOUNT'][text] = item['id']
        
        # Function
        lookups['FUNCTION'] = {}
        for item in data.get('FUNCTION', {}).get('ids', []):
            for record in item.get('records', []):
                if record.get('selectionType') == 'INCLUDED':
                    text = record.get('text', '').strip()
                    if text:
                        lookups['FUNCTION'][text] = item['id']
        
        # Seniority Level
        lookups['SENIORITY_LEVEL'] = {}
        for item in data.get('SENIORITY_LEVEL', {}).get('ids', []):
            for record in item.get('records', []):
                if record.get('selectionType') == 'INCLUDED':
                    text = record.get('text', '').strip()
                    if text:
                        lookups['SENIORITY_LEVEL'][text] = item['id']
        
        # Industry
        lookups['INDUSTRY'] = {}
        for item in data.get('INDUSTRY', {}).get('ids', []):
            for record in item.get('records', []):
                if record.get('selectionType') == 'INCLUDED':
                    text = record.get('text', '').strip()
                    if text:
                        lookups['INDUSTRY'][text] = item['id']
        
        # Current Title - note: this is limited in the JSON, may need external lookup
        lookups['CURRENT_TITLE'] = {}
        for item in data.get('CURRENT_TITLE', {}).get('ids', []):
            for record in item.get('records', []):
                if record.get('selectionType') == 'INCLUDED':
                    text = record.get('text', '').strip()
                    if text:
                        lookups['CURRENT_TITLE'][text] = item['id']
        
        return lookups
    
    def _load_geo_mapping(self, path: str) -> Dict[str, str]:
        """Load geoId.csv and create location name to ID mapping."""
        mapping = {}
        with open(path, 'r', encoding='utf-8-sig') as f:  # utf-8-sig handles BOM
            reader = csv.DictReader(f, delimiter=';')
            for row in reader:
                # Handle BOM in column name
                address_key = 'ADDRESS'
                if '\ufeffADDRESS' in row:
                    address_key = '\ufeffADDRESS'
                
                address = row.get(address_key, '').strip()
                geo_id = row.get('GEO_ID', '').strip()
                if address and geo_id:
                    mapping[address] = geo_id
        return mapping
    
    def _load_industry_mapping(self, path: str) -> Dict[str, str]:
        """Load Industry IDs.csv and create industry name to ID mapping."""
        mapping = {}
        with open(path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Try different column names
                display_value = row.get('displayValue', '').strip()
                headline = row.get('headline', '').strip()
                headline_v2 = row.get('headlineV2/text', '').strip()
                industry_id = row.get('id', '').strip()
                
                if industry_id:
                    if display_value:
                        mapping[display_value] = industry_id
                    if headline:
                        mapping[headline] = industry_id
                    if headline_v2:
                        mapping[headline_v2] = industry_id
        return mapping
    
    def _encode_for_query(self, text: str) -> str:
        """Encode text specifically for the query parameter."""
        # Double-encode: %20 becomes %2520
        return urllib.parse.quote(urllib.parse.quote(text, safe=''), safe='')
    
    def _parse_input(self, input_text: str) -> Dict[str, any]:
        """Parse user input into structured data."""
        result = {
            'function': None,
            'location': [],
            'title': None,
            'company_headcount': [],
            'keyword': None,
            'industry': None,
            'seniority_level': None,
        }
        
        lines = input_text.strip().split('\n')
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            # Check for key-value pairs
            if ':' in line:
                key, value = line.split(':', 1)
                key = key.strip()
                value = value.strip()
                
                if key.lower() == 'function':
                    result['function'] = value
                elif key.lower() == 'location':
                    # Handle multiple locations separated by semicolon
                    locations = [loc.strip() for loc in value.split(';') if loc.strip()]
                    result['location'] = locations
                elif key.lower() == 'title':
                    # Remove quotes if present
                    result['title'] = value.strip('"')
                elif key.lower() == 'company headcount':
                    # Handle multiple headcounts separated by semicolon
                    headcounts = [hc.strip() for hc in value.split(';')]
                    result['company_headcount'] = headcounts
                elif key.lower() == 'keyword':
                    result['keyword'] = value
                elif key.lower() == 'industry':
                    result['industry'] = value
                elif key.lower() == 'seniority level':
                    result['seniority_level'] = value
        
        return result
    
    def _build_filter_value(self, filter_type: str, id_value: str, text_value: str) -> str:
        """Build a single filter value entry."""
        encoded_text = self._encode_for_query(text_value)
        return f"(id%3A{id_value}%2Ctext%3A{encoded_text}%2CselectionType%3AINCLUDED)"
    
    def _build_filter(self, filter_type: str, values: List[Tuple[str, str]]) -> str:
        """Build a filter with multiple values."""
        if not values:
            return None
        
        value_parts = []
        for id_val, text_val in values:
            value_parts.append(self._build_filter_value(filter_type, id_val, text_val))
        
        values_list = '%2C'.join(value_parts)
        return f"(type%3A{filter_type}%2Cvalues%3AList({values_list}))"
    
    def _get_function_id(self, function_name: str) -> Optional[str]:
        """Get function ID from name."""
        return self.facet_store['FUNCTION'].get(function_name)
    
    def _get_headcount_id(self, headcount_text: str) -> Optional[str]:
        """Get company headcount ID from text."""
        return self.facet_store['COMPANY_HEADCOUNT'].get(headcount_text)
    
    def _get_location_id(self, location_name: str) -> Optional[str]:
        """Get location ID from name."""
        # Try exact match first
        location_id = self.geo_mapping.get(location_name)
        if location_id:
            return location_id
        
        # Try case-insensitive match
        location_name_lower = location_name.lower()
        for key, value in self.geo_mapping.items():
            if key.lower() == location_name_lower:
                return value
        
        return None
    
    def _get_title_id(self, title_text: str) -> Optional[str]:
        """Get title ID from text. Note: This may need external lookup."""
        # First check the JSON
        title_id = self.facet_store['CURRENT_TITLE'].get(title_text)
        if title_id:
            return title_id
        
        # Then check the hardcoded mapping
        title_id = self.title_mapping.get(title_text)
        if title_id:
            return title_id
        
        # Try case-insensitive match
        for key, value in self.title_mapping.items():
            if key.lower() == title_text.lower():
                return value
        
        return None
    
    def _get_industry_id(self, industry_name: str) -> Optional[str]:
        """Get industry ID from name."""
        return self.industry_mapping.get(industry_name)
    
    def _get_seniority_id(self, seniority_text: str) -> Optional[str]:
        """Get seniority level ID from text."""
        return self.facet_store['SENIORITY_LEVEL'].get(seniority_text)
    
    def build_url(self, input_text: str, session_id: Optional[str] = None, recent_search_id: Optional[str] = None) -> str:
        """Build a Sales Navigator URL from input text."""
        parsed = self._parse_input(input_text)
        
        # Build the query components
        query_parts = []
        
        # Standard boilerplate
        query_parts.append("spellCorrectionEnabled%3Atrue")
        
        # Recent search param
        if recent_search_id:
            query_parts.append(f"recentSearchParam%3A(id%3A{recent_search_id}%2CdoLogHistory%3Atrue)")
        else:
            query_parts.append("recentSearchParam%3A(doLogHistory%3Atrue)")
        
        # Build filters
        filters = []
        warnings = []
        
        # Function filter
        if parsed['function']:
            func_id = self._get_function_id(parsed['function'])
            if func_id:
                filters.append(self._build_filter('FUNCTION', [(func_id, parsed['function'])]))
            else:
                warnings.append(f"Function '{parsed['function']}' not found in facet store")
        
        # Location filter (REGION)
        if parsed['location']:
            location_values = []
            for loc in parsed['location']:
                loc_id = self._get_location_id(loc)
                if loc_id:
                    location_values.append((loc_id, loc))
                else:
                    warnings.append(f"Location '{loc}' not found in geoId.csv")
            if location_values:
                filters.append(self._build_filter('REGION', location_values))
        
        # Title filter (CURRENT_TITLE)
        if parsed['title']:
            title_id = self._get_title_id(parsed['title'])
            if title_id:
                filters.append(self._build_filter('CURRENT_TITLE', [(title_id, parsed['title'])]))
            else:
                warnings.append(f"Title '{parsed['title']}' not found in mappings. Title filter will be skipped.")
        
        # Company Headcount filter
        if parsed['company_headcount']:
            headcount_values = []
            for hc in parsed['company_headcount']:
                hc_id = self._get_headcount_id(hc)
                if hc_id:
                    headcount_values.append((hc_id, hc))
                else:
                    warnings.append(f"Company headcount '{hc}' not found")
            if headcount_values:
                filters.append(self._build_filter('COMPANY_HEADCOUNT', headcount_values))
        
        # Industry filter
        if parsed['industry']:
            industry_id = self._get_industry_id(parsed['industry'])
            if industry_id:
                filters.append(self._build_filter('INDUSTRY', [(industry_id, parsed['industry'])]))
            else:
                warnings.append(f"Industry '{parsed['industry']}' not found")
        
        # Seniority Level filter
        if parsed['seniority_level']:
            seniority_id = self._get_seniority_id(parsed['seniority_level'])
            if seniority_id:
                filters.append(self._build_filter('SENIORITY_LEVEL', [(seniority_id, parsed['seniority_level'])]))
            else:
                warnings.append(f"Seniority level '{parsed['seniority_level']}' not found")
        
        # Add filters to query
        if filters:
            filters_str = '%2C'.join(filters)
            query_parts.append(f"filters%3AList({filters_str})")
        
        # Keywords
        if parsed['keyword']:
            encoded_keyword = self._encode_for_query(parsed['keyword'])
            query_parts.append(f"keywords%3A{encoded_keyword}")
        
        # Combine query parts
        query_string = '%2C'.join(query_parts)
        
        # Build final URL
        base_url = "https://www.linkedin.com/sales/search/people"
        url_parts = [f"query=({query_string})"]
        
        if session_id:
            url_parts.append(f"sessionId={urllib.parse.quote(session_id)}")
        
        url_parts.append("viewAllFilters=true")
        
        final_url = f"{base_url}?{'&'.join(url_parts)}"
        
        return final_url

