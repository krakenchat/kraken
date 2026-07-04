import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  canInstall,
  promptInstall,
  subscribeInstallPrompt,
  _resetInstallPromptForTests,
} from '../../utils/installPrompt';

function fireBeforeInstallPrompt(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
    prompt: ReturnType<typeof vi.fn>;
    userChoice: Promise<{ outcome: string; platform: string }>;
  };
  event.prompt = vi.fn().mockResolvedValue(undefined);
  event.userChoice = Promise.resolve({ outcome, platform: 'web' });
  window.dispatchEvent(event);
  return event;
}

describe('installPrompt', () => {
  beforeEach(() => {
    _resetInstallPromptForTests();
  });

  it('starts with no install available', () => {
    expect(canInstall()).toBe(false);
  });

  it('captures beforeinstallprompt and reports installable', () => {
    const event = fireBeforeInstallPrompt();
    expect(canInstall()).toBe(true);
    expect(event.defaultPrevented).toBe(true);
  });

  it('notifies subscribers when the prompt is captured', () => {
    const listener = vi.fn();
    subscribeInstallPrompt(listener);
    fireBeforeInstallPrompt();
    expect(listener).toHaveBeenCalled();
  });

  it('prompts, resolves the outcome, and consumes the event', async () => {
    const event = fireBeforeInstallPrompt('accepted');

    const outcome = await promptInstall();

    expect(event.prompt).toHaveBeenCalled();
    expect(outcome).toBe('accepted');
    expect(canInstall()).toBe(false);
  });

  it('returns null when no prompt was captured', async () => {
    expect(await promptInstall()).toBeNull();
  });

  it('clears the captured prompt on appinstalled', () => {
    fireBeforeInstallPrompt();
    expect(canInstall()).toBe(true);

    window.dispatchEvent(new Event('appinstalled'));
    expect(canInstall()).toBe(false);
  });

  it('unsubscribe stops notifications', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeInstallPrompt(listener);
    unsubscribe();
    fireBeforeInstallPrompt();
    expect(listener).not.toHaveBeenCalled();
  });
});
