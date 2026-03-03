import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateChannelDto } from './update-channel.dto';

describe('UpdateChannelDto', () => {
  function createDto(partial: Partial<UpdateChannelDto>): UpdateChannelDto {
    return plainToInstance(UpdateChannelDto, partial);
  }

  it('should accept valid fields', async () => {
    const dto = createDto({ name: 'new-name', isPrivate: true });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should accept an empty object (all fields optional)', async () => {
    const dto = createDto({});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should reject name longer than 100 characters', async () => {
    const dto = createDto({ name: 'a'.repeat(101) });
    const errors = await validate(dto);
    const nameError = errors.find((e) => e.property === 'name');
    expect(nameError).toBeDefined();
  });

  it('should accept name at exactly 100 characters', async () => {
    const dto = createDto({ name: 'a'.repeat(100) });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should not have communityId as a DTO property', () => {
    const dto = new UpdateChannelDto();
    const propertyNames = Object.getOwnPropertyNames(dto);
    expect(propertyNames).not.toContain('communityId');
  });

  it('should not have type as a DTO property', () => {
    const dto = new UpdateChannelDto();
    const propertyNames = Object.getOwnPropertyNames(dto);
    expect(propertyNames).not.toContain('type');
  });

  it('should accept valid slowmodeSeconds', async () => {
    const dto = createDto({ slowmodeSeconds: 60 });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should reject negative slowmodeSeconds', async () => {
    const dto = createDto({ slowmodeSeconds: -1 });
    const errors = await validate(dto);
    const slowmodeError = errors.find(
      (e) => e.property === 'slowmodeSeconds',
    );
    expect(slowmodeError).toBeDefined();
  });

  it('should reject slowmodeSeconds exceeding 21600', async () => {
    const dto = createDto({ slowmodeSeconds: 21601 });
    const errors = await validate(dto);
    const slowmodeError = errors.find(
      (e) => e.property === 'slowmodeSeconds',
    );
    expect(slowmodeError).toBeDefined();
  });

  it('should accept slowmodeSeconds of 0', async () => {
    const dto = createDto({ slowmodeSeconds: 0 });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should accept valid position', async () => {
    const dto = createDto({ position: 5 });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should reject negative position', async () => {
    const dto = createDto({ position: -1 });
    const errors = await validate(dto);
    const positionError = errors.find((e) => e.property === 'position');
    expect(positionError).toBeDefined();
  });
});
