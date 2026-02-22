import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { ConfigService } from '@nestjs/config';
import { INestApplicationContext, Logger } from '@nestjs/common';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor?: ReturnType<typeof createAdapter>;
  private configService: ConfigService;
  private readonly logger = new Logger(RedisIoAdapter.name);

  constructor(app: INestApplicationContext) {
    super(app);
    this.configService = app.get(ConfigService);
  }

  async connectToRedis(): Promise<void> {
    const redisHost = this.configService.get('REDIS_HOST') || 'localhost';
    const redisPort = this.configService.get('REDIS_PORT') || '6379';
    const redisPassword = this.configService.get('REDIS_PASSWORD');

    this.logger.log(
      `Connecting to Redis for Socket.IO adapter: ${redisHost}:${redisPort}`,
    );

    // Build Redis URL with optional password
    const redisUrl = redisPassword
      ? `redis://:${redisPassword}@${redisHost}:${redisPort}`
      : `redis://${redisHost}:${redisPort}`;

    const pubClient = createClient({ url: redisUrl });
    const subClient = pubClient.duplicate();

    // Add error handlers
    pubClient.on('error', (err) => {
      this.logger.error('Redis pub client error:', err);
    });
    subClient.on('error', (err) => {
      this.logger.error('Redis sub client error:', err);
    });

    pubClient.on('connect', () => {
      this.logger.log('Redis pub client connected');
    });
    subClient.on('connect', () => {
      this.logger.log('Redis sub client connected');
    });

    await Promise.all([pubClient.connect(), subClient.connect()]);

    this.adapterConstructor = createAdapter(pubClient, subClient);
    this.logger.log(
      'Redis Socket.IO adapter configured successfully for multi-pod coordination',
    );
  }

  createIOServer(port: number, options?: ServerOptions) {
    // Socket.IO Redis adapter types are incomplete — the adapter constructor
    // returns a type incompatible with the Server.adapter() signature, but
    // this is the documented usage pattern from @socket.io/redis-adapter.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
    const server = super.createIOServer(port, options);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    server.adapter(this.adapterConstructor);
    return server;
  }
}
