import { ArrayMinLength } from './array-min-length.decorator';
import { validate } from 'class-validator';

class TestDto {
  @ArrayMinLength(2)
  items: string[];
}

class CustomMessageDto {
  @ArrayMinLength(3, { message: 'Custom error message' })
  elements: number[];
}

describe('ArrayMinLength', () => {
  it('should be defined', () => {
    expect(ArrayMinLength).toBeDefined();
  });

  describe('validation', () => {
    it('should pass validation when array has minimum length', async () => {
      const dto = new TestDto();
      dto.items = ['item1', 'item2'];

      const errors = await validate(dto);

      expect(errors.length).toBe(0);
    });

    it('should pass validation when array exceeds minimum length', async () => {
      const dto = new TestDto();
      dto.items = ['item1', 'item2', 'item3', 'item4'];

      const errors = await validate(dto);

      expect(errors.length).toBe(0);
    });

    it('should fail validation when array is shorter than minimum', async () => {
      const dto = new TestDto();
      dto.items = ['item1'];

      const errors = await validate(dto);

      expect(errors.length).toBe(1);
      expect(errors[0].property).toBe('items');
      expect(errors[0].constraints).toHaveProperty('arrayMinLength');
    });

    it('should fail validation when array is empty', async () => {
      const dto = new TestDto();
      dto.items = [];

      const errors = await validate(dto);

      expect(errors.length).toBe(1);
      expect(errors[0].property).toBe('items');
    });

    it('should fail validation when value is not an array', async () => {
      const dto = new TestDto();
      (dto.items as any) = 'not an array';

      const errors = await validate(dto);

      expect(errors.length).toBe(1);
    });

    it('should fail validation when value is null', async () => {
      const dto = new TestDto();
      (dto.items as any) = null;

      const errors = await validate(dto);

      expect(errors.length).toBe(1);
    });

    it('should fail validation when value is undefined', async () => {
      const dto = new TestDto();
      (dto.items as any) = undefined;

      const errors = await validate(dto);

      expect(errors.length).toBe(1);
    });
  });

  describe('error message', () => {
    it('should generate default error message with min length', async () => {
      const dto = new TestDto();
      dto.items = ['item1'];

      const errors = await validate(dto);

      expect(errors[0].constraints?.arrayMinLength).toContain('items');
      expect(errors[0].constraints?.arrayMinLength).toContain(
        'at least 2 element',
      );
    });

    it('should use custom error message when provided', async () => {
      const dto = new CustomMessageDto();
      dto.elements = [1, 2];

      const errors = await validate(dto);

      expect(errors.length).toBe(1);
      expect(errors[0].constraints?.arrayMinLength).toBe(
        'Custom error message',
      );
    });

    it('should include property name in default message', async () => {
      const dto = new CustomMessageDto();
      dto.elements = [];

      const errors = await validate(dto);

      // Custom message overrides default
      expect(errors[0].constraints?.arrayMinLength).toBe(
        'Custom error message',
      );
    });
  });

  describe('different minimum values', () => {
    it('should validate with min length of 1', async () => {
      class MinOneDto {
        @ArrayMinLength(1)
        items: string[];
      }

      const dto = new MinOneDto();
      dto.items = ['one'];

      const errors = await validate(dto);

      expect(errors.length).toBe(0);
    });

    it('should validate with min length of 5', async () => {
      class MinFiveDto {
        @ArrayMinLength(5)
        items: string[];
      }

      const dto = new MinFiveDto();
      dto.items = ['1', '2', '3', '4', '5'];

      const errors = await validate(dto);

      expect(errors.length).toBe(0);
    });

    it('should fail with min length of 5 when array has 4 items', async () => {
      class MinFiveDto {
        @ArrayMinLength(5)
        items: string[];
      }

      const dto = new MinFiveDto();
      dto.items = ['1', '2', '3', '4'];

      const errors = await validate(dto);

      expect(errors.length).toBe(1);
      expect(errors[0].constraints?.arrayMinLength).toContain(
        'at least 5 element',
      );
    });
  });

  describe('array content types', () => {
    it('should validate array of strings', async () => {
      const dto = new TestDto();
      dto.items = ['string1', 'string2', 'string3'];

      const errors = await validate(dto);

      expect(errors.length).toBe(0);
    });

    it('should validate array of numbers', async () => {
      class NumberArrayDto {
        @ArrayMinLength(2)
        numbers: number[];
      }

      const dto = new NumberArrayDto();
      dto.numbers = [1, 2, 3];

      const errors = await validate(dto);

      expect(errors.length).toBe(0);
    });

    it('should validate array of objects', async () => {
      class ObjectArrayDto {
        @ArrayMinLength(2)
        objects: { id: number; name: string }[];
      }

      const dto = new ObjectArrayDto();
      dto.objects = [
        { id: 1, name: 'test1' },
        { id: 2, name: 'test2' },
      ];

      const errors = await validate(dto);

      expect(errors.length).toBe(0);
    });

    it('should validate array with mixed types', async () => {
      class MixedArrayDto {
        @ArrayMinLength(2)
        mixed: any[];
      }

      const dto = new MixedArrayDto();
      dto.mixed = [1, 'string', { key: 'value' }];

      const errors = await validate(dto);

      expect(errors.length).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle array with exactly minimum length', async () => {
      const dto = new TestDto();
      dto.items = ['exact1', 'exact2'];

      const errors = await validate(dto);

      expect(errors.length).toBe(0);
    });

    it('should handle empty array with min 0', async () => {
      class MinZeroDto {
        @ArrayMinLength(0)
        items: string[];
      }

      const dto = new MinZeroDto();
      dto.items = [];

      const errors = await validate(dto);

      expect(errors.length).toBe(0);
    });

    it('should handle very large arrays', async () => {
      const dto = new TestDto();
      dto.items = new Array(1000).fill('item');

      const errors = await validate(dto);

      expect(errors.length).toBe(0);
    });
  });
});
