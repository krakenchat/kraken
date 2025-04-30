import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { CommunityService } from './community.service';
import { CreateCommunityDto } from './dto/create-community.dto';
import { UpdateCommunityDto } from './dto/update-community.dto';
import { RbacGuard } from '@/auth/rbac.guard';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { RequiredActions } from '@/auth/rbac-action.decorator';
import { RbacActions } from '@prisma/client';

@Controller('community')
@UseGuards(JwtAuthGuard, RbacGuard)
export class CommunityController {
  constructor(private readonly communityService: CommunityService) {}

  @Post()
  @RequiredActions(RbacActions.CREATE_COMMUNITY)
  create(@Body() createCommunityDto: CreateCommunityDto) {
    return this.communityService.create(createCommunityDto);
  }

  @Get()
  @RequiredActions(RbacActions.READ_COMMUNITY)
  findAll() {
    return this.communityService.findAll();
  }

  @Get(':id')
  @RequiredActions(RbacActions.READ_COMMUNITY)
  findOne(@Param('id', ParseIntPipe) id: string) {
    return this.communityService.findOne(id);
  }

  @Patch(':id')
  @RequiredActions(RbacActions.UPDATE_COMMUNITY)
  update(
    @Param('id') id: string,
    @Body() updateCommunityDto: UpdateCommunityDto,
  ) {
    return this.communityService.update(id, updateCommunityDto);
  }

  @Delete(':id')
  @RequiredActions(RbacActions.DELETE_COMMUNITY)
  remove(@Param('id') id: string) {
    return this.communityService.remove(id);
  }
}
