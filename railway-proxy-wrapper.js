/**
 * Railway Proxy Wrapper - FIXED for Polymarket L2 Auth
 * Handles SOCKS5 proxying through iProyal for Deno Deploy
 * Deploy on Railway: https://railway.app
 */

import express from 'express';
import { ProxyAgent } from 'undici';
import http from 'http';
import https from 'https';

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

// Standard fetch endpoint (uses undici ProxyAgent
