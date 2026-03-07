import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class TimingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TimingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const start = Date.now();
    const label = this.getLabel(context);

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - start;
        this.logger.log(`${label} - ${duration}ms`);
      }),
    );
  }

  private getLabel(context: ExecutionContext): string {
    const type = context.getType();

    if (type === 'http') {
      const req = context.switchToHttp().getRequest<Request>();
      return `HTTP ${req.method} ${req.originalUrl || req.url}`;
    }

    if (type === 'ws') {
      const pattern = String(
        Reflect.getMetadata('message', context.getHandler()) ?? '',
      );
      const gateway = context.getClass().name;
      return `WS ${gateway}:${pattern || context.getHandler().name}`;
    }

    return `${type} ${context.getClass().name}.${context.getHandler().name}`;
  }
}
