/**
 * Background Timer Worker
 *
 * Manages timers inside a Web Worker. Web Worker timers are NOT subject
 * to background-tab throttling, so they keep firing at full speed even
 * when the page is hidden or the device screen is locked.
 *
 * Two independent protocols share this worker:
 *
 * Named repeating intervals (used by useVoicePresenceHeartbeat):
 *   IN:  { type: 'start', name: string, interval: number }
 *        { type: 'stop',  name: string }
 *        { type: 'stop-all' }
 *   OUT: { type: 'tick', name: string }
 *
 * Id-based one-shot/interval timers (used by livekitWorkerTimers to back
 * livekit-client's CriticalTimers):
 *   IN:  { type: 'set-timeout',  id: number, delay: number }
 *        { type: 'set-interval', id: number, delay: number }
 *        { type: 'clear-timer',  id: number }
 *   OUT: { type: 'timer-fired', id: number }
 */

const timers = new Map<string, ReturnType<typeof setInterval>>();
const idTimers = new Map<number, ReturnType<typeof setTimeout>>();

self.onmessage = (e: MessageEvent) => {
  const { type, name, interval, id, delay } = e.data;

  switch (type) {
    case 'start': {
      // Stop existing timer with same name before starting a new one
      const existing = timers.get(name);
      if (existing !== undefined) {
        clearInterval(existing);
      }
      const timerId = setInterval(() => {
        self.postMessage({ type: 'tick', name });
      }, interval);
      timers.set(name, timerId);
      break;
    }

    case 'stop': {
      const timerId = timers.get(name);
      if (timerId !== undefined) {
        clearInterval(timerId);
        timers.delete(name);
      }
      break;
    }

    case 'stop-all': {
      timers.forEach((timerId) => clearInterval(timerId));
      timers.clear();
      break;
    }

    case 'set-timeout': {
      idTimers.set(
        id,
        setTimeout(() => {
          idTimers.delete(id);
          self.postMessage({ type: 'timer-fired', id });
        }, delay)
      );
      break;
    }

    case 'set-interval': {
      idTimers.set(
        id,
        setInterval(() => {
          self.postMessage({ type: 'timer-fired', id });
        }, delay)
      );
      break;
    }

    case 'clear-timer': {
      const timerId = idTimers.get(id);
      if (timerId !== undefined) {
        // Works for both: clearTimeout and clearInterval are interchangeable
        clearTimeout(timerId);
        clearInterval(timerId as ReturnType<typeof setInterval>);
        idTimers.delete(id);
      }
      break;
    }
  }
};
