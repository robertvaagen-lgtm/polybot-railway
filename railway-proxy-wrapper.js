/**
 * Railway Proxy Wrapper
 * Handles SOCKS5 proxying through iProyal for Deno Deploy
 */

import express from 'express';
import http from 'http';
import https from 'https';

const app = express();
app.use(express.json());

const PROXY_HOST = process.env.PROXY_HOST || 'geo.iproyal.com';
const PROXY_PORT = process.env.PROXY_PORT || '12321';
const PROXY_USER = process.env.PROXY_USER || 'XYbRljOszUYnBz4z';
const PROXY_PASS = process.env.PROXY_PASS || '1DfaJvpJifpc5qbJ_country-ie_session-YGGkz6vP_lifetime-168h';

if (!PROXY_USER || !PROXY_PASS) {
  console.error('Missing PROXY_USER or PROXY_PASS env vars');
  process.exit(1);
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', proxy: `${PROXY_HOST}:${PROXY_PORT}` });
});

// Standard proxy endpoint (uses undici fetch - headers get lowercased)
app.post('/fetch', async (req, res) => {
  try {
    const { url, method = 'GET', body, headers = {} } = req.body;
    if (!url) return res.status(400).json({ error: 'Missing url' });

    console.log(`[Proxy] ${method} ${url}`);
    const proxyUrl = `http://${PROXY_USER}:${PROXY_PASS}@${PROXY_HOST}:${PROXY_PORT}`;
    
    // Note: undici fetch lowercases headers - use /fetch-poly for Polymarket
    const response = await fetch(url, {
      method,
      headers: { 'User-Agent': 'PolyBot/1.0', ...headers },
      body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    });
    const data = await response.text();

    res.status(response.status).json({
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers),
      body: data,
    });
  } catch (error) {
    console.error('[Proxy Error]', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Polymarket-specific endpoint using raw http module (PRESERVES exact header casing)
app.post('/fetch-poly', async (req, res) => {
  try {
    const { 
      url, 
      method = 'GET', 
      POLY_ADDRESS, 
      POLY_SIGNATURE, 
      POLY_TIMESTAMP, 
      POLY_API_KEY, 
      POLY_PASSPHRASE,
      body 
    } = req.body;

    if (!url) return res.status(400).json({ error: 'Missing url' });

    console.log(`[Proxy-Poly] ${method} ${url}`);

    // Build headers with EXACT casing (http module preserves case, unlike fetch)
    const headers = {
      'POLY_ADDRESS': POLY_ADDRESS,
      'POLY_SIGNATURE': POLY_SIGNATURE,
      'POLY_TIMESTAMP': POLY_TIMESTAMP,
      'POLY_API_KEY': POLY_API_KEY,
      'POLY_PASSPHRASE': POLY_PASSPHRASE,
      'Content-Type': 'application/json',
      'User-Agent': 'PolyBot/1.0',
    };

    const bodyStr = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined;
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;

    const options = {
      hostname: PROXY_HOST,
      port: parseInt(PROXY_PORT),
      path: `${parsedUrl.protocol}//${parsedUrl.host}${parsedUrl.pathname}${parsedUrl.search}`,
      method,
      headers: {
        ...headers,
        'Proxy-Authorization': `Basic ${Buffer.from(`${PROXY_USER}:${PROXY_PASS}`).toString('base64')}`,
      },
    };

    return new Promise((resolve) => {
      const proxyReq = client.request(options, (proxyRes) => {
        let responseData = '';
        proxyRes.on('data', (chunk) => { responseData += chunk; });
        proxyRes.on('end', () => {
          res.status(proxyRes.statusCode).json({ status: proxyRes.statusCode, body: responseData });
          resolve();
        });
      });

      proxyReq.on('error', (error) => {
        console.error('[fetch-poly error]', error.message);
        res.status(500).json({ error: error.message });
        resolve();
      });

      if (bodyStr) proxyReq.write(bodyStr);
      proxyReq.end();
    });

  } catch (error) {
    console.error('[fetch-poly error]', error.message);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[Railway] Proxy wrapper listening on port ${PORT}`);
  console.log(`[Proxy] Using ${PROXY_HOST}:${PROXY_PORT}`);
});
