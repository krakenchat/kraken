import { Module } from '@nestjs/common';
import { GifsController } from './gifs.controller';
import { GifsService } from './gifs.service';
import { GIF_PROVIDER } from './providers/gif-provider.interface';
import { GiphyProvider } from './providers/giphy.provider';

@Module({
  controllers: [GifsController],
  providers: [GifsService, { provide: GIF_PROVIDER, useClass: GiphyProvider }],
})
export class GifsModule {}
