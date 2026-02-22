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

import { appendFileSync } from 'node:fs';
import { config } from '@r/config';
import { broadcast } from '@/router';
import type { LogLevel } from '@/router/types';

export const writeLog = (level: LogLevel, message: string, ...args: unknown[]) => {
  const timeString = new Date().toISOString();
  const levelString = level.toUpperCase();
  const argsString = args
    .map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg)))
    .join(' ');
  const logLine = `[${timeString}] [${levelString}] ${message} ${argsString}`;
  try {
    appendFileSync(config.logFile, `${logLine}\n`);
  } catch {}
  console.log(logLine);

  broadcast({ type: 'log', level, message, details: args });
};

export const trace = (message: string, ...args: unknown[]) => {
  writeLog('trace', message, ...args);
};
export const debug = (message: string, ...args: unknown[]) => {
  writeLog('debug', message, ...args);
};
export const info = (message: string, ...args: unknown[]) => {
  writeLog('info', message, ...args);
};
export const warn = (message: string, ...args: unknown[]) => {
  writeLog('warn', message, ...args);
};
export const error = (message: string, ...args: unknown[]) => {
  writeLog('error', message, ...args);
};
