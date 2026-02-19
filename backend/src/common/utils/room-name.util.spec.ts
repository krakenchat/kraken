import { RoomName } from './room-name.util';

describe('RoomName', () => {
  describe('user', () => {
    it('should return raw userId', () => {
      expect(RoomName.user('user-123')).toBe('user-123');
    });
  });

  describe('community', () => {
    it('should return community-prefixed id', () => {
      expect(RoomName.community('comm-456')).toBe('community:comm-456');
    });
  });

  describe('channel', () => {
    it('should return raw channelId', () => {
      expect(RoomName.channel('channel-789')).toBe('channel-789');
    });
  });

  describe('dmGroup', () => {
    it('should return raw groupId', () => {
      expect(RoomName.dmGroup('dm-abc')).toBe('dm-abc');
    });
  });

  describe('aliasGroup', () => {
    it('should return raw aliasGroupId', () => {
      expect(RoomName.aliasGroup('alias-def')).toBe('alias-def');
    });
  });
});
