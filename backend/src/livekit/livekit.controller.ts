import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { LivekitService } from './livekit.service';
import { CreateTokenDto } from './dto/create-token.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RbacGuard } from '../auth/rbac.guard';
import { RequiredActions } from '../auth/rbac-action.decorator';
import { RbacActions } from '@prisma/client';
import {
  RbacResource,
  RbacResourceType,
  ResourceIdSource,
} from '../auth/rbac-resource.decorator';
import { UserEntity } from '../user/dto/user-response.dto';

@Controller('livekit')
@UseGuards(JwtAuthGuard, RbacGuard)
export class LivekitController {
  constructor(private readonly livekitService: LivekitService) {}

  @Post('token')
  @RequiredActions(RbacActions.JOIN_CHANNEL)
  @RbacResource({
    type: RbacResourceType.CHANNEL,
    idKey: 'roomId',
    source: ResourceIdSource.BODY,
  })
  async generateToken(
    @Body() createTokenDto: CreateTokenDto,
    @Req() req: { user: UserEntity },
  ) {
    // Use the authenticated user's ID as the identity if not provided
    const tokenDto = {
      ...createTokenDto,
      identity: createTokenDto.identity || req.user.id,
    };
    return this.livekitService.generateToken(tokenDto);
  }

  @Post('dm-token')
  async generateDmToken(
    @Body() createTokenDto: CreateTokenDto,
    @Req() req: { user: UserEntity },
  ) {
    // Use the authenticated user's ID as the identity if not provided
    // Note: DM membership is verified in the voice presence service when joining
    const tokenDto = {
      ...createTokenDto,
      identity: createTokenDto.identity || req.user.id,
    };
    return this.livekitService.generateToken(tokenDto);
  }

  @Get('connection-info')
  getConnectionInfo() {
    return this.livekitService.getConnectionInfo();
  }

  @Get('health')
  validateConfiguration() {
    const isValid = this.livekitService.validateConfiguration();
    return {
      status: isValid ? 'healthy' : 'unhealthy',
      configured: isValid,
    };
  }
}
