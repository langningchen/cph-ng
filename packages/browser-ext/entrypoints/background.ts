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

import type { B2rMsg, CphSubmitData, R2bMsg } from '@cph-ng/core';
import { io, type Socket } from 'socket.io-client';
import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { storage } from 'wxt/utils/storage';
import { onMessage, type PageReadyResponse, sendMessage } from '../src/messaging';
import { findSubmitter } from '../src/submitters';

const routerPort = storage.defineItem<number>('local:routerPort', {
  fallback: 27121,
});

export default defineBackground(async () => {
  interface ConnectionState {
    socket: Socket<R2bMsg, B2rMsg> | null;
    port: number;
    connected: boolean;
    isActive: boolean;
  }

  const state: ConnectionState = {
    socket: null,
    port: await routerPort.getValue(),
    connected: false,
    isActive: false,
  };

  const broadcastStatus = () => {
    sendMessage('statusUpdate', {
      connected: state.connected,
      isActive: state.isActive,
      port: state.port,
    });

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
      console.log('[cph-ng-submit] Received submit request:', request.submissionId);
      handleSubmitRequest(request);
    });
  };

  const pendingSubmissions = new Map<number, { submissionId: string; data: CphSubmitData }>();

  const handleSubmitRequest = (request: { submissionId: string; data: CphSubmitData }) => {
    const submitter = findSubmitter(request.data.url);
    if (!submitter) {
      showError(`No submitter found for URL: ${request.data.url}`);
      return;
    }

    try {
      const submitUrl = submitter.getSubmitUrl(request.data);
      browser.tabs.create({ url: submitUrl }, (tab) => {
        if (browser.runtime.lastError || tab.id === undefined) {
          showError('Failed to open tab');
          return;
        }
        pendingSubmissions.set(tab.id, request);
      });
    } catch (e) {
      showError(String(e));
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

  onMessage('pageReady', ({ sender }): PageReadyResponse | null => {
    if (sender.tab?.id !== undefined) {
      const pending = pendingSubmissions.get(sender.tab.id);
      return pending ? { submissionId: pending.submissionId, data: pending.data } : null;
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
