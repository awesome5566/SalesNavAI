"""
Vercel Serverless Function: LinkedIn Sales Navigator URL Builder

This function receives GPT-formatted facet lines and returns a LinkedIn Sales Navigator URL.
"""

from http.server import BaseHTTPRequestHandler
import json
import sys
import os

# Add the current directory to Python path for imports
sys.path.append(os.path.dirname(__file__))

from url_builder_lib import SalesNavigatorURLBuilder


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        """Handle POST requests to build URLs."""
        try:
            # Read and parse request body
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            
            try:
                data = json.loads(body.decode('utf-8'))
            except json.JSONDecodeError as e:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                error_response = {
                    'error': 'Invalid JSON in request body',
                    'details': str(e)
                }
                self.wfile.write(json.dumps(error_response).encode('utf-8'))
                return
            
            # Get the input text (GPT-formatted facet lines)
            input_text = data.get('input', '')
            if not input_text or not input_text.strip():
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                error_response = {
                    'error': 'Missing or empty "input" field in request body'
                }
                self.wfile.write(json.dumps(error_response).encode('utf-8'))
                return
            
            # Get data file paths - try multiple possible locations
            # In Vercel, files can be in different locations depending on deployment
            api_dir = os.path.dirname(__file__)
            parent_dir = os.path.dirname(api_dir)
            cwd = os.getcwd()
            
            # Find the first existing path for each file
            def find_file(filename):
                for base_path in [parent_dir, cwd, '.']:
                    full_path = os.path.join(base_path, filename)
                    if os.path.exists(full_path):
                        return full_path
                # Default fallback to parent directory
                return os.path.join(parent_dir, filename)
            
            facet_store_path = find_file('facet-store.json')
            geo_id_path = find_file('geoId.csv')
            industry_ids_path = find_file('Industry IDs.csv')
            
            # Initialize the URL builder
            try:
                builder = SalesNavigatorURLBuilder(
                    facet_store_path,
                    geo_id_path,
                    industry_ids_path
                )
            except FileNotFoundError as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                error_response = {
                    'error': 'Data files not found',
                    'details': str(e),
                    'paths_checked': {
                        'facet_store': facet_store_path,
                        'geo_id': geo_id_path,
                        'industry_ids': industry_ids_path
                    }
                }
                self.wfile.write(json.dumps(error_response).encode('utf-8'))
                return
            
            # Build the URL
            try:
                url = builder.build_url(input_text)
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                error_response = {
                    'error': 'Failed to build URL',
                    'details': str(e),
                    'type': type(e).__name__
                }
                self.wfile.write(json.dumps(error_response).encode('utf-8'))
                return
            
            # Return successful response
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            response = {
                'url': url,
                'status': 'success'
            }
            self.wfile.write(json.dumps(response).encode('utf-8'))
            
        except Exception as e:
            # Catch-all for any unexpected errors
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            error_response = {
                'error': 'Internal server error',
                'details': str(e),
                'type': type(e).__name__
            }
            self.wfile.write(json.dumps(error_response).encode('utf-8'))
    
    def do_GET(self):
        """Handle GET requests (for testing)."""
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        response = {
            'message': 'LinkedIn Sales Navigator URL Builder API',
            'usage': 'Send POST request with JSON body containing "input" field with GPT-formatted facet lines',
            'status': 'ready'
        }
        self.wfile.write(json.dumps(response).encode('utf-8'))
