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

import { BrowserGateway } from '@b/gateway';
import { onMessage, sendMessage } from '@b/messaging';
import { findSubmitter } from '@b/submitters';
import type { SubmitData } from '@cph-ng/core';
import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { storage } from 'wxt/utils/storage';

const routerPort = storage.defineItem<number>('local:routerPort', {
  fallback: 27121,
});
const pairingToken = storage.defineItem<string>('local:pairingToken', { fallback: '' });
interface ConnectionState {
  socket: BrowserGateway | null;
  port: number;
  token: string;
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

  Promise.all([routerPort.getValue(), pairingToken.getValue()]).then(([port, token]) => {
    const state: ConnectionState = {
      socket: null,
      port,
      token,
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
      state.socket?.close();
      state.connected = false;
      state.isActive = false;
      broadcastStatus();
      const socket = new BrowserGateway(state.port, state.token);
      state.socket = socket;
      socket.onStatus = (connected) => {
        if (state.socket !== socket) return;
        state.connected = connected;
        if (!connected) state.isActive = false;
        broadcastStatus();
      };
      socket.onNotification = (method, data) => {
        if (state.socket !== socket) return;
        if (method === 'event.router.status') {
          state.isActive = data.isActive === true;
          broadcastStatus();
        } else if (
          method === 'event.router.submit_request' &&
          typeof data.url === 'string' &&
          typeof data.sourceCode === 'string'
        )
          handleSubmitRequest({ url: data.url, sourceCode: data.sourceCode });
      };
      socket.connect();
    };

    const pendingSubmissions = new Map<number, SubmitData>();

    const handleSubmitRequest = (request: SubmitData) => {
      let url: URL;
      try {
        url = new URL(request.url);
      } catch {
        showError('Invalid submission URL');
        return;
      }
      const submitter = findSubmitter(url);
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
      state.socket?.send('router.set_active');
    });

    onMessage('connect', () => {
      connect();
    });

    onMessage('disconnect', () => {
      state.socket?.close();
      state.connected = false;
      state.isActive = false;
      broadcastStatus();
      state.socket = null;
    });

    onMessage('setPairingToken', async ({ data }) => {
      state.token = data.token.trim();
      await pairingToken.setValue(state.token);
      connect();
    });

    onMessage('setPort', ({ data }) => {
      if (!Number.isInteger(data.port) || data.port < 1 || data.port > 65535) return;
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
