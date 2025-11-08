import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('⚠️  Supabase admin credentials are not configured. Requests will be rejected.');
}

const supabaseAdmin =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : null;

app.use(cors());
app.use(express.json());

// Serve static files from the frontend build
app.use(express.static(path.join(__dirname, 'dist-frontend')));

app.post('/api/generate', async (req, res) => {
  try {
    const { query } = req.body;
    const authHeader = req.headers.authorization;
    const bearerPrefix = 'Bearer ';

    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Server auth configuration missing' });
    }

    if (!authHeader || !authHeader.startsWith(bearerPrefix)) {
      return res.status(401).json({ error: 'Authorization header missing' });
    }

    const accessToken = authHeader.slice(bearerPrefix.length).trim();

    if (!accessToken) {
      return res.status(401).json({ error: 'Invalid authorization token' });
    }

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);

    if (userError || !userData?.user?.email) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const requestUserEmail = userData.user.email;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query is required' });
    }

    // Run the CLI tool with environment variables passed through
    const cliPath = path.join(__dirname, 'dist', 'cli.js');
    const child = spawn('node', [cliPath, query, '--json'], {
      cwd: __dirname,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, REQUEST_USER_EMAIL: requestUserEmail }  // Pass environment variables to child process
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code !== 0) {
        console.error('CLI error:', stderr);
        return res.status(500).json({ 
          error: 'Failed to generate URL',
          details: stderr 
        });
      }

      try {
        // Parse the JSON output from the CLI
        const result = JSON.parse(stdout);
        res.json(result);
      } catch (parseError) {
        console.error('Parse error:', parseError);
        console.error('CLI output:', stdout);
        return res.status(500).json({ 
          error: 'Failed to parse CLI output',
          details: stdout 
        });
      }
    });

    child.on('error', (error) => {
      console.error('Spawn error:', error);
      res.status(500).json({ 
        error: 'Failed to start CLI process',
        details: error.message 
      });
    });

  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// Serve the React app for all routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist-frontend', 'index.html'));
});

// Catch-all for React Router (SPA)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist-frontend', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📱 Frontend: http://localhost:${PORT}`);
  console.log(`🔧 API: http://localhost:${PORT}/api/generate`);
});