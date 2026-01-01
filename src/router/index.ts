import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { dirname } from 'path';
import { RawData, WebSocket, WebSocketServer } from 'ws';
import {
  CompanionClientMsg,
  CompanionMsg,
  CompanionProblem,
  CphSubmitMsgData,
  CphSubmitResponse,
} from '../modules/companion/types';

function getEnvOrExit(
  key: string,
  validator: (val: number) => boolean,
): number {
  const val = Number(process.env[key]);
  if (!Number.isFinite(val) || !validator(val)) {
    console.error(`Error: ${key} environment variable is not set or invalid.`);
    process.exit(1);
  }
  return val;
}

const HTTP_PORT = getEnvOrExit('CPH_NG_HTTP_PORT', (v) => v > 0 && v <= 65535);
const WS_PORT = getEnvOrExit('CPH_NG_WS_PORT', (v) => v > 0 && v <= 65535);
// Shutdown delay (ms). Default 30s balances quick cleanup with avoiding
// rapid shutdown/start cycles when clients connect intermittently.
const SHUTDOWN_DELAY = getEnvOrExit('CPH_NG_SHUTDOWN_DELAY', (v) => v >= 0);
const BATCH_TIMEOUT = getEnvOrExit('CPH_NG_BATCH_TIMEOUT', (v) => v > 0);
const LOG_FILE = process.env.CPH_NG_LOG_FILE;

// Initialize log directory once at startup
if (LOG_FILE) {
  try {
    const dir = dirname(LOG_FILE);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    if (!existsSync(LOG_FILE)) {
      writeFileSync(LOG_FILE, '');
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(`Failed to initialize log directory: ${e}`);
  }
}

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  if (LOG_FILE) {
    try {
      appendFileSync(LOG_FILE, `${line}\n`);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(
        `[${new Date().toISOString()}] Failed to write to log file ${LOG_FILE}: ${e}`,
      );
    }
  }
  // Always emit to stderr so errors are visible even without log file
  // eslint-disable-next-line no-console
  console.error(line);
}

// State
const clients = new Set<WebSocket>();
let shutdownTimer: NodeJS.Timeout | null = null;
const submissionQueue: CphSubmitMsgData[] = [];
const batches = new Map<string, CompanionProblem[]>();
const batchTimers = new Map<string, NodeJS.Timeout>();

let httpServer: ReturnType<typeof createServer> | null = null;
let wss: WebSocketServer;

// --- Helper Functions ---

function gracefulShutdown(reason: string, error?: any) {
  log(`Shutting down: ${reason}`);
  if (error) {
    const detail = error.stack || error.message || String(error);
    log(`Error details: ${detail}`);
  }

  if (shutdownTimer) {
    clearTimeout(shutdownTimer);
    shutdownTimer = null;
  }

  // Clear all batch timers
  for (const timer of batchTimers.values()) {
    clearTimeout(timer);
  }
  batchTimers.clear();

  // Close all WebSocket connections
  for (const client of clients) {
    try {
      client.terminate();
    } catch (e) {
      log(`Error terminating client: ${e}`);
    }
  }
  clients.clear();

  // Close WebSocket server
  if (wss) {
    wss.close(() => {
      log('WebSocket server closed');
    });
  }

  // Close HTTP server
  if (httpServer) {
    httpServer.close(() => {
      log('HTTP server closed');
      process.exit(error ? 1 : 0);
    });
  } else {
    process.exit(error ? 1 : 0);
  }

  // Force exit if graceful shutdown takes too long
  setTimeout(() => {
    log('Force exiting...');
    process.exit(error ? 1 : 0);
  }, 5000);
}

function resetShutdownTimer() {
  if (shutdownTimer) {
    clearTimeout(shutdownTimer);
    shutdownTimer = null;
  }
  if (clients.size === 0) {
    shutdownTimer = setTimeout(() => {
      gracefulShutdown('No clients connected for timeout period');
    }, SHUTDOWN_DELAY);
  }
}

function broadcast(message: CompanionMsg, exclude?: WebSocket) {
  const data = JSON.stringify(message);
  for (const client of clients) {
    if (client !== exclude && client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

// --- HTTP Server ---

httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
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

          // Set cleanup timer for new batch
          const timer = setTimeout(() => {
            if (batches.has(batchId)) {
              batches.delete(batchId);
              batchTimers.delete(batchId);
              log(`Batch ${batchId} timed out and was removed`);
            }
          }, BATCH_TIMEOUT);
          batchTimers.set(batchId, timer);
        }
        currentBatch.push(data);

        if (currentBatch.length >= batchSize) {
          batches.delete(batchId);
          const timer = batchTimers.get(batchId);
          if (timer) {
            clearTimeout(timer);
            batchTimers.delete(batchId);
          }
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
      // Broadcast consumption even if the original client might have disconnected.
      // The submission itself is processed independently of the client's connection state.
      broadcast({
        type: 'submission-consumed',
        clientId: submission.clientId,
        submissionId: submission.submissionId,
      });
    }
  } else {
    res.writeHead(404, headers);
    res.end();
  }
});

httpServer.listen(HTTP_PORT, () => {
  log(`HTTP Server listening on ${HTTP_PORT}`);

  // --- WebSocket Server ---

  wss = new WebSocketServer({ port: WS_PORT });

  wss.on('connection', (ws: WebSocket) => {
    clients.add(ws);
    resetShutdownTimer();

    ws.on('message', (message: RawData) => {
      try {
        const msg: CompanionClientMsg = JSON.parse(message.toString());

        if (msg.type === 'submit') {
          submissionQueue.push(msg.data);
        } else if (msg.type === 'cancel-submit') {
          const index = submissionQueue.findIndex(
            (s) => s.submissionId === msg.submissionId,
          );
          if (index !== -1) {
            submissionQueue.splice(index, 1);
            log(
              `Submission ${msg.submissionId} cancelled and removed from queue`,
            );
          }
        } else if (msg.type === 'claim-batch') {
          // Broadcast to all clients that this batch is claimed
          broadcast({
            type: 'batch-claimed',
            batchId: msg.batchId,
            claimedBy: msg.clientId, // Optional
          });
        }
      } catch (e) {
        log(`Failed to parse WebSocket message: ${e}`);
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      resetShutdownTimer();
    });
  });

  wss.on('error', (err) => {
    gracefulShutdown('WebSocket Server Error', err);
  });
});

httpServer.on('error', (err) => {
  gracefulShutdown('HTTP Server Error', err);
});

// Initial timer
resetShutdownTimer();

process.on('SIGINT', () => {
  gracefulShutdown('Received SIGINT');
});

process.on('SIGTERM', () => {
  gracefulShutdown('Received SIGTERM');
});

process.on('uncaughtException', (err) => {
  gracefulShutdown('Uncaught Exception', err);
});
