// Copyright (C) 2025 Langning Chen
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

import { extensionPath } from '@/utils/global';
import {
  TelemetryEventMeasurements,
  TelemetryEventProperties,
  TelemetryReporter,
} from '@vscode/extension-telemetry';
import { readFile } from 'fs/promises';
import { join } from 'path';
import Logger from './logger';

export default class Telemetry {
  private logger = new Logger('telemetry');
  private reporter!: TelemetryReporter;
  public async init() {
    this.reporter = new TelemetryReporter(
      'InstrumentationKey=ee659d58-b2b5-48b3-b05b-48865365c0d1;IngestionEndpoint=https://eastus-8.in.applicationinsights.azure.com/;LiveEndpoint=https://eastus.livediagnostics.monitor.azure.com/;ApplicationId=6ff8b3ee-dc15-4a9b-bab8-ffaa956f1773',
      [],
      {
        additionalCommonProperties: {
          commitHash: JSON.parse(
            await readFile(
              join(extensionPath, 'dist', 'generated.json'),
              'utf8',
            ),
          ).commitHash,
        },
      },
      async (url, init) => {
        this.logger.debug(`Telemetry sent to ${url} with body: ${init?.body}`);
        const res = await fetch(url, init);
        res.ok || this.logger.warn(`Telemetry request failed: ${res.status}`);
        return {
          text: () => res.text(),
          status: res.status,
          headers: res.headers as unknown as Iterable<[string, string]>,
        };
      },
    );
  }
  public log(
    eventName: string,
    properties?: TelemetryEventProperties,
    measurements?: TelemetryEventMeasurements,
  ) {
    this.reporter.sendTelemetryEvent(eventName, properties, measurements);
  }
  public error(
    eventName: string,
    properties?: TelemetryEventProperties,
    measurements?: TelemetryEventMeasurements,
  ) {
    this.reporter.sendTelemetryErrorEvent(eventName, properties, measurements);
  }
  public start(eventName: string, properties?: TelemetryEventProperties) {
    const startTime = Date.now();
    return (endProperties?: TelemetryEventProperties) => {
      const duration = Date.now() - startTime;
      this.reporter.sendTelemetryEvent(
        eventName,
        { ...properties, ...endProperties },
        { duration },
      );
    };
  }
  dispose(): Promise<any> {
    return this.reporter.dispose();
  }
}
