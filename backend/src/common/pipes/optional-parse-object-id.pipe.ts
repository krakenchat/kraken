import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

/**
 * Like ParseObjectIdPipe but allows undefined/null/empty values.
 * Use on optional query params that should be valid ObjectIds when present.
 */
@Injectable()
export class OptionalParseObjectIdPipe implements PipeTransform<string> {
  transform(value: string | undefined | null): string | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (!/^[a-f\d]{24}$/i.test(value)) {
      throw new BadRequestException(
        'Validation failed (ObjectId string is expected)',
      );
    }

    return value;
  }
}
