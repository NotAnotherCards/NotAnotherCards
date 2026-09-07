import { createServer } from 'node:http';

let responseStatus = 200;
const deliveries = {
  ValidationSlackSuccess: { success: 0, failure: 0 },
  ValidationSlackFailure: { success: 0, failure: 0 },
  other: { success: 0, failure: 0 },
};

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error('request body is too large'));
        request.destroy();
      }
    });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

function sendJson(response, value) {
  response.writeHead(200, { 'content-type': 'application/json' });
  response.end(JSON.stringify(value));
}

createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/health') {
    response.writeHead(200);
    response.end('ok');
    return;
  }

  if (request.method === 'GET' && request.url === '/stats') {
    sendJson(response, { responseStatus, deliveries });
    return;
  }

  if (request.method === 'POST' && request.url === '/mode/success') {
    responseStatus = 200;
    sendJson(response, { responseStatus });
    return;
  }

  if (request.method === 'POST' && request.url === '/mode/fail') {
    responseStatus = 503;
    sendJson(response, { responseStatus });
    return;
  }

  if (request.method === 'POST' && request.url === '/slack') {
    try {
      const body = await readBody(request);
      const alertName = body.includes('ValidationSlackSuccess')
        ? 'ValidationSlackSuccess'
        : body.includes('ValidationSlackFailure')
          ? 'ValidationSlackFailure'
          : 'other';
      const outcome =
        responseStatus >= 200 && responseStatus < 300 ? 'success' : 'failure';
      deliveries[alertName][outcome] += 1;
      response.writeHead(responseStatus, { 'content-type': 'text/plain' });
      response.end(responseStatus === 200 ? 'ok' : 'unavailable');
    } catch (error) {
      response.writeHead(400, { 'content-type': 'text/plain' });
      response.end(error instanceof Error ? error.message : String(error));
    }
    return;
  }

  response.writeHead(404);
  response.end('not found');
}).listen(8080, '0.0.0.0');
