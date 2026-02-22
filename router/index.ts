// Copyright (C) 2026 Langning Chen
//
// This file is part of cph-ng.
//
// cph-ng is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// cph-ng is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with cph-ng.  If not, see <https://www.gnu.org/licenses/>.

import { serve } from '@hono/node-server';
import { createNodeWebSocket } from '@hono/node-ws';
import { debug, error, info, trace, warn } from '@r/logger';
import type { CompanionClientMsg, CompanionMsg, CompanionProblem, SubmitMsg } from '@r/types';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { WSContext } from 'hono/ws';
import type { BatchId } from '@/domain/types';
import { config, updateConfig } from './config';

export const clients = new Set<WSContext>();
export const batches = new Map<
  BatchId,
  { ignored: boolean; problems: CompanionProblem[]; size: number }
>();
export const submissionQueue: SubmitMsg[] = [];

export const broadcast = (data: CompanionMsg) => {
  const message = JSON.stringify(data);
  clients.forEach((client) => {
    try {
      if (client.readyState === 1) client.send(message);
      else clients.delete(client);
    } catch (e) {
      warn('Failed to send message to a client', e);
      clients.delete(client);
    }
  });
};

let isRestarting = false;
let currentRunningPort = config.port;
const restartServer = async () => {
  if (isRestarting) return;
  isRestarting = true;
  try {
    while (config.port !== undefined && currentRunningPort !== config.port) {
      const targetPort = config.port;
      debug(`Port mismatch detected. Restarting: ${currentRunningPort} -> ${targetPort}`);
      clients.forEach((ws) => {
        ws.close(1001, 'Server restarting');
      });
      clients.clear();
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
      server = startServer();
      currentRunningPort = targetPort;
      info(`Server successfully moved to port ${currentRunningPort}`);
    }
  } catch (err) {
    error('Error during server restart', err);
  } finally {
    isRestarting = false;
  }
};

const app = new Hono();
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

app.use(logger(trace));
app.use('/*', cors());

app.get(
  '/ws',
  upgradeWebSocket(() => ({
    onOpen(_event, ws) {
      clients.add(ws);
      resetShutdownTimer();
      info('WebSocket opened', { clientCount: clients.size });
    },
    onMessage(event, _ws) {
      const msg = JSON.parse(event.data.toString()) as CompanionClientMsg;
      if (msg.type === 'submit') {
        const { submissionId } = msg;
        submissionQueue.push(msg);
        info('New submission added to queue', { submissionId });
      } else if (msg.type === 'cancelSubmit') {
        const { submissionId } = msg;
        const idx = submissionQueue.findIndex((s) => s.submissionId === submissionId);
        if (idx !== -1) {
          submissionQueue.splice(idx, 1);
          info('Submission cancelled', { submissionId });
        } else warn('Submission to cancel not found in queue', { submissionId });
      } else if (msg.type === 'cancelBatch') {
        const { batchId } = msg;
        const batch = batches.get(batchId);
        if (batch) {
          batch.ignored = true;
          broadcast({
            type: 'readingBatch',
            batchId,
            count: batch.size + 1, // Force clients to ignore this batch
            size: batch.size,
          });
          info(`Batch ${batchId} marked as ignored due to cancellation`, {
            pendingProblems: batch.problems.length,
          });
        } else warn(`Batch ${batchId} not found for cancellation`, { batchId });
      } else if (msg.type === 'claimBatch') {
        const { batchId } = msg;
        broadcast({ type: 'batchClaimed', batchId });
      } else if (msg.type === 'updateConfig') {
        const { config } = msg;
        updateConfig(config);
        if (config.port !== undefined) restartServer();
        info('Config updated dynamically', config);
      }
    },
    onClose(event, ws) {
      clients.delete(ws);
      resetShutdownTimer();
      info('WebSocket closed', { code: event.code, clientCount: clients.size });
    },
    onError(event, _ws) {
      warn('WebSocket error occurred', { event });
    },
  })),
);

app.get('/', (ctx) => {
  return ctx.text('CPH Router is running');
});

app.post('/', async (ctx) => {
  const body: CompanionProblem = await ctx.req.json();
  const { id, size } = body.batch;

  const { ignored, problems } = batches.get(id) || { ignored: false, problems: [], size };
  if (problems.length === 0) batches.set(id, { ignored, problems, size });
  problems.push(body);

  if (size !== 1 && !ignored)
    broadcast({
      type: 'readingBatch',
      batchId: id,
      count: problems.length,
      size,
    });

  if (problems.length >= size) {
    if (ignored) warn(`Batch ${id} ignored due to previous cancellation`, { size });
    else {
      broadcast({
        type: 'batchAvailable',
        batchId: id,
        problems: [...problems],
        autoImport: clients.size === 1,
      });
      info(`Batch ${id} dispatched`, { size });
    }
    batches.delete(id);
  }
  return ctx.json({ status: 'ok' });
});

app.get('/getSubmit', (ctx) => {
  const submission = submissionQueue.shift();
  if (!submission) return ctx.json({ empty: true });
  broadcast({
    type: 'submissionConsumed',
    submissionId: submission.submissionId,
  });
  info('Submission consumed', { submission });
  return ctx.json(submission);
});

const startServer = () => {
  const server = serve({ fetch: app.fetch, port: config.port });
  injectWebSocket(server);
  return server;
};
const stopServer = () => {
  server.close(() => {
    info(`Server stopped`);
    process.exit(0);
  });
};

export let server = startServer();

info(`Router started on port ${config.port}`, { config });

let shutdownTimer: NodeJS.Timeout | null = null;
const resetShutdownTimer = () => {
  if (isRestarting) return;
  if (shutdownTimer) clearTimeout(shutdownTimer);
  if (clients.size > 0) return;
  if (!config.shutdownTimeout) return;
  shutdownTimer = setTimeout(() => {
    info(`No clients connected for ${config.shutdownTimeout}ms, shutting down router`);
    stopServer();
  }, config.shutdownTimeout);
};
