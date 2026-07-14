import { resolveJobWorkerConcurrency } from './jobs.constants';

describe('resolveJobWorkerConcurrency', () => {
  const ORIGINAL_ENV = process.env.JOB_WORKER_CONCURRENCY;

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
      delete process.env.JOB_WORKER_CONCURRENCY;
    } else {
      process.env.JOB_WORKER_CONCURRENCY = ORIGINAL_ENV;
    }
    jest.restoreAllMocks();
  });

  it('returns the default when the env var is unset', () => {
    delete process.env.JOB_WORKER_CONCURRENCY;
    expect(resolveJobWorkerConcurrency()).toBe(4);
  });

  it('honors a valid positive integer', () => {
    process.env.JOB_WORKER_CONCURRENCY = '10';
    expect(resolveJobWorkerConcurrency()).toBe(10);
  });

  it('treats an explicit "0" as invalid, warns, and falls back to the default', () => {
    process.env.JOB_WORKER_CONCURRENCY = '0';
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    expect(resolveJobWorkerConcurrency()).toBe(4);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Invalid JOB_WORKER_CONCURRENCY'),
    );
  });

  it('treats a negative value as invalid and falls back to the default', () => {
    process.env.JOB_WORKER_CONCURRENCY = '-1';
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    expect(resolveJobWorkerConcurrency()).toBe(4);
  });

  it('treats a non-numeric value as invalid and falls back to the default', () => {
    process.env.JOB_WORKER_CONCURRENCY = 'abc';
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    expect(resolveJobWorkerConcurrency()).toBe(4);
  });
});
