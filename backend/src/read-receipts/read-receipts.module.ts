import { Module } from '@nestjs/common';
import { ReadReceiptsService } from './read-receipts.service';
import { ReadReceiptsController } from './read-receipts.controller';
import { ReadReceiptsGateway } from './read-receipts.gateway';
import { DatabaseModule } from '@/database/database.module';
import { WebsocketModule } from '@/websocket/websocket.module';
import { AuthModule } from '@/auth/auth.module';
import { UserModule } from '@/user/user.module';

@Module({
  controllers: [ReadReceiptsController],
  providers: [ReadReceiptsService, ReadReceiptsGateway],
  imports: [DatabaseModule, WebsocketModule, AuthModule, UserModule],
  exports: [ReadReceiptsService],
})
export class ReadReceiptsModule {}
