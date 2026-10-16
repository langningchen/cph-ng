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

import { onMessage, sendMessage } from '@b/messaging';
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
  port: number;
  connected: boolean;
  isActive: boolean;
}

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
      port,
      connected: false,
      isActive: false,
    };

    const broadcastStatus = () => {
      sendMessage('statusUpdate', {
        connected: state.connected,
        isActive: state.isActive,
        port: state.port,
      });

      if (import.meta.env.FIREFOX) return;
      let badgeColor = '#F44336';
      if (state.connected) badgeColor = state.isActive ? '#4CAF50' : '#9E9E9E';
      browser.action.setBadgeText({ text: '　' });
      browser.action.setBadgeBackgroundColor({ color: badgeColor });
    };

    const connect = () => {
      if (state.socket?.connected) return;
      if (state.socket) state.socket.close();

      state.socket = io(`ws://localhost:${state.port}`, {
        path: '/ws',
        query: { type: 'browser' },
        transports: ['websocket'],
        reconnectionDelay: 3000,
        autoConnect: true,
      });
      broadcastStatus();

      state.socket.on('connect', () => {
        state.connected = true;
        console.log('[cph-ng-submit] Connected to router');
        broadcastStatus();
      });
      state.socket.on('disconnect', () => {
        state.connected = false;
        state.isActive = false;
        console.log('[cph-ng-submit] Disconnected from router');
        broadcastStatus();
      });
      state.socket.on('status', ({ isActive }) => {
        state.isActive = isActive;
        console.log('[cph-ng-submit] Active status changed:', isActive);
        broadcastStatus();
      });
      state.socket.on('submitRequest', (request) => {
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

    onMessage('getStatus', () => ({
      connected: state.connected,
      port: state.port,
      isActive: state.isActive,
    }));

    onMessage('setActive', () => {
      state.socket?.emit('setActive');
    });

    onMessage('connect', () => {
      connect();
    });

    onMessage('disconnect', () => {
      state.socket?.disconnect();
      state.socket = null;
    });

    onMessage('setPort', ({ data }) => {
      state.port = data.port;
      routerPort.setValue(data.port);
      connect();
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
    connect();
  });
});
