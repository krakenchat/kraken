import { Injectable, CanActivate, ExecutionContext, NotFoundException } from '@nestjs/common';
import { FilesService } from '../files.service';

@Injectable()
export class FileAccessGuard implements CanActivate {
  constructor(private readonly filesService: FilesService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const fileId = request.params.id;

    if (!user || !fileId) {
      return false;
    }

    const hasAccess = await this.filesService.checkFileAccess(fileId, user.id);
    if (!hasAccess) {
      throw new NotFoundException('File not found');
    }

    return true;
  }
}