/**
 * Railway Proxy Wrapper
 * Handles SOCKS5 proxying through iProyal for Deno Deploy
 * Deploy on Railway: https://railway.app
 * 
 * NOTE: This is a separate Node.js project for Railway deployment, not part of the Base44 app.
 */
/* eslint-disable no-undef */

import express from 'express';
import { ProxyAgent } from 'undici';

const app = express();
app.use(express.json());

const PROXY_HOST = process.env.PROXY_HOST || 'geo.iproyal.com';
const PROXY_PORT = process.env.PROXY_PORT || '12321';
const PROXY_USER = process.env.PROXY_USER;
const PROXY_PASS = process.env.PROXY_PASS;

if (!PROXY_USER || !PROXY_PASS) {
  console.error('Missing PROXY_USER or PROXY_PASS env vars');
  process.exit(1);
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', proxy: `${PROXY_HOST}:${PROXY_PORT}` });
});

// Proxy endpoint
app.post('/fetch', async (req, res) => {
  try {
    const { url, method = 'GET', body, headers = {} } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'Missing url' });
    }

    console.log(`[Proxy] ${method} ${url}`);

    // Use HTTP proxy format (undici doesn't support SOCKS5)
    const proxyUrl = `http://${PROXY_USER}:${PROXY_PASS}@${PROXY_HOST}:${PROXY_PORT}`;
    console.log(`[Proxy] Using HTTP proxy: ${PROXY_HOST}:${PROXY_PORT}`);
    const dispatcher = new ProxyAgent(proxyUrl);

    const fetchOptions = {
      method,
      headers: {
        'User-Agent': 'PolyBot/1.0',
        ...headers,
      },
      dispatcher,
    };

    if (body) {
      fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[Railway] Proxy wrapper listening on port ${PORT}`);
  console.log(`[Proxy] Using ${PROXY_HOST}:${PROXY_PORT}`);
});
