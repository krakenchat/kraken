import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@kraken/shared': path.resolve(__dirname, '../shared/src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/__tests__/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: [
        'src/utils/messageCacheUpdaters.ts',
        'src/utils/messageQueryKeys.ts',
        'src/utils/messageIndex.ts',
        'src/utils/queryInvalidation.ts',
        'src/hooks/useChannelWebSocket.ts',
        'src/hooks/useDirectMessageWebSocket.ts',
        'src/hooks/useThreadWebSocket.ts',
      ],
    },
  },
});
