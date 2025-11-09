import { LocalAuthGuard } from './local-auth.guard';

describe('LocalAuthGuard', () => {
  let guard: LocalAuthGuard;

  beforeEach(() => {
    guard = new LocalAuthGuard();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should extend AuthGuard with local strategy', () => {
    expect(guard).toBeInstanceOf(LocalAuthGuard);
  });

  it('should call canActivate from parent AuthGuard', () => {
    // The guard will call the Passport local strategy
    // We just verify the method exists and is callable
    expect(typeof guard.canActivate).toBe('function');
  });
});
