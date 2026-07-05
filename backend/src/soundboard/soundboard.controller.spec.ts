import { TestBed } from '@suites/unit';
import type { Mocked } from '@suites/doubles.jest';
import { SoundboardController } from './soundboard.controller';
import { SoundboardService } from './soundboard.service';
import type { AuthenticatedRequest } from '@/types';

describe('SoundboardController', () => {
  let controller: SoundboardController;
  let service: Mocked<SoundboardService>;

  const communityId = 'comm-1';
  const mockSound = {
    id: 'sound-1',
    communityId,
    name: 'airhorn',
    emoji: '📯',
    fileId: 'file-1',
    createdBy: 'user-1',
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const { unit, unitRef } =
      await TestBed.solitary(SoundboardController).compile();

    controller = unit;
    service = unitRef.get(SoundboardService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('listCommunitySounds delegates to the service', async () => {
    service.listCommunitySounds = jest.fn().mockResolvedValue([mockSound]);

    const result = await controller.listCommunitySounds(communityId);

    expect(service.listCommunitySounds).toHaveBeenCalledWith(communityId);
    expect(result).toEqual([mockSound]);
  });

  it('createSound passes communityId, userId, and dto to the service', async () => {
    service.createSound = jest.fn().mockResolvedValue(mockSound);
    const dto = { name: 'airhorn', emoji: '📯', fileId: 'file-1' };
    const req = { user: { id: 'user-1' } } as AuthenticatedRequest;

    const result = await controller.createSound(communityId, dto, req);

    expect(service.createSound).toHaveBeenCalledWith(
      communityId,
      'user-1',
      dto,
    );
    expect(result).toEqual(mockSound);
  });

  it('deleteSound delegates to the service with community scope', async () => {
    service.deleteSound = jest.fn().mockResolvedValue(undefined);

    await controller.deleteSound(communityId, 'sound-1');

    expect(service.deleteSound).toHaveBeenCalledWith(communityId, 'sound-1');
  });
});
