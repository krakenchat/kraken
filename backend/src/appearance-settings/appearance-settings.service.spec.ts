import { TestBed } from '@suites/unit';
import type { Mocked } from '@suites/doubles.jest';
import { AppearanceSettingsService } from './appearance-settings.service';
import { DatabaseService } from '@/database/database.service';

describe('AppearanceSettingsService', () => {
  let service: AppearanceSettingsService;
  let databaseService: Mocked<DatabaseService>;

  const mockSettings = {
    id: 'settings-1',
    userId: 'user-1',
    themeMode: 'dark',
    accentColor: 'blue',
    intensity: 'minimal',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const { unit, unitRef } = await TestBed.solitary(
      AppearanceSettingsService,
    ).compile();

    service = unit;
    databaseService = unitRef.get(DatabaseService);

    (databaseService.userAppearanceSettings as any) = {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUserSettings', () => {
    it('returns existing settings when found', async () => {
      (databaseService.userAppearanceSettings as any).findUnique.mockResolvedValue(mockSettings);

      const result = await service.getUserSettings('user-1');

      expect(result).toBe(mockSettings);
      expect(databaseService.userAppearanceSettings.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(databaseService.userAppearanceSettings.create).not.toHaveBeenCalled();
    });

    it('creates default settings when none exist', async () => {
      (databaseService.userAppearanceSettings as any).findUnique.mockResolvedValue(null);
      (databaseService.userAppearanceSettings as any).create.mockResolvedValue(mockSettings);

      const result = await service.getUserSettings('user-1');

      expect(databaseService.userAppearanceSettings.create).toHaveBeenCalledWith({
        data: { userId: 'user-1' },
      });
      expect(result).toBe(mockSettings);
    });

    it('passes the correct userId to findUnique', async () => {
      (databaseService.userAppearanceSettings as any).findUnique.mockResolvedValue(mockSettings);

      await service.getUserSettings('user-42');

      expect(databaseService.userAppearanceSettings.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-42' },
      });
    });
  });

  describe('updateUserSettings', () => {
    it('ensures settings exist before updating', async () => {
      (databaseService.userAppearanceSettings as any).findUnique.mockResolvedValue(mockSettings);
      (databaseService.userAppearanceSettings as any).update.mockResolvedValue({
        ...mockSettings,
        themeMode: 'light',
      });

      await service.updateUserSettings('user-1', { themeMode: 'light' } as any);

      // getUserSettings should have been called first
      expect(databaseService.userAppearanceSettings.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
    });

    it('creates default settings if missing, then updates', async () => {
      (databaseService.userAppearanceSettings as any).findUnique.mockResolvedValue(null);
      (databaseService.userAppearanceSettings as any).create.mockResolvedValue(mockSettings);
      (databaseService.userAppearanceSettings as any).update.mockResolvedValue({
        ...mockSettings,
        intensity: 'vibrant',
      });

      const result = await service.updateUserSettings('user-1', {
        intensity: 'vibrant',
      } as any);

      expect(databaseService.userAppearanceSettings.create).toHaveBeenCalled();
      expect(databaseService.userAppearanceSettings.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: { intensity: 'vibrant' },
      });
      expect(result.intensity).toBe('vibrant');
    });

    it('passes the DTO as data to the update call', async () => {
      (databaseService.userAppearanceSettings as any).findUnique.mockResolvedValue(mockSettings);
      (databaseService.userAppearanceSettings as any).update.mockResolvedValue(mockSettings);

      const dto = { themeMode: 'dark', accentColor: 'purple' };
      await service.updateUserSettings('user-1', dto as any);

      expect(databaseService.userAppearanceSettings.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: dto,
      });
    });
  });
});
