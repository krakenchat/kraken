/**
 * Background Timer Worker
 *
 * Manages multiple named interval timers inside a Web Worker.
 * Web Worker timers are NOT subject to background-tab throttling,
 * so they keep firing at full speed even when the page is hidden.
 *
 * Messages IN:
 *   { type: 'start', name: string, interval: number }
 *   { type: 'stop',  name: string }
 *   { type: 'stop-all' }
 *
 * Messages OUT:
 *   { type: 'tick', name: string }
 */

const timers = new Map<string, ReturnType<typeof setInterval>>();

self.onmessage = (e: MessageEvent) => {
  const { type, name, interval } = e.data;

  switch (type) {
    case 'start': {
      // Stop existing timer with same name before starting a new one
      const existing = timers.get(name);
      if (existing !== undefined) {
        clearInterval(existing);
      }
      const id = setInterval(() => {
        self.postMessage({ type: 'tick', name });
      }, interval);
      timers.set(name, id);
      break;
    }

    case 'stop': {
      const id = timers.get(name);
      if (id !== undefined) {
        clearInterval(id);
        timers.delete(name);
      }
      break;
    }

    case 'stop-all': {
      timers.forEach((id) => clearInterval(id));
      timers.clear();
      break;
    }
  }
};
