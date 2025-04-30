import { Injectable } from '@nestjs/common';
import { CreateCommunityDto } from './dto/create-community.dto';
import { UpdateCommunityDto } from './dto/update-community.dto';

@Injectable()
export class CommunityService {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  create(createCommunityDto: CreateCommunityDto) {
    return 'This action adds a new community';
  }

  findAll() {
    return `This action returns all community`;
  }

  findOne(id: string) {
    return `This action returns a #${id} community`;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  update(id: string, updateCommunityDto: UpdateCommunityDto) {
    return `This action updates a #${id} community`;
  }

  remove(id: string) {
    return `This action removes a #${id} community`;
  }
}
