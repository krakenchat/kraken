import { setActiveDmGroupId, getActiveDmGroupId } from '../../utils/activeDmTracking';

describe('activeDmTracking', () => {
  afterEach(() => {
    setActiveDmGroupId(null);
  });

  it('should return null by default', () => {
    expect(getActiveDmGroupId()).toBeNull();
  });

  it('should store and return the active DM group ID', () => {
    setActiveDmGroupId('dm-group-123');
    expect(getActiveDmGroupId()).toBe('dm-group-123');
  });

  it('should clear the active DM group ID when set to null', () => {
    setActiveDmGroupId('dm-group-123');
    expect(getActiveDmGroupId()).toBe('dm-group-123');

    setActiveDmGroupId(null);
    expect(getActiveDmGroupId()).toBeNull();
  });

  it('should overwrite the previous value', () => {
    setActiveDmGroupId('dm-group-1');
    setActiveDmGroupId('dm-group-2');
    expect(getActiveDmGroupId()).toBe('dm-group-2');
  });
});
