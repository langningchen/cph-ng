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

import type { TelemetryEventMeasurements, TelemetryReporter } from '@vscode/extension-telemetry';
import { inject, injectable } from 'tsyringe';
import { TelemetryTrustedValue as vsTelemetryTrustedValue } from 'vscode';
import type { IClock } from '@/application/ports/node/IClock';
import {
  type ITelemetry,
  TELEMETRY_ERROR_NAMES,
  type TelemetryErrorName,
  type TelemetryEventName,
  type TelemetryEventProps,
  type TelemetryName,
  TelemetryTrustedValue,
} from '@/application/ports/vscode/ITelemetry';
import { TOKENS } from '@/composition/tokens';

@injectable()
export class TelemetryAdapter implements ITelemetry {
  constructor(
    @inject(TOKENS.TelemetryReporter)
    private readonly reporter: TelemetryReporter,
    @inject(TOKENS.Clock) private readonly clock: IClock,
  ) {}

  private isErrorName(name: TelemetryName): name is TelemetryErrorName {
    return (TELEMETRY_ERROR_NAMES as readonly string[]).includes(name);
  }

  private send(
    name: TelemetryName,
    props: TelemetryEventProps,
    measurements?: TelemetryEventMeasurements,
  ): void {
    const eventProps: {
      [key: string]: string | vsTelemetryTrustedValue<string>;
    } = {};
    for (const prop in props) {
      const value = props[prop];
      eventProps[prop] =
        value instanceof TelemetryTrustedValue
          ? new vsTelemetryTrustedValue(String(value.value))
          : String(value);
    }
    (this.isErrorName(name)
      ? this.reporter.sendTelemetryErrorEvent
      : this.reporter.sendTelemetryEvent)(name, eventProps, measurements);
  }

  public event(name: TelemetryEventName, props?: Record<string, string | number | boolean>): void {
    const stringProps: Record<string, string> = {};
    if (props) {
      for (const [key, value] of Object.entries(props)) {
        stringProps[key] = String(value);
      }
    }
    this.reporter.sendTelemetryEvent(name, stringProps);
  }

  public error(name: TelemetryErrorName, e: unknown, props?: TelemetryEventProps): void {
    const error = e instanceof Error ? e : new Error(String(e));
    this.send(name, {
      name: error.name,
      message: error.message,
      stack: error.stack ? new TelemetryTrustedValue(error.stack) : '',
      cause: String(error.cause),
      ...props,
    });
  }

  public start(name: TelemetryEventName, props?: TelemetryEventProps): () => void {
    const startTime = this.clock.now();
    return (endProps?: TelemetryEventProps) => {
      const duration = this.clock.now() - startTime;
      this.send(name, { ...props, ...endProps }, { duration });
    };
  }

  public async dispose(): Promise<void> {
    await this.reporter.dispose();
  }
}
