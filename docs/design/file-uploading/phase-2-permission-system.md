# Phase 2: Permission System & Message Integration

## Overview

Phase 2 implements the sophisticated permission system for file access control and integrates file uploads with the existing message system. This phase ensures that files are only accessible to users who have permission to view the associated content (messages, channels, communities).

## Permission Architecture

### File Access Control Matrix

```
File Type          | Access Control Mechanism | Permission Source
-------------------|---------------------------|------------------
Message Attachment | Message → Channel → Community | Channel membership + role permissions
Public File        | Instance membership       | User authentication
Avatar             | Public (instance members) | User authentication
Banner             | Public (instance members) | User authentication
Emoji              | Community-specific        | Community membership
```

### Permission Inheritance Flow

```
User Request → File Access → Check File Type → Apply Permission Logic
                                ↓
                    Message Attachment: Message → Channel → Community
                    Public File: Instance membership check
                    Community Asset: Community membership check
```

## Message-File Integration

### Extended Message Entity

```typescript
// backend/src/messages/entities/message.entity.ts
export class Message {
  // ... existing properties
  
  // File attachments
  attachments: Attachment[];
  
  // Computed properties
  hasAttachments: boolean;
  attachmentCount: number;
  totalAttachmentSize: number;
}
```

### Message Creation with Attachments

```typescript
// backend/src/messages/dto/create-message.dto.ts
export class CreateMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  content: string;
  
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  attachmentIds?: string[]; // File IDs to attach
  
  @IsString()
  channelId: string;
  
  @IsOptional()
  @IsString()
  replyToId?: string;
}
```

### Enhanced Message Service

```typescript
// backend/src/messages/messages.service.ts
@Injectable()
export class MessagesService {
  constructor(
    private prisma: DatabaseService,
    private filesService: FilesService,
    private rbacService: RbacService,
  ) {}
  
  async createMessage(
    createMessageDto: CreateMessageDto,
    userId: string,
  ): Promise<Message> {
    const { attachmentIds, ...messageData } = createMessageDto;
    
    // Create message
    const message = await this.prisma.message.create({
      data: {
        ...messageData,
        authorId: userId,
      },
    });
    
    // Attach files if provided
    if (attachmentIds && attachmentIds.length > 0) {
      await this.attachFilesToMessage(message.id, attachmentIds, userId);
    }
    
    return this.findMessageById(message.id);
  }
  
  private async attachFilesToMessage(
    messageId: string,
    fileIds: string[],
    userId: string,
  ): Promise<void> {
    // Validate user owns all files
    const files = await this.filesService.findManyById(fileIds);
    const unauthorizedFiles = files.filter(file => file.uploadedById !== userId);
    
    if (unauthorizedFiles.length > 0) {
      throw new ForbiddenException('Cannot attach files not owned by user');
    }
    
    // Create attachment records
    await this.prisma.attachment.createMany({
      data: fileIds.map((fileId, index) => ({
        fileId,
        messageId,
        order: index,
      })),
    });
    
    // Mark files as non-public (attached to message)
    await this.filesService.markFilesAsPrivate(fileIds);
  }
}
```

## Advanced File Access Guard

### Enhanced File Permission Checking

