import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Slim representation of a Tenor GIF result — only the fields the composer
 * picker and message-send flow need.
 */
export class GifResultDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  /** Full-size animated GIF URL (media_formats.gif.url) — sent as message content. */
  @ApiProperty()
  url: string;

  /** Small animated preview used in the picker grid (media_formats.tinygif.url). */
  @ApiProperty()
  previewUrl: string;

  @ApiProperty()
  width: number;

  @ApiProperty()
  height: number;
}

export class GifSearchResponseDto {
  @ApiProperty({ type: [GifResultDto] })
  results: GifResultDto[];

  /** Tenor's pagination cursor for the next page; undefined when exhausted. */
  @ApiPropertyOptional()
  next?: string;
}
