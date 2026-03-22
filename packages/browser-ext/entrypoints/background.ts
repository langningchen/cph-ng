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

import { type ConnectionPhase, onMessage, type StatusResponse, sendMessage } from '@b/messaging';
import { findSubmitter } from '@b/submitters';
import type { B2rMsg, R2bMsg, SubmitData } from '@cph-ng/core';
import { io, type Socket } from 'socket.io-client';
import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { storage } from 'wxt/utils/storage';

const routerPort = storage.defineItem<number>('local:routerPort', {
  fallback: 27121,
});
interface ConnectionState {
  socket: Socket<R2bMsg, B2rMsg> | null;
  desiredPort: number;
  socketPort: number | null;
  socketGeneration: number;
  connected: boolean;
  isActive: boolean;
  phase: ConnectionPhase;
  lastError: string | null;
}

const CONNECTION_TIMEOUT_MS = 1000;

const setupCaptchaRuntime = async (): Promise<void> => {
  // Firefox do not support offscreen documents
  if (import.meta.env.FIREFOX) return;

  const contexts = await browser.runtime.getContexts({
    contextTypes: [browser.runtime.ContextType.OFFSCREEN_DOCUMENT],
  });
  if (contexts.length !== 0)
    return console.log('[cph-ng-submit] Offscreen document already exists, skipping creation');
  await browser.offscreen.createDocument({
    url: browser.runtime.getURL('/offscreen.html'),
    reasons: [browser.offscreen.Reason.WORKERS],
    justification: 'Keep Luogu captcha model loaded for low-latency ONNX inference.',
  });
};

