import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Req,
  HttpCode,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiOkResponse, ApiCreatedResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { RbacGuard } from '@/auth/rbac.guard';
import { RequiredActions } from '@/auth/rbac-action.decorator';
import {
  RbacResource,
  RbacResourceType,
  ResourceIdSource,
} from '@/auth/rbac-resource.decorator';
import { RbacActions } from '@prisma/client';
import { AuthenticatedRequest } from '@/types';
import { SoundboardService } from './soundboard.service';
import { CreateSoundboardSoundDto } from './dto/create-soundboard-sound.dto';
import { SoundboardSoundDto } from './dto/soundboard-sound-response.dto';

@Controller('soundboard')
@UseGuards(JwtAuthGuard, RbacGuard)
export class SoundboardController {
  constructor(private readonly soundboardService: SoundboardService) {}

  /**
   * List all soundboard sounds for a community.
   */
  @Get('community/:communityId')
  @ApiOkResponse({ type: [SoundboardSoundDto] })
  @RequiredActions(RbacActions.READ_SOUNDBOARD_SOUND)
  @RbacResource({
    type: RbacResourceType.COMMUNITY,
    idKey: 'communityId',
    source: ResourceIdSource.PARAM,
  })
  async listCommunitySounds(
    @Param('communityId', ParseUUIDPipe) communityId: string,
  ): Promise<SoundboardSoundDto[]> {
    return this.soundboardService.listCommunitySounds(communityId);
  }

  /**
   * Create a new soundboard sound from a previously uploaded audio file.
   */
  @Post('community/:communityId')
  @ApiCreatedResponse({ type: SoundboardSoundDto })
  @RequiredActions(RbacActions.CREATE_SOUNDBOARD_SOUND)
  @RbacResource({
    type: RbacResourceType.COMMUNITY,
    idKey: 'communityId',
    source: ResourceIdSource.PARAM,
  })
  async createSound(
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Body() dto: CreateSoundboardSoundDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<SoundboardSoundDto> {
    return this.soundboardService.createSound(communityId, req.user.id, dto);
  }

  /**
   * Delete a soundboard sound.
   */
  @Delete('community/:communityId/:soundId')
  @HttpCode(204)
  @RequiredActions(RbacActions.DELETE_SOUNDBOARD_SOUND)
  @RbacResource({
    type: RbacResourceType.COMMUNITY,
    idKey: 'communityId',
    source: ResourceIdSource.PARAM,
  })
  async deleteSound(
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Param('soundId', ParseUUIDPipe) soundId: string,
  ): Promise<void> {
    return this.soundboardService.deleteSound(communityId, soundId);
  }
}
