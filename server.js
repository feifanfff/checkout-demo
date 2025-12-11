require('dotenv').config();

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const CHECKOUT_SECRET_KEY = process.env.CHECKOUT_SECRET_KEY;
const CHECKOUT_PUBLIC_KEY = process.env.CHECKOUT_PUBLIC_KEY;
const CHECKOUT_PROCESSING_CHANNEL = process.env.CHECKOUT_PROCESSING_CHANNEL;
const SUCCESS_URL = process.env.SUCCESS_URL || 'http://localhost:3000/?status=success';
const FAILURE_URL = process.env.FAILURE_URL || 'http://localhost:3000/?status=failed';

const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function sendJSON(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function parseJSONBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function logPayload(type, payload) {
  const clone = { ...payload };
  if (clone.source && clone.source.token) {
    clone.source = { ...clone.source, token: '[masked]' };
  }
  console.log(`[checkout] ${type} payload`, JSON.stringify(clone));
}

async function createCheckoutPayment(payload) {
  if (!CHECKOUT_SECRET_KEY) {
    throw new Error('Missing CHECKOUT_SECRET_KEY');
  }

  const res = await fetch('https://api.sandbox.checkout.com/payments', {
    method: 'POST',
    headers: {
      Authorization: CHECKOUT_SECRET_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data && data.message ? data.message : 'Payment request failed';
    const details = data && data.error_codes ? data.error_codes : undefined;
    const requestId = data && data.request_id ? data.request_id : undefined;
    const errorType = data && data.error_type ? data.error_type : undefined;
    const err = new Error(message);
    err.details = details;
    err.requestId = requestId;
    err.errorType = errorType;
    err.body = data;
    throw err;
  }
  return data;
}

async function handleCardPayment(body) {
  if (!body.token || !body.amount || !body.currency) {
    throw new Error('token, amount, and currency are required');
  }
  const payload = {
    source: { type: 'token', token: body.token },
    amount: body.amount,
    currency: body.currency,
    processing_channel_id: CHECKOUT_PROCESSING_CHANNEL,
    reference: body.reference || 'demo-order-card',
    capture: true,
  };
  logPayload('card', payload);
  return createCheckoutPayment(payload);
}

async function handleIdealPayment(body) {
  if (!body.amount || !body.currency) {
    throw new Error('amount and currency are required');
  }
  if (body.currency !== 'EUR') {
    throw new Error('iDEAL requires EUR currency');
  }
  const payload = {
    source: { type: 'ideal' },
    amount: body.amount,
    currency: body.currency,
    processing_channel_id: CHECKOUT_PROCESSING_CHANNEL,
    reference: body.reference || 'demo-order-ideal',
    description: body.description || 'iDEAL payment for iPhone case',
    payment_type: 'Regular',
    success_url: SUCCESS_URL,
    failure_url: FAILURE_URL,
  };
  logPayload('ideal', payload);
  return createCheckoutPayment(payload);
}

async function handleWalletPayment(body) {
  if (!body.token || !body.amount || !body.currency) {
    throw new Error('token, amount, and currency are required');
  }
  const payload = {
    source: { type: 'token', token: body.token },
    amount: body.amount,
    currency: body.currency,
    processing_channel_id: CHECKOUT_PROCESSING_CHANNEL,
    reference: body.reference || 'demo-order-wallet',
    capture: true,
  };
  logPayload('wallet', payload);
  return createCheckoutPayment(payload);
}

function serveStatic(req, res) {
  const parsed = new URL(req.url, `http://${req.headers.host}`);
  let pathname = parsed.pathname === '/' ? '/index.html' : parsed.pathname;
  const filePath = path.join(__dirname, 'public', pathname);

  if (!filePath.startsWith(path.join(__dirname, 'public'))) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end('Not found');
    }
    const ext = path.extname(filePath);
    const mime = mimeTypes[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && pathname === '/config') {
    return sendJSON(res, 200, {
      publicKey: CHECKOUT_PUBLIC_KEY,
      processingChannel: CHECKOUT_PROCESSING_CHANNEL,
      successUrl: SUCCESS_URL,
      failureUrl: FAILURE_URL,
    });
  }

  if (req.method === 'POST' && pathname === '/api/payments/card') {
    try {
      const body = await parseJSONBody(req);
      const result = await handleCardPayment(body);
      return sendJSON(res, 200, result);
    } catch (err) {
      return sendJSON(res, 400, { error: err.message, details: err.details });
    }
  }

  if (req.method === 'POST' && pathname === '/api/payments/ideal') {
    try {
      const body = await parseJSONBody(req);
      const result = await handleIdealPayment(body);
      return sendJSON(res, 200, result);
    } catch (err) {
      return sendJSON(res, 400, {
        error: err.message,
        details: err.details,
        requestId: err.requestId,
        errorType: err.errorType,
        body: err.body,
      });
    }
  }

  if (req.method === 'POST' && pathname === '/api/payments/wallet') {
    try {
      const body = await parseJSONBody(req);
      const result = await handleWalletPayment(body);
      return sendJSON(res, 200, result);
    } catch (err) {
      return sendJSON(res, 400, { error: err.message, details: err.details });
    }
  }

  return serveStatic(req, res);
});

server.listen(PORT, HOST, () => {
  console.log(`Checkout demo server listening at http://${HOST}:${PORT}`);
});
