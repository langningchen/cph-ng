import type { ITelemetry } from '@/application/ports/ITelemetry';
import { telemetry } from '@/utils/global';

export class TelemetryAdapter implements ITelemetry {
  async init(): Promise<void> {
    await telemetry.init();
  }

  start(name: string): () => void {
    return telemetry.start(name);
  }

  error(name: string, error: unknown): void {
    telemetry.error(name, error);
  }

  event(name: string, props?: Record<string, string | number | boolean>): void {
    const normalizedProps = props
      ? Object.fromEntries(
          Object.entries(props).map(([key, value]) => [key, String(value)]),
        )
      : undefined;
    telemetry.log(name, normalizedProps);
  }
}

export default TelemetryAdapter;
