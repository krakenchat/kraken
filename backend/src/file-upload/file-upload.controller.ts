import {
  Controller,
  Post,
  Body,
  Param,
  Delete,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  FileTypeValidator,
  HttpStatus,
  UseGuards,
  Req,
} from '@nestjs/common';
import { FileUploadService } from './file-upload.service';
import { CreateFileUploadDto } from './dto/create-file-upload.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { ParseObjectIdPipe } from 'nestjs-object-id';
import { MimeTypeAwareSizeValidator } from './validators/mime-type-aware-size.validator';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { UserEntity } from '@/user/dto/user-response.dto';

@UseGuards(JwtAuthGuard)
@Controller('file-upload')
export class FileUploadController {
  constructor(private readonly fileUploadService: FileUploadService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MimeTypeAwareSizeValidator({}),
          new FileTypeValidator({
            fileType: /^(image|video|audio|application|text)/,
            skipMagicNumbersValidation: true,
          }),
        ],
        errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      }),
    )
    file: Express.Multer.File,
    @Body() body: CreateFileUploadDto,
    @Req() req: { user: UserEntity },
  ) {
    return this.fileUploadService.uploadFile(file, body, req.user);
  }

  @Delete(':id')
  remove(@Param('id', ParseObjectIdPipe) id: string) {
    return this.fileUploadService.remove(id);
  }
}
