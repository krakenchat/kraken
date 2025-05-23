import { ArgumentsHost, Catch, Logger } from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';

@Catch()
export class WsLoggingExceptionFilter extends BaseWsExceptionFilter {
  private readonly logger = new Logger(WsLoggingExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    // TypeScript strict mode: getData() returns any, so we must suppress the warning for this assignment
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const data = host.switchToWs().getData();

    if (exception instanceof WsException) {
      this.logger.error(
        `WebSocket WsException: ${exception.message} | Data: ${JSON.stringify(data)}`,
        (exception as Error).stack,
      );
    } else if (exception instanceof Error) {
      this.logger.error(
        `WebSocket Error: ${exception.message} | Data: ${JSON.stringify(data)}`,
        exception.stack,
      );
    } else {
      this.logger.error(
        `WebSocket Unknown Exception: ${JSON.stringify(exception)} | Data: ${JSON.stringify(data)}`,
        undefined,
      );
    }
    super.catch(exception, host);
  }
}
