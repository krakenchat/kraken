import { TestBed } from '@suites/unit';
import type { Mocked } from '@suites/doubles.jest';
import { CustomEmojiController } from './custom-emoji.controller';
import { CustomEmojiService } from './custom-emoji.service';
import type { AuthenticatedRequest } from '@/types';

describe('CustomEmojiController', () => {
  let controller: CustomEmojiController;
  let service: Mocked<CustomEmojiService>;

  const communityId = 'comm-1';
  const emojiId = 'emoji-1';
  const userId = 'user-1';
  const req = { user: { id: userId } } as AuthenticatedRequest;

  const mockEmoji = {
    id: emojiId,
    communityId,
    name: 'party_blob',
    fileId: 'file-1',
    createdBy: userId,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const { unit, unitRef } = await TestBed.solitary(
      CustomEmojiController,
    ).compile();

    controller = unit;
    service = unitRef.get(CustomEmojiService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('lists community emojis', async () => {
    service.listCommunityEmojis = jest.fn().mockResolvedValue([mockEmoji]);

    const result = await controller.listCommunityEmojis(communityId);

    expect(service.listCommunityEmojis).toHaveBeenCalledWith(communityId);
    expect(result).toEqual([mockEmoji]);
  });

  it('creates an emoji, passing the authenticated user id', async () => {
    service.createEmoji = jest.fn().mockResolvedValue(mockEmoji);
    const dto = { name: 'party_blob', fileId: 'file-1' };

    const result = await controller.createEmoji(communityId, dto, req);

    expect(service.createEmoji).toHaveBeenCalledWith(communityId, dto, userId);
    expect(result).toEqual(mockEmoji);
  });

  it('deletes an emoji scoped to its community', async () => {
    service.deleteEmoji = jest.fn().mockResolvedValue(undefined);

    await controller.deleteEmoji(communityId, emojiId);

    expect(service.deleteEmoji).toHaveBeenCalledWith(communityId, emojiId);
  });
});