```typescript
// backend/src/files/guards/file-access.guard.ts
@Injectable()
export class FileAccessGuard implements CanActivate {
  constructor(
    private filesService: FilesService,
    private messagesService: MessagesService,
    private channelsService: ChannelsService,
    private communitiesService: CommunitiesService,
    private rbacService: RbacService,
  ) {}
  
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const fileId = request.params.id;
    
    const accessResult = await this.checkFileAccess(user, fileId);
    
    if (!accessResult.allowed) {
      throw new ForbiddenException(accessResult.reason);
    }
    
    return true;
  }
  
  async checkFileAccess(user: User, fileId: string): Promise<FileAccessResult> {
    const file = await this.filesService.findById(fileId);
    
    if (!file) {
      return { allowed: false, reason: 'File not found' };
    }
    
    // User owns the file
    if (file.uploadedById === user.id) {
      return { allowed: true, reason: 'File owner' };
    }
    
    // Public files - require instance membership
    if (file.isPublic) {
      return { allowed: true, reason: 'Public file' }; // User is authenticated
    }
    
    // Check attachment permissions
    const attachment = await this.filesService.findAttachmentByFileId(fileId);
    if (attachment) {
      return this.checkAttachmentPermissions(user, attachment);
    }
    
    // Check public file permissions (community assets)
    const publicFile = await this.filesService.findPublicFileByFileId(fileId);
    if (publicFile) {
      return this.checkPublicFilePermissions(user, publicFile);
    }
    
    return { allowed: false, reason: 'No permission to access file' };
  }
  
  private async checkAttachmentPermissions(
    user: User,
    attachment: Attachment,
  ): Promise<FileAccessResult> {
    // Get the message
    const message = await this.messagesService.findById(attachment.messageId);
    if (!message) {
      return { allowed: false, reason: 'Message not found' };
    }
    
    // Check channel access
    const channel = await this.channelsService.findById(message.channelId);
    if (!channel) {
      return { allowed: false, reason: 'Channel not found' };
    }
    
    // Check if user can view the channel
    const canViewChannel = await this.rbacService.checkPermission(
      user,
      RbacActions.VIEW_CHANNEL,
      {
        type: RbacResourceType.CHANNEL,
        id: channel.id,
      },
    );
    
    if (!canViewChannel) {
      return { allowed: false, reason: 'No permission to view channel' };
    }
    
    // Additional check for private channels
    if (channel.type === ChannelType.PRIVATE) {
      const isMember = await this.channelsService.isChannelMember(user.id, channel.id);
      if (!isMember) {
        return { allowed: false, reason: 'Not a member of private channel' };
      }
    }
    
    return { allowed: true, reason: 'Can view message channel' };
  }
  
  private async checkPublicFilePermissions(
    user: User,
    publicFile: PublicFile,
  ): Promise<FileAccessResult> {
    switch (publicFile.type) {
      case PublicFileType.COMMUNITY_ICON:
      case PublicFileType.COMMUNITY_BANNER:
      case PublicFileType.EMOJI:
        // Check community membership
        if (publicFile.entityId) {
          const isMember = await this.communitiesService.isCommunityMember(
            user.id,
            publicFile.entityId,
          );
          if (!isMember) {
            return { allowed: false, reason: 'Not a community member' };
          }
        }
        break;
        
      case PublicFileType.AVATAR:
      case PublicFileType.BANNER:
      case PublicFileType.INSTANCE_LOGO:
        // These are accessible to all authenticated users
        break;
    }
    
    return { allowed: true, reason: 'Public file access granted' };
  }
}

interface FileAccessResult {
  allowed: boolean;
  reason: string;
}
```

## File Access Middleware

### Route-Level Access Control

```typescript
// backend/src/middleware/file-access.middleware.ts
@Injectable()
export class FileAccessMiddleware implements NestMiddleware {
  constructor(
    private filesService: FilesService,
    private jwtService: JwtService,
  ) {}
  
  async use(req: Request, res: Response, next: NextFunction) {
    const fileId = this.extractFileIdFromPath(req.path);
    
    if (!fileId) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Extract token from request
    const token = this.extractTokenFromRequest(req);
    
    // Public file check first (no auth required for truly public files)
    const file = await this.filesService.findById(fileId);
    if (file && await this.isPubliclyAccessible(file)) {
      return next();
    }
    
    // Authenticate user for private files
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    try {
      const payload = this.jwtService.verify(token);
      const user = await this.getUserById(payload.sub);
      
      if (!user) {
        return res.status(401).json({ error: 'Invalid user' });
      }
      
      // Attach user to request
      (req as any).user = user;
      
      // Check file permissions
      const guard = new FileAccessGuard(/* dependencies */);
      const hasAccess = await guard.checkFileAccess(user, fileId);
      
      if (!hasAccess.allowed) {
        return res.status(403).json({ error: hasAccess.reason });
      }
      
      next();
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  }
  
  private extractFileIdFromPath(path: string): string | null {
    // Extract file ID from paths like:
    // /uploads/<fileId>.jpg
    // /api/files/<fileId>/download
    const matches = path.match(/\/([a-f0-9-]{36})/);
    return matches ? matches[1] : null;
  }
  
  private async isPubliclyAccessible(file: File): Promise<boolean> {
    // Check if file is marked as public and is truly publicly accessible
    if (!file.isPublic) return false;
    
    const publicFile = await this.filesService.findPublicFileByFileId(file.id);
    if (!publicFile) return false;
    
    // Instance logos and similar are publicly accessible
    const publicTypes = [
      PublicFileType.INSTANCE_LOGO,
    ];
    
    return publicTypes.includes(publicFile.type);
  }
}
```

## Message System WebSocket Integration

### File Upload Events

