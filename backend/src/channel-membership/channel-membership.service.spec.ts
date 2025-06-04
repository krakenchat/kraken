import { Test, TestingModule } from '@nestjs/testing';
import { ChannelMembershipService } from './channel-membership.service';

describe('ChannelMembershipService', () => {
  let service: ChannelMembershipService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ChannelMembershipService],
    }).compile();

    service = module.get<ChannelMembershipService>(ChannelMembershipService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
