import { TimingInterceptor } from './timing.interceptor';
import { CallHandler, ExecutionContext, Logger } from '@nestjs/common';
import { of } from 'rxjs';

describe('TimingInterceptor', () => {
  let interceptor: TimingInterceptor;
  let mockExecutionContext: ExecutionContext;
  let mockCallHandler: CallHandler;
  let loggerSpy: jest.SpyInstance;

  beforeEach(() => {
    interceptor = new TimingInterceptor();

    // Spy on the Logger.prototype.log method
    loggerSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();

    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          method: 'GET',
          url: '/api/test',
        }),
      }),
    } as any;

    mockCallHandler = {
      handle: jest.fn().mockReturnValue(of('response')),
    };
  });

  afterEach(() => {
    loggerSpy.mockRestore();
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should intercept and log timing', (done) => {
    const result$ = interceptor.intercept(
      mockExecutionContext,
      mockCallHandler,
    );

    result$.subscribe({
      next: (value) => {
        expect(value).toBe('response');
        expect(mockCallHandler.handle).toHaveBeenCalled();
        expect(loggerSpy).toHaveBeenCalled();

        const logCall = loggerSpy.mock.calls[0][0];
        expect(logCall).toContain('GET');
        expect(logCall).toContain('/api/test');
        expect(logCall).toMatch(/\d+ms$/);

        done();
      },
    });
  });

  it('should use originalUrl if available', (done) => {
    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          method: 'POST',
          originalUrl: '/api/original',
          url: '/api/fallback',
        }),
      }),
    } as any;

    const result$ = interceptor.intercept(
      mockExecutionContext,
      mockCallHandler,
    );

    result$.subscribe({
      next: () => {
        const logCall = loggerSpy.mock.calls[0][0];
        expect(logCall).toContain('/api/original');
        expect(logCall).not.toContain('/api/fallback');

        done();
      },
    });
  });

  it('should fall back to url if originalUrl is not available', (done) => {
    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          method: 'PUT',
          url: '/api/fallback',
        }),
      }),
    } as any;

    const result$ = interceptor.intercept(
      mockExecutionContext,
      mockCallHandler,
    );

    result$.subscribe({
      next: () => {
        const logCall = loggerSpy.mock.calls[0][0];
        expect(logCall).toContain('/api/fallback');

        done();
      },
    });
  });

  it('should log different HTTP methods', async () => {
    const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

    for (const method of methods) {
      loggerSpy.mockClear();

      mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            method,
            url: '/api/test',
          }),
        }),
      } as any;

      await new Promise<void>((resolve) => {
        interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
          next: () => {
            const logCall = loggerSpy.mock.calls[0][0];
            expect(logCall).toContain(method);
            resolve();
          },
        });
      });
    }
  });

  it('should measure elapsed time', (done) => {
    const result$ = interceptor.intercept(
      mockExecutionContext,
      mockCallHandler,
    );

    result$.subscribe({
      next: () => {
        const logCall = loggerSpy.mock.calls[0][0];
        const match = logCall.match(/(\d+)ms$/);
        expect(match).toBeTruthy();

        const duration = parseInt(match[1], 10);
        expect(duration).toBeGreaterThanOrEqual(0);

        done();
      },
    });
  });
});
