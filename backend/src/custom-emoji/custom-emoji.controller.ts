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
import { RbacActions } from '@prisma/client';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { RbacGuard } from '@/auth/rbac.guard';
import { RequiredActions } from '@/auth/rbac-action.decorator';
import {
  RbacResource,
  RbacResourceType,
  ResourceIdSource,
} from '@/auth/rbac-resource.decorator';
import { AuthenticatedRequest } from '@/types';
import { CustomEmojiService } from './custom-emoji.service';
import { CreateCustomEmojiDto } from './dto/create-custom-emoji.dto';
import { CustomEmojiDto } from './dto/custom-emoji-response.dto';

@Controller('custom-emoji')
@UseGuards(JwtAuthGuard, RbacGuard)
export class CustomEmojiController {
  constructor(private readonly customEmojiService: CustomEmojiService) {}

  /**
   * List all custom emojis for a community. Available to any community member.
   */
  @Get('community/:communityId')
  @ApiOkResponse({ type: [CustomEmojiDto] })
  @RequiredActions(RbacActions.READ_COMMUNITY)
  @RbacResource({
    type: RbacResourceType.COMMUNITY,
    idKey: 'communityId',
    source: ResourceIdSource.PARAM,
  })
  async listCommunityEmojis(
    @Param('communityId', ParseUUIDPipe) communityId: string,
  ): Promise<CustomEmojiDto[]> {
    return this.customEmojiService.listCommunityEmojis(communityId);
  }

  /**
   * Register a new custom emoji from an uploaded CUSTOM_EMOJI file.
   */
  @Post('community/:communityId')
  @ApiCreatedResponse({ type: CustomEmojiDto })
  @RequiredActions(RbacActions.MANAGE_EMOJIS)
  @RbacResource({
    type: RbacResourceType.COMMUNITY,
    idKey: 'communityId',
    source: ResourceIdSource.PARAM,
  })
  async createEmoji(
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Body() dto: CreateCustomEmojiDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<CustomEmojiDto> {
    return this.customEmojiService.createEmoji(communityId, dto, req.user.id);
  }

  /**
   * Delete a custom emoji from a community.
   */
  @Delete('community/:communityId/:emojiId')
  @HttpCode(204)
  @RequiredActions(RbacActions.MANAGE_EMOJIS)
  @RbacResource({
    type: RbacResourceType.COMMUNITY,
    idKey: 'communityId',
    source: ResourceIdSource.PARAM,
  })
  async deleteEmoji(
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Param('emojiId', ParseUUIDPipe) emojiId: string,
  ): Promise<void> {
    return this.customEmojiService.deleteEmoji(communityId, emojiId);
  }
}
