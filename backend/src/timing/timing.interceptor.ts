import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class TimingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req: { method: string; originalUrl?: string; url?: string } = context
      .switchToHttp()
      .getRequest();

    const method = req.method;
    const url = req.originalUrl || req.url;
    const start = Date.now();
    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - start;
        console.log(`[Timing] ${method} ${url} - ${duration}ms`);
      }),
    );
  }
}
