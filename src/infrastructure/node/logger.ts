import type { ILogger } from '@/application/ports/ILogger';
import Logger from '@/helpers/logger';

export class LoggerAdapter implements ILogger {
  private readonly logger: Logger;

  constructor(scope = 'app') {
    this.logger = new Logger(scope);
  }

  info(message: string, ...args: unknown[]): void {
    this.logger.info(message, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.logger.warn(message, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    this.logger.error(message, ...args);
  }

  debug(message: string, ...args: unknown[]): void {
    this.logger.debug(message, ...args);
  }
}

export default LoggerAdapter;
