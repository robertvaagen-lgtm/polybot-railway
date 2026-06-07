/**
 * Railway Proxy Wrapper - FIXED VERSION
 * Handles SOCKS5 proxying through iProyal for Polymarket API
 */

import express from 'express';
import { SocksProxyAgent } from 'socks-proxy-agent';

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

app.get('/health', (req, res) => {
  res.json({ status: 'ok', proxy: `${PROXY_HOST}:${PROXY_PORT}` });
});

//
