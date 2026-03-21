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

import type {
  B2rMsg,
  BatchId,
  C2rMsg,
  CompanionProblem,
  LogLevel,
  R2bMsg,
  R2cMsg,
} from '@cph-ng/core';
import { serve } from '@hono/node-server';
import { debug, error, info, trace, warn } from '@r/logger';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { Server } from 'socket.io';
import { config, updateConfig } from './config';
import { shouldScheduleShutdown } from './shutdown';

let io: Server<C2rMsg & B2rMsg, R2cMsg & R2bMsg>;
export const batches = new Map<
  BatchId,
  { ignored: boolean; problems: CompanionProblem[]; size: number }
>();

let isRestarting = false;
let currentRunningPort = config.port;
const restartServer = async () => {
  if (isRestarting) return;
  isRestarting = true;
  try {
    while (config.port !== undefined && currentRunningPort !== config.port) {
      const targetPort = config.port;
      debug(`Port mismatch detected. Restarting: ${currentRunningPort} -> ${targetPort}`);
      io.close();
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

const refreshAllStatus = () => {
  const isAnyBrowserConnected = !!activeBrowserId;

  io.to('vscode-clients').emit('browserStatus', {
    connected: isAnyBrowserConnected,
  });

  const browserRoom = io.sockets.adapter.rooms.get('browsers');
  for (const socketId of browserRoom || [])
    io.sockets.sockets.get(socketId)?.emit('status', { isActive: socketId === activeBrowserId });

  trace('Status refreshed', {
    activeBrowserId,
    isAnyBrowserConnected,
    browserCount: browserRoom?.size || 0,
  });
};

export const broadcastLog = (level: LogLevel, message: string, details: unknown) => {
  io.to('vscode-clients').emit('log', { message, level, details });
};

const app = new Hono();

app.use(logger(trace));
app.use('/*', cors());

app.get('/', (ctx) => {
  const browserRoom = io.sockets.adapter.rooms.get('browsers') || new Set();
  const vscodeRoom = io.sockets.adapter.rooms.get('vscode-clients') || new Set();
  const html = `
    <html>
      <head>
        <title>CPH-NG Router Status</title>
        <style>
          pre {
            display: inline-block;
          }
        </style>
      </head>

      <body>
        <h1>CPH-NG Router Status</h1>
        <p>If you are seeing this, it means that the CPH-NG router has successfully started.</p>
        <p>You can install the browser extension to automatically submit the problem. For more details, please refer to our documents.</p>
        <p><b>Happy coding! :)</b></p>
        <hr>
        <h2>Debugging Information</h2>
        <h3>Connect Browsers</h3>
        <p>Count: ${browserRoom.size} browser(s)</p>
        <ul>
          ${[...browserRoom.values()]
            .map(
              (browserId) => `
          <li>
            <pre>${browserId}</pre>${browserId === activeBrowserId ? ' (active)' : ''}
          </li>`,
            )
            .join('')}
        </ul>
        <h3>Connected VSCode Clients</h3>
        <p>Count: ${vscodeRoom.size} client(s)</p>
        <ul>
          ${[...vscodeRoom.values()]
            .map(
              (clientId) => `
          <li>
            <pre>${clientId}</pre>
          </li>`,
            )
            .join('')}
        </ul>
        <h3>Pending Batches</h3>
        <p>Count: ${batches.size} batch(es)</p>
        <ul>
          ${[...batches.entries()]
            .map(
              ([batchId, batch]) => `
            <li>
              <pre>${batchId}</pre> ${batch.problems.length}/${batch.size} problems${batch.ignored ? ' (ignored)' : ''}
            </li>
          `,
            )
            .join('')}
        </ul>
      </body>
    </html>
  `;
  return ctx.html(html);
});
app.post('/', async (ctx) => {
  const body: CompanionProblem = await ctx.req.json();
  const { id, size } = body.batch;

  const batch = batches.get(id) || { ignored: false, problems: [], size };
  if (batch.problems.length === 0) batches.set(id, batch);
  batch.problems.push(body);

  if (size !== 1 && !batch.ignored) {
    io.to('vscode-clients').emit('readingBatch', {
      batchId: id,
      count: batch.problems.length,
      size,
    });
  }

  if (batch.problems.length >= size) {
    if (!batch.ignored) {
      io.to('vscode-clients').emit('batchAvailable', {
        batchId: id,
        problems: [...batch.problems],
        autoImport: io.sockets.adapter.rooms.get('vscode-clients')?.size === 1,
      });
      info(`Batch ${id} dispatched`, { size });
    }
    batches.delete(id);
  }
  return ctx.json({ status: 'ok' });
});

let activeBrowserId: string | null = null;

const startServer = () => {
  const server = serve({ fetch: app.fetch, port: config.port });

  io = new Server(server, {
    path: '/ws',
    cors: { origin: '*' },
  });

  io.on('connection', (socket) => {
    resetShutdownTimer();
    const type = socket.handshake.query.type;

    if (type === 'vscode') {
      socket.join('vscode-clients');
      info('VSCode connected', { id: socket.id });

      socket.emit('browserStatus', { connected: !!activeBrowserId });
      socket.on('submit', (msg) => {
        if (activeBrowserId) {
          io.to(activeBrowserId).emit('submitRequest', msg);
          info('Submission forwarded to browser extension', { msg });
        } else error('No browser connected');
      });
      socket.on('cancelBatch', ({ batchId }) => {
        const batch = batches.get(batchId);
        if (batch) {
          batch.ignored = true;
          io.to('vscode-clients').emit('readingBatch', {
            batchId,
            count: batch.size + 1, // Force clients to ignore this batch
            size: batch.size,
          });
          info(`Batch ${batchId} marked as ignored due to cancellation`, {
            pendingProblems: batch.problems.length,
          });
        } else warn(`Batch ${batchId} not found for cancellation`, { batchId });
      });
      socket.on('claimBatch', ({ batchId }) => {
        io.to('vscode-clients').emit('batchClaimed', { batchId });
      });
      socket.on('updateConfig', ({ config }) => {
        updateConfig(config);
        if (config.port !== undefined) restartServer();
        info('Config updated dynamically', config);
      });
    } else if (type === 'browser') {
      socket.join('browsers');
      info('Browser connected', { id: socket.id });
      if (!activeBrowserId) activeBrowserId = socket.id;
      refreshAllStatus();
      socket.on('setActive', () => {
        activeBrowserId = socket.id;
        refreshAllStatus();
      });
    }
    socket.on('disconnect', () => {
      if (socket.id === activeBrowserId) {
        const nextSocket = io.sockets.adapter.rooms.get('browsers')?.values().next().value;
        activeBrowserId = nextSocket || null;
      }
      refreshAllStatus();
      resetShutdownTimer();
    });
  });

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
  const totalClients = io.engine.clientsCount;
  if (!shouldScheduleShutdown(totalClients, config.shutdownTimeout)) return;
  shutdownTimer = setTimeout(() => {
    info(`No clients connected for ${config.shutdownTimeout}ms, shutting down router`);
    stopServer();
  }, config.shutdownTimeout);
};
