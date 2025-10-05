import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@/database/database.service';

@Injectable()
export class FileService {
  constructor(private readonly databaseService: DatabaseService) {}

  findOne(id: string) {
    return this.databaseService.file.findUniqueOrThrow({
      where: { id },
    });
  }
}
