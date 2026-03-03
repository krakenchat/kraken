import { RoomName } from './room-name.util';

describe('RoomName', () => {
  describe('user', () => {
    it('should return user-prefixed id', () => {
      expect(RoomName.user('user-123')).toBe('user:user-123');
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
    it('should return dm-prefixed groupId', () => {
      expect(RoomName.dmGroup('dm-abc')).toBe('dm:dm-abc');
    });
  });

  describe('aliasGroup', () => {
    it('should return raw aliasGroupId', () => {
      expect(RoomName.aliasGroup('alias-def')).toBe('alias-def');
    });
  });
});
