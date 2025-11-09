import { TimingInterceptor } from './timing.interceptor';
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';

describe('TimingInterceptor', () => {
  let interceptor: TimingInterceptor;
  let mockExecutionContext: ExecutionContext;
  let mockCallHandler: CallHandler;

  beforeEach(() => {
    interceptor = new TimingInterceptor();

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

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should intercept and log timing', (done) => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    const result$ = interceptor.intercept(
      mockExecutionContext,
      mockCallHandler,
    );

    result$.subscribe({
      next: (value) => {
        expect(value).toBe('response');
        expect(mockCallHandler.handle).toHaveBeenCalled();
        expect(consoleSpy).toHaveBeenCalled();

        const logCall = consoleSpy.mock.calls[0][0];
        expect(logCall).toContain('[Timing]');
        expect(logCall).toContain('GET');
        expect(logCall).toContain('/api/test');
        expect(logCall).toMatch(/\d+ms$/);

        consoleSpy.mockRestore();
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

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    const result$ = interceptor.intercept(
      mockExecutionContext,
      mockCallHandler,
    );

    result$.subscribe({
      next: () => {
        const logCall = consoleSpy.mock.calls[0][0];
        expect(logCall).toContain('/api/original');
        expect(logCall).not.toContain('/api/fallback');

        consoleSpy.mockRestore();
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

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    const result$ = interceptor.intercept(
      mockExecutionContext,
      mockCallHandler,
    );

    result$.subscribe({
      next: () => {
        const logCall = consoleSpy.mock.calls[0][0];
        expect(logCall).toContain('/api/fallback');

        consoleSpy.mockRestore();
        done();
      },
    });
  });

  it('should log different HTTP methods', (done) => {
    const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
    const promises = methods.map((method) => {
      return new Promise<void>((resolve) => {
        mockExecutionContext = {
          switchToHttp: jest.fn().mockReturnValue({
            getRequest: jest.fn().mockReturnValue({
              method,
              url: '/api/test',
            }),
          }),
        } as any;

        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

        interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
          next: () => {
            const logCall = consoleSpy.mock.calls[0][0];
            expect(logCall).toContain(method);
            consoleSpy.mockRestore();
            resolve();
          },
        });
      });
    });

    void Promise.all(promises).then(() => done());
  });

  it('should measure elapsed time', (done) => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    const result$ = interceptor.intercept(
      mockExecutionContext,
      mockCallHandler,
    );

    result$.subscribe({
      next: () => {
        const logCall = consoleSpy.mock.calls[0][0];
        const match = logCall.match(/(\d+)ms$/);
        expect(match).toBeTruthy();

        const duration = parseInt(match[1], 10);
        expect(duration).toBeGreaterThanOrEqual(0);

        consoleSpy.mockRestore();
        done();
      },
    });
  });
});
