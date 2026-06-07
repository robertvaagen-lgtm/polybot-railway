import http from 'http';
import https from 'https';
import { URL } from 'url';

const PORT = process.env.PORT || 3000;

// Health check
function handleHealth(req, res) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok', timestamp: Date.now() }));
}

// Parse JSON body
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

// Original /fetch endpoint (uses native fetch, normalizes headers)
async function handleFetch(req, res) {
  try {
    const data = await parseBody(req);
    const { url, method = 'GET', headers = {}, body = null, poly_auth = {} } = data;
    const allHeaders = { ...headers, ...poly_auth };
    
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const lib = isHttps ? https : http;
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: method.toUpperCase(),
      headers: allHeaders,
      timeout: 25000,
    };
    
    const requestPromise = new Promise((resolve, reject) => {
      const request = lib.request(options, (response) => {
        let responseData = '';
        response.on('data', chunk => responseData += chunk);
        response.on('end', () => {
          resolve({
            status: response.statusCode,
            body: responseData,
            headers: response.headers
          });
        });
      });
      
      request.on('error', reject);
      request.on('timeout', () => {
        request.destroy();
        reject(new Error('Request timeout'));
      });
      
      if (body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
        request.write(typeof body === 'string' ? body : JSON.stringify(body));
      }
      request.end();
    });
    
    const result = await requestPromise;
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message, code: error.code || 'UNKNOWN_ERROR' }));
  }
}

// NEW /fetch-poly endpoint - preserves exact uppercase header names
async function handleFetchPoly(req, res) {
  try {
    const data = await parseBody(req);
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
    } = data;
    
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    
    // Build headers with EXACT uppercase names (critical for Polymarket L2 auth)
    const headers = { 'Content-Type': contentType };
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
      const request = lib.request(options, (response) => {
        let responseData = '';
        response.on('data', chunk => responseData += chunk);
        response.on('end', () => {
          resolve({
            status: response.statusCode,
            body: responseData,
            headers: response.headers
          });
        });
      });
      
      request.on('error', reject);
      request.on('timeout', () => {
        request.destroy();
        reject(new Error('Request timeout'));
      });
      
      if (body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
        request.write(typeof body === 'string' ? body : JSON.stringify(body));
      }
      request.end();
    });
    
    const result = await requestPromise;
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message, code: error.code || 'UNKNOWN_ERROR' }));
  }
}

// Create server
const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    handleHealth(req, res);
  } else if (req.method === 'POST' && req.url === '/fetch') {
    await handleFetch(req, res);
  } else if (req.method === 'POST' && req.url === '/fetch-poly') {
    await handleFetchPoly(req, res);
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

server.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
  console.log(`Endpoints available: /health, /fetch, /fetch-poly`);
});
