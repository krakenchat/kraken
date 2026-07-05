import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  CreateCustomEmojiDto,
  CUSTOM_EMOJI_NAME_REGEX,
} from './create-custom-emoji.dto';

const FILE_ID = '11111111-1111-4111-8111-111111111111';

function validateName(name: string) {
  const dto = plainToInstance(CreateCustomEmojiDto, { name, fileId: FILE_ID });
  return validateSync(dto);
}

describe('CreateCustomEmojiDto name validation', () => {
  it('accepts names containing at least one letter', () => {
    for (const name of ['party_blob', 'a1', 'blob123', 'x_y', 'thumbsup2']) {
      expect(validateName(name)).toHaveLength(0);
      expect(CUSTOM_EMOJI_NAME_REGEX.test(name)).toBe(true);
    }
  });

  it('rejects letterless names (digits/underscores only)', () => {
    for (const name of ['12', '__', '1_2', '99', '____']) {
      const errors = validateName(name);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints?.matches).toContain('at least one letter');
      expect(CUSTOM_EMOJI_NAME_REGEX.test(name)).toBe(false);
    }
  });

  it('rejects names that are too short or too long', () => {
    expect(validateName('a').length).toBeGreaterThan(0);
    expect(validateName('a'.repeat(33)).length).toBeGreaterThan(0);
  });

  it('rejects names with uppercase or invalid characters', () => {
    for (const name of ['Blob', 'blob!', 'bl ob', 'bl-ob']) {
      expect(validateName(name).length).toBeGreaterThan(0);
    }
  });
});
