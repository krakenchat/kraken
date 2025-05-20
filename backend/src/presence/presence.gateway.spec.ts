import { Test, TestingModule } from '@nestjs/testing';
import { PresenceGateway } from './presence.gateway';

describe('PresenceGateway', () => {
  let gateway: PresenceGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PresenceGateway],
    }).compile();

    gateway = module.get<PresenceGateway>(PresenceGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });
});
