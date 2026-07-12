import { Module } from '@nestjs/common';
import { GifsController } from './gifs.controller';
import { GifsService } from './gifs.service';

@Module({
  controllers: [GifsController],
  providers: [GifsService],
})
export class GifsModule {}
