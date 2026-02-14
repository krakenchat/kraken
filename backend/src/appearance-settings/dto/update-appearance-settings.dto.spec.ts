import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateAppearanceSettingsDto } from './update-appearance-settings.dto';

describe('UpdateAppearanceSettingsDto', () => {
  function createDto(
    partial: Partial<UpdateAppearanceSettingsDto>,
  ): UpdateAppearanceSettingsDto {
    return plainToInstance(UpdateAppearanceSettingsDto, partial);
  }

  it('should accept "balanced" as a valid intensity', async () => {
    const dto = createDto({ intensity: 'balanced' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should accept "minimal" as a valid intensity', async () => {
    const dto = createDto({ intensity: 'minimal' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should accept "vibrant" as a valid intensity', async () => {
    const dto = createDto({ intensity: 'vibrant' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should reject "subtle" as an intensity value', async () => {
    const dto = createDto({ intensity: 'subtle' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('intensity');
  });

  it('should reject other invalid intensity values', async () => {
    const invalidValues = ['bold', 'extreme', 'none', ''];

    for (const value of invalidValues) {
      const dto = createDto({ intensity: value });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('intensity');
    }
  });

  it('should pass validation with an empty object (all fields optional)', async () => {
    const dto = createDto({});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
