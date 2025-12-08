import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  Req,
} from '@nestjs/common';
import { ThreadsService } from './threads.service';
import { CreateThreadReplyDto } from './dto/create-thread-reply.dto';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { RbacGuard } from '@/auth/rbac.guard';
import { RequiredActions } from '@/auth/rbac-action.decorator';
import { RbacActions } from '@prisma/client';
import {
  RbacResource,
  RbacResourceType,
  ResourceIdSource,
} from '@/auth/rbac-resource.decorator';
import { ParseObjectIdPipe } from 'nestjs-object-id';
import { AuthenticatedRequest } from '@/types';

/**
 * Controller for thread operations.
 * Thread permissions are inherited from the parent message's context.
 */
@Controller('threads')
@UseGuards(JwtAuthGuard, RbacGuard)
export class ThreadsController {
  constructor(private readonly threadsService: ThreadsService) {}

  /**
   * Create a reply in a thread.
   * Permission check: Uses message resource type to verify access to parent message context.
   */
  @Post(':parentMessageId/replies')
  @HttpCode(201)
  @RequiredActions(RbacActions.CREATE_MESSAGE)
  @RbacResource({
    type: RbacResourceType.MESSAGE,
    idKey: 'parentMessageId',
    source: ResourceIdSource.PARAM,
  })
  async createReply(
    @Param('parentMessageId', ParseObjectIdPipe) parentMessageId: string,
    @Body() body: Omit<CreateThreadReplyDto, 'parentMessageId'>,
    @Req() req: AuthenticatedRequest,
  ) {
    const dto: CreateThreadReplyDto = {
      ...body,
      parentMessageId,
    };
    return this.threadsService.createThreadReply(dto, req.user.id);
  }

  /**
   * Get paginated replies for a thread.
   */
  @Get(':parentMessageId/replies')
  @RequiredActions(RbacActions.READ_MESSAGE)
  @RbacResource({
    type: RbacResourceType.MESSAGE,
    idKey: 'parentMessageId',
    source: ResourceIdSource.PARAM,
  })
  async getReplies(
    @Param('parentMessageId', ParseObjectIdPipe) parentMessageId: string,
    @Query('limit') limit?: string,
    @Query('continuationToken') continuationToken?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    return this.threadsService.getThreadRepliesWithMetadata(
      parentMessageId,
      parsedLimit,
      continuationToken,
    );
  }

  /**
   * Get thread metadata (reply count, subscription status).
   */
  @Get(':parentMessageId/metadata')
  @RequiredActions(RbacActions.READ_MESSAGE)
  @RbacResource({
    type: RbacResourceType.MESSAGE,
    idKey: 'parentMessageId',
    source: ResourceIdSource.PARAM,
  })
  async getMetadata(
    @Param('parentMessageId', ParseObjectIdPipe) parentMessageId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.threadsService.getThreadMetadata(parentMessageId, req.user.id);
  }

  /**
   * Subscribe to a thread.
   */
  @Post(':parentMessageId/subscribe')
  @HttpCode(204)
  @RequiredActions(RbacActions.READ_MESSAGE)
  @RbacResource({
    type: RbacResourceType.MESSAGE,
    idKey: 'parentMessageId',
    source: ResourceIdSource.PARAM,
  })
  async subscribe(
    @Param('parentMessageId', ParseObjectIdPipe) parentMessageId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.threadsService.subscribeToThread(parentMessageId, req.user.id);
  }

  /**
   * Unsubscribe from a thread.
   */
  @Delete(':parentMessageId/subscribe')
  @HttpCode(204)
  @RequiredActions(RbacActions.READ_MESSAGE)
  @RbacResource({
    type: RbacResourceType.MESSAGE,
    idKey: 'parentMessageId',
    source: ResourceIdSource.PARAM,
  })
  async unsubscribe(
    @Param('parentMessageId', ParseObjectIdPipe) parentMessageId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.threadsService.unsubscribeFromThread(
      parentMessageId,
      req.user.id,
    );
  }
}