```typescript
// backend/src/messages/messages.gateway.ts
@WebSocketGateway({
  namespace: 'messages',
  cors: { origin: '*' },
})
export class MessagesGateway {
  constructor(
    private messagesService: MessagesService,
    private websocketService: WebsocketService,
  ) {}
  
  @SubscribeMessage(ClientEvents.SEND_MESSAGE_WITH_ATTACHMENTS)
  async handleMessageWithAttachments(
    @MessageBody() payload: CreateMessageWithAttachmentsDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const message = await this.messagesService.createMessage(payload, client.userId);
      
      // Send to all channel members
      this.websocketService.sendToRoom(
        payload.channelId,
        ServerEvents.NEW_MESSAGE,
        {
          message: await this.formatMessageWithAttachments(message),
        },
      );
      
      return { success: true, messageId: message.id };
    } catch (error) {
      throw new WsException(error.message);
    }
  }
  
  private async formatMessageWithAttachments(message: Message): Promise<MessageWithAttachmentsDto> {
    const attachments = await this.filesService.getMessageAttachments(message.id);
    
    return {
      ...message,
      attachments: attachments.map(att => ({
        id: att.file.id,
        filename: att.file.filename,
        mimeType: att.file.mimeType,
        size: att.file.size,
        width: att.file.width,
        height: att.file.height,
        thumbnailUrl: att.file.thumbnailPath 
          ? `/api/files/${att.file.id}/thumbnail`
          : null,
        downloadUrl: `/api/files/${att.file.id}/download`,
        order: att.order,
        description: att.description,
      })),
    };
  }
}
```

## File Cleanup & Lifecycle Management

### Orphaned File Cleanup

```typescript
// backend/src/files/services/file-cleanup.service.ts
@Injectable()
export class FileCleanupService {
  constructor(
    private filesService: FilesService,
    private storageService: IStorageService,
    private logger: Logger,
  ) {}
  
  @Cron('0 2 * * *') // Run at 2 AM daily
  async cleanupOrphanedFiles() {
    this.logger.log('Starting orphaned file cleanup');
    
    // Find files that are not attached to anything and older than 24 hours
    const orphanedFiles = await this.findOrphanedFiles();
    
    for (const file of orphanedFiles) {
      try {
        await this.deleteFile(file);
        this.logger.log(`Cleaned up orphaned file: ${file.id}`);
      } catch (error) {
        this.logger.error(`Failed to cleanup file ${file.id}: ${error.message}`);
      }
    }
    
    this.logger.log(`Cleaned up ${orphanedFiles.length} orphaned files`);
  }
  
  private async findOrphanedFiles(): Promise<File[]> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    return this.filesService.findMany({
      where: {
        AND: [
          { createdAt: { lt: oneDayAgo } },
          { isPublic: false },
          {
            OR: [
              { attachments: { none: {} } },
              { publicFiles: { none: {} } },
            ],
          },
        ],
      },
    });
  }
  
  async deleteFile(file: File): Promise<void> {
    // Delete from storage
    await this.storageService.delete(file.storagePath);
    
    // Delete thumbnail if exists
    if (file.thumbnailPath) {
      await this.storageService.delete(file.thumbnailPath);
    }
    
    // Delete from database
    await this.filesService.delete(file.id);
  }
}
```

## Public File Management

### Public File Service

```typescript
// backend/src/files/services/public-file.service.ts
@Injectable()
export class PublicFileService {
  constructor(
    private filesService: FilesService,
    private storageService: IStorageService,
  ) {}
  
  async setUserAvatar(userId: string, fileId: string): Promise<PublicFile> {
    // Validate file ownership
    const file = await this.filesService.findById(fileId);
    if (!file || file.uploadedById !== userId) {
      throw new ForbiddenException('Cannot use file not owned by user');
    }
    
    // Deactivate old avatar
    await this.deactivateExistingPublicFile(PublicFileType.AVATAR, userId);
    
    // Create new public file record
    return this.filesService.createPublicFile({
      fileId,
      type: PublicFileType.AVATAR,
      entityId: userId,
      entityType: 'user',
      isActive: true,
    });
  }
  
  async setCommunityIcon(
    communityId: string,
    fileId: string,
    userId: string,
  ): Promise<PublicFile> {
    // Check community admin permissions
    const hasPermission = await this.rbacService.checkPermission(
      { id: userId } as User,
      RbacActions.MANAGE_COMMUNITY,
      {
        type: RbacResourceType.COMMUNITY,
        id: communityId,
      },
    );
    
    if (!hasPermission) {
      throw new ForbiddenException('No permission to manage community');
    }
    
    // Deactivate old community icon
    await this.deactivateExistingPublicFile(
      PublicFileType.COMMUNITY_ICON,
      communityId,
    );
    
    return this.filesService.createPublicFile({
      fileId,
      type: PublicFileType.COMMUNITY_ICON,
      entityId: communityId,
      entityType: 'community',
      isActive: true,
    });
  }
  
  private async deactivateExistingPublicFile(
    type: PublicFileType,
    entityId: string,
  ): Promise<void> {
    await this.filesService.updatePublicFiles(
      { type, entityId, isActive: true },
      { isActive: false },
    );
  }
}
```