export default defineBackground(() => {
  void setupCaptchaRuntime();

  routerPort.getValue().then((port) => {
    const state: ConnectionState = {
      socket: null,
      desiredPort: port,
      socketPort: null,
      socketGeneration: 0,
      connected: false,
      isActive: false,
      phase: 'DISCONNECTED',
      lastError: null,
    };

    const getStatus = (): StatusResponse => ({
      connected: state.connected,
      isActive: state.isActive,
      port: state.desiredPort,
      phase: state.phase,
      lastError: state.lastError || undefined,
    });

    const getBadgeColor = () => {
      if (state.phase === 'CONNECTED') return state.isActive ? '#4CAF50' : '#9E9E9E';
      if (state.phase === 'CONNECTING') return '#2196F3';
      if (state.phase === 'RECONNECTING') return '#FF9800';
      return '#F44336';
    };

    const broadcastStatus = () => {
      sendMessage('statusUpdate', getStatus());

      if (import.meta.env.FIREFOX) return;
      browser.action.setBadgeText({ text: '　' });
      browser.action.setBadgeBackgroundColor({ color: getBadgeColor() });
    };

    const closeSocket = () => {
      if (!state.socket) return;
      state.socket.removeAllListeners();
      state.socket.io.removeAllListeners();
      state.socket.close();
      state.socket = null;
      state.socketPort = null;
      state.connected = false;
      state.isActive = false;
    };

    const connect = (phase: ConnectionPhase) => {
      const targetPort = state.desiredPort;
      if (state.socket && state.connected && state.socketPort === targetPort) return;

      closeSocket();
      state.phase = phase;
      state.lastError = null;
      broadcastStatus();

      const generation = state.socketGeneration + 1;
      state.socketGeneration = generation;
      const socket = io(`ws://localhost:${targetPort}`, {
        path: '/ws',
        query: { type: 'browser' },
        transports: ['websocket'],
        timeout: CONNECTION_TIMEOUT_MS,
        reconnectionDelay: 3000,
        reconnectionDelayMax: 5000,
        autoConnect: true,
        forceNew: true,
      });
      state.socket = socket;
      state.socketPort = targetPort;

      socket.on('connect', () => {
        if (generation !== state.socketGeneration) return;
        state.connected = true;
        state.phase = 'CONNECTED';
        state.lastError = null;
        console.log('[cph-ng-submit] Connected to router');
        broadcastStatus();
      });
      socket.on('disconnect', (reason) => {
        if (generation !== state.socketGeneration) return;
        state.connected = false;
        state.isActive = false;
        state.phase = reason === 'io client disconnect' ? 'DISCONNECTED' : 'RECONNECTING';
        if (reason && reason !== 'io client disconnect')
          state.lastError = `Disconnected: ${reason}`;
        console.log('[cph-ng-submit] Disconnected from router:', reason);
        broadcastStatus();
      });
      socket.on('connect_error', (err) => {
        if (generation !== state.socketGeneration) return;
        state.connected = false;
        state.isActive = false;
        state.phase = socket.active ? 'RECONNECTING' : 'DISCONNECTED';
        state.lastError = err.message || 'Connection failed';
        console.warn('[cph-ng-submit] Failed to connect to router:', err.message);
        broadcastStatus();
      });
      socket.io.on('reconnect_attempt', () => {
        if (generation !== state.socketGeneration) return;
        state.connected = false;
        state.isActive = false;
        state.phase = 'RECONNECTING';
        broadcastStatus();
      });
      socket.io.on('reconnect_error', (err) => {
        if (generation !== state.socketGeneration) return;
        state.connected = false;
        state.isActive = false;
        state.phase = 'RECONNECTING';
        state.lastError = err instanceof Error ? err.message : String(err);
        broadcastStatus();
      });
      socket.io.on('reconnect_failed', () => {
        if (generation !== state.socketGeneration) return;
        state.connected = false;
        state.isActive = false;
        state.phase = 'DISCONNECTED';
        state.lastError = 'Reconnection failed';
        broadcastStatus();
      });
      socket.on('status', ({ isActive }) => {
        if (generation !== state.socketGeneration) return;
        state.isActive = isActive;
        console.log('[cph-ng-submit] Active status changed:', isActive);
        broadcastStatus();
      });
      socket.on('submitRequest', (request) => {
        if (generation !== state.socketGeneration) return;
        console.log('[cph-ng-submit] Received submit request:', request);
        handleSubmitRequest(request);
      });
    };

    const pendingSubmissions = new Map<number, SubmitData>();

    const handleSubmitRequest = (request: SubmitData) => {
      const submitter = findSubmitter(new URL(request.url));
      if (!submitter) {
        showError(`No submitter found for URL: ${request.url}`);
        return;
      }

      try {
        browser.tabs.create({ url: submitter.getSubmitUrl(request) }, (tab) => {
          if (browser.runtime.lastError || tab.id === undefined) {
            showError('Failed to open tab');
            return;
          }
          pendingSubmissions.set(tab.id, request);
        });
      } catch (e) {
        showError(e?.toString() || String(e));
      }
    };

    onMessage('getStatus', () => getStatus());

    onMessage('setActive', () => {
      state.socket?.emit('setActive');
    });

    onMessage('connect', () => {
      connect('CONNECTING');
    });

    onMessage('disconnect', () => {
      closeSocket();
      state.phase = 'DISCONNECTED';
      state.lastError = null;
      broadcastStatus();
    });

    onMessage('setPort', ({ data }) => {
      const port = Math.trunc(data.port);
      if (port <= 0 || port >= 65536) return;

      const isChanged = port !== state.desiredPort;
      state.desiredPort = port;
      void routerPort.setValue(port);
      if (isChanged || !state.connected || state.socketPort !== port) connect('CONNECTING');
      else broadcastStatus();
    });

    onMessage('pageReady', ({ sender }): SubmitData | null => {
      if (sender.tab?.id !== undefined) {
        const pending = pendingSubmissions.get(sender.tab.id);
        return pending ? pending : null;
      }
      return null;
    });

    onMessage('submitDone', ({ data, sender }) => {
      if (!data.success) showError(data.message);
      if (sender.tab?.id !== undefined) pendingSubmissions.delete(sender.tab.id);
    });

    const showError = (message: string) => {
      browser.notifications.create({
        type: 'basic',
        iconUrl: '/icons/128.png',
        title: 'CPH-NG Submit Error',
        message,
        priority: 2,
      });
    };
    connect('CONNECTING');
  });
});
