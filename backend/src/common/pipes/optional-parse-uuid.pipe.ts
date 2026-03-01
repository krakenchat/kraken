import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Like ParseUUIDPipe but allows undefined/null/empty values.
 * Use on optional query params that should be valid UUIDs when present.
 */
@Injectable()
export class OptionalParseUUIDPipe implements PipeTransform<string> {
  transform(value: string | undefined | null): string | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (!UUID_REGEX.test(value)) {
      throw new BadRequestException(
        'Validation failed (UUID string is expected)',
      );
    }

    return value;
  }
}
