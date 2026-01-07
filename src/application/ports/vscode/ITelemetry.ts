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

export class TelemetryTrustedValue<T = string> {
  constructor(public readonly value: T) {}
}

export type TelemetryEventProp<T> = T | TelemetryTrustedValue<T>;

export interface TelemetryEventProps {
  readonly [key: string]: TelemetryEventProp<string | number | boolean>;
}

export const TELEMETRY_EVENT_NAMES = ['run'] as const;
export type TelemetryEventName = (typeof TELEMETRY_EVENT_NAMES)[number];
export const TELEMETRY_ERROR_NAMES = ['pipeFailed', 'wrapperError', 'parseRunnerError'] as const;
export type TelemetryErrorName = (typeof TELEMETRY_ERROR_NAMES)[number];
export type TelemetryName = TelemetryEventName | TelemetryErrorName;

export interface ITelemetry {
  event(name: TelemetryEventName, props?: TelemetryEventProps): void;
  error(name: TelemetryErrorName, error: unknown, props?: TelemetryEventProps): void;
  start(
    name: TelemetryEventName,
    props?: TelemetryEventProps,
  ): (endProps?: TelemetryEventProps) => void;
}