## Enhanced File Service

### Extended File Operations

```typescript
// backend/src/files/files.service.ts
@Injectable()
export class FilesService {
  constructor(
    private prisma: DatabaseService,
    private storageService: IStorageService,
    private metadataProcessor: FileMetadataProcessor,
  ) {}
  
  async getMessageAttachments(messageId: string): Promise<Attachment[]> {
    return this.prisma.attachment.findMany({
      where: { messageId },
      include: { file: true },
      orderBy: { order: 'asc' },
    });
  }
  
  async getUserFiles(
    userId: string,
    options: {
      type?: 'attachment' | 'public';
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<File[]> {
    const { type, limit = 50, offset = 0 } = options;
    
    const whereClause: any = { uploadedById: userId };
    
    if (type === 'attachment') {
      whereClause.attachments = { some: {} };
    } else if (type === 'public') {
      whereClause.isPublic = true;
    }
    
    return this.prisma.file.findMany({
      where: whereClause,
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
      include: {
        attachments: {
          include: { message: { select: { id: true, channelId: true } } },
        },
        publicFiles: true,
      },
    });
  }
  
  async markFilesAsPrivate(fileIds: string[]): Promise<void> {
    await this.prisma.file.updateMany({
      where: { id: { in: fileIds } },
      data: { isPublic: false },
    });
  }
  
  async getFileUsageStats(userId: string): Promise<FileUsageStats> {
    const [totalFiles, totalSize, attachmentCount, publicFileCount] = await Promise.all([
      this.prisma.file.count({ where: { uploadedById: userId } }),
      this.prisma.file.aggregate({
        where: { uploadedById: userId },
        _sum: { size: true },
      }),
      this.prisma.file.count({
        where: {
          uploadedById: userId,
          attachments: { some: {} },
        },
      }),
      this.prisma.file.count({
        where: {
          uploadedById: userId,
          isPublic: true,
        },
      }),
    ]);
    
    return {
      totalFiles,
      totalSize: totalSize._sum.size || 0,
      attachmentCount,
      publicFileCount,
    };
  }
}

interface FileUsageStats {
  totalFiles: number;
  totalSize: number;
  attachmentCount: number;
  publicFileCount: number;
}
```

## Implementation Tasks

### Backend Tasks
1. **Message Integration**
   - Extend Message entity with attachment relations
   - Update CreateMessageDto to support attachments
   - Implement message creation with file attachment
   - Add WebSocket events for messages with attachments

2. **Permission System**
   - Implement enhanced FileAccessGuard
   - Create file access middleware
   - Add attachment permission checking
   - Integrate with existing RBAC system

3. **Public File Management**
   - Create PublicFileService
   - Implement avatar/banner setting endpoints
   - Add community asset management
   - Create public file deactivation logic

4. **File Lifecycle**
   - Implement FileCleanupService
   - Add orphaned file detection
   - Create automated cleanup cron jobs
   - Add file usage statistics

### Database Tasks
1. **Schema Updates**
   - Add attachment relationships to messages
   - Create public file management tables
   - Add file access audit logging
   - Create indexes for performance

### Security Tasks
1. **Access Control**
   - Implement comprehensive permission checking
   - Add file access audit logging
   - Create rate limiting for file access
   - Add security headers for file serving

## Success Criteria

- [ ] Files attached to messages are only accessible to users who can view the message
- [ ] Public files (avatars, banners) are accessible to appropriate users
- [ ] Community assets respect community membership
- [ ] File cleanup removes orphaned files automatically
- [ ] Message creation with attachments works via API and WebSocket
- [ ] File access permissions integrate with existing RBAC system
- [ ] All file access is logged for security audit
- [ ] Performance is acceptable for large numbers of files

This phase ensures that the file system integrates seamlessly with the existing permission model while providing the security and access control necessary for a Discord-like application.