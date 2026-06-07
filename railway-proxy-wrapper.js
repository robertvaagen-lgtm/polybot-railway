const express = require('express');
const fetch = require('node-fetch');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const app = express();
const PORT = process.env.PORT || 3000;

// Parse JSON bodies
app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Original /fetch endpoint (uses node-fetch, normalizes headers to lowercase)
app.post('/fetch', async (req, res) => {
  try {
    const { url, method = 'GET', headers = {}, body = null, poly_auth = {} } = req.body;
    
    // Merge poly_auth into headers (for backwards compatibility)
    const allHeaders = { ...headers, ...poly_auth };
    
    const options = {
      method,
      headers: allHeaders,
      timeout: 25000,
    };
    
    if (body && method !== 'GET') {
      options.body = typeof body === 'string' ? body : JSON.stringify(body);
    }
    
    const response = await fetch(url, options);
    const responseText = await response.text();
    
    res.json({
      status: response.status,
      body: responseText,
      headers: Object.fromEntries(response.headers.entries())
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      code: error.code || 'UNKNOWN_ERROR'
    });
  }
});

// NEW /fetch-poly endpoint - uses raw https/http modules to preserve exact header casing
app.post('/fetch-poly', async (req, res) => {
  try {
    const { 
      url, 
      method = 'GET', 
      body = null,
      POLY_ADDRESS,
      POLY_SIGNATURE,
      POLY_TIMESTAMP,
      POLY_API_KEY,
      POLY_PASSPHRASE,
      'Content-Type': contentType = 'application/json'
    } = req.body;
    
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    
    // Build headers with EXACT uppercase names (critical for Polymarket L2 auth)
    const headers = {
      'Content-Type': contentType,
    };
    
    // Only add POLY_* headers if they exist (preserves exact casing)
    if (POLY_ADDRESS) headers['POLY_ADDRESS'] = POLY_ADDRESS;
    if (POLY_SIGNATURE) headers['POLY_SIGNATURE'] = POLY_SIGNATURE;
    if (POLY_TIMESTAMP) headers['POLY_TIMESTAMP'] = POLY_TIMESTAMP;
    if (POLY_API_KEY) headers['POLY_API_KEY'] = POLY_API_KEY;
    if (POLY_PASSPHRASE) headers['POLY_PASSPHRASE'] = POLY_PASSPHRASE;
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: method.toUpperCase(),
      headers: headers,
      timeout: 25000,
    };
    
    const lib = isHttps ? https : http;
    
    const requestPromise = new Promise((resolve, reject) => {
      const req = lib.request(options, (response) => {
        let data = '';
        
        response.on('data', (chunk) => {
          data += chunk;
        });
        
        response.on('end', () => {
          resolve({
            status: response.statusCode,
            body: data,
            headers: response.headers
          });
        });
      });
      
      request.on('error', (error) => {
        reject(error);
      });
      
      request.on('timeout', () => {
        request.destroy();
        reject(new Error('Request timeout'));
      });
      
      // Send body for POST/PUT/PATCH requests
      if (body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
        request.write(typeof body === 'string' ? body : JSON.stringify(body));
      }
      
      request.end();
    });
    
    const result = await requestPromise;
    
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: error.message,
      code: error.code || 'UNKNOWN_ERROR'
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
  console.log(`Endpoints available: /health, /fetch, /fetch-poly`);
});
