import { Test, TestingModule } from '@nestjs/testing';
import { ChannelMembershipController } from './channel-membership.controller';
import { ChannelMembershipService } from './channel-membership.service';

describe('ChannelMembershipController', () => {
  let controller: ChannelMembershipController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChannelMembershipController],
      providers: [ChannelMembershipService],
    }).compile();

    controller = module.get<ChannelMembershipController>(ChannelMembershipController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
