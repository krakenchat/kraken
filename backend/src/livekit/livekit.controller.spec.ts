import { Test, TestingModule } from '@nestjs/testing';
import { LivekitController } from './livekit.controller';
import { LivekitService } from './livekit.service';

describe('LivekitController', () => {
  let controller: LivekitController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LivekitController],
      providers: [LivekitService],
    }).compile();

    controller = module.get<LivekitController>(LivekitController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
