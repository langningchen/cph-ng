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

import type { SubmitData } from '@cph-ng/core';
import { defineExtensionMessaging } from '@webext-core/messaging';

export interface StatusResponse {
  connected: boolean;
  isActive: boolean;
  port: number;
}

export interface SubmitDoneData {
  success: boolean;
  message: string;
}

export interface StatusUpdateData {
  connected: boolean;
  isActive: boolean;
  port: number;
}

export interface SubmitResultData {
  submissionId: string;
  success: boolean;
  message: string;
}

interface ProtocolMap {
  getStatus(): StatusResponse;
  connect(): void;
  disconnect(): void;
  setPort(data: { port: number }): void;
  setActive(): void;
  pageReady(): SubmitData | null;
  submitDone(data: SubmitDoneData): void;
  statusUpdate(data: StatusUpdateData): void;
  submitResult(data: SubmitResultData): void;
  solveLuoguCaptcha(data: string): string;
}

export const { sendMessage, onMessage } = defineExtensionMessaging<ProtocolMap>();
