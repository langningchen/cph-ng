import { appendFileSync } from 'fs';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import {
  CompanionProblem,
  CphSubmitResponse,
} from '../modules/companion/types';

const HTTP_PORT = 27121;
const WS_PORT = 27122;
const SHUTDOWN_DELAY = 30000;
const LOG_FILE = process.env.CPH_LOG_FILE;

function log(msg: string) {
  if (LOG_FILE) {
    try {
      appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${msg}\n`);
    } catch (e) {}
  }
}

// State
const clients = new Set<WebSocket>();
let shutdownTimer: NodeJS.Timeout | null = null;
const submissionQueue: any[] = [];
const batches = new Map<string, CompanionProblem[]>();

// Logger (simple file append or console, since stdio is ignored in detached, we might want to write to a file if needed, but for now console is fine as it goes to /dev/null or similar)
// Actually, for debugging, let's just keep it simple.

// --- Helper Functions ---

function resetShutdownTimer() {
  if (shutdownTimer) {
    clearTimeout(shutdownTimer);
    shutdownTimer = null;
  }
  if (clients.size === 0) {
    shutdownTimer = setTimeout(() => {
      process.exit(0);
    }, SHUTDOWN_DELAY);
  }
}

function broadcast(message: any, exclude?: WebSocket) {
  const data = JSON.stringify(message);
  for (const client of clients) {
    if (client !== exclude && client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

// --- HTTP Server ---

const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') {
    res.writeHead(204, headers);
    res.end();
    return;
  }

  if (req.url === '/' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        const data: CompanionProblem = JSON.parse(body);
        const batchId = data.batch.id;
        const batchSize = data.batch.size;

        let currentBatch = batches.get(batchId);
        if (!currentBatch) {
          currentBatch = [];
          batches.set(batchId, currentBatch);
        }
        currentBatch.push(data);

        if (currentBatch.length >= batchSize) {
          batches.delete(batchId);
          broadcast({
            type: 'batch-available',
            batchId,
            problems: currentBatch,
          });
        }

        res.writeHead(200, headers);
        res.end();
      } catch (e) {
        res.writeHead(400, headers);
        res.end('Invalid JSON');
      }
    });
  } else if (req.url === '/getSubmit' && req.method === 'GET') {
    const submission = submissionQueue.shift();
    const response: CphSubmitResponse = submission || { empty: true };
    res.writeHead(200, { ...headers, 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));

    if (submission && submission.clientId) {
      log(`Submission consumed for client ${submission.clientId}`);
      broadcast({
        type: 'submission-consumed',
        clientId: submission.clientId,
      });
    }
  } else {
    res.writeHead(404, headers);
    res.end();
  }
});

httpServer.listen(HTTP_PORT, () => {
  // console.log(`HTTP Server listening on ${HTTP_PORT}`);
});

httpServer.on('error', (err) => {
  // If port is in use, we should probably exit, as another router might be running.
  // But since we check for WS connection before spawning, this shouldn't happen often.
  process.exit(1);
});

// --- WebSocket Server ---

const wss = new WebSocketServer({ port: WS_PORT });

wss.on('connection', (ws: WebSocket) => {
  clients.add(ws);
  resetShutdownTimer();

  ws.on('message', (message: string) => {
    try {
      const msg = JSON.parse(message.toString());

      if (msg.type === 'submit') {
        submissionQueue.push(msg.data);
      } else if (msg.type === 'claim-batch') {
        // Broadcast to others that this batch is claimed
        broadcast(
          {
            type: 'batch-claimed',
            batchId: msg.batchId,
            claimedBy: msg.clientId, // Optional
          },
          ws,
        ); // Exclude the sender
      }
    } catch (e) {
      // Ignore invalid messages
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    resetShutdownTimer();
  });
});

wss.on('error', (err) => {
  process.exit(1);
});

// Initial timer
resetShutdownTimer();
