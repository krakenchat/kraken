import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  HttpCode,
} from '@nestjs/common';
import { ParseObjectIdPipe } from 'nestjs-object-id';
import { CommunityService } from './community.service';
import { CreateCommunityDto } from './dto/create-community.dto';
import { UpdateCommunityDto } from './dto/update-community.dto';
import { RbacGuard } from '@/auth/rbac.guard';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { RequiredActions } from '@/auth/rbac-action.decorator';
import { RbacActions } from '@prisma/client';
import { UserEntity } from '@/user/dto/user-response.dto';

@Controller('community')
@UseGuards(JwtAuthGuard, RbacGuard)
export class CommunityController {
  constructor(private readonly communityService: CommunityService) {}

  @Post()
  @HttpCode(201)
  @RequiredActions(RbacActions.CREATE_COMMUNITY)
  create(
    @Body() createCommunityDto: CreateCommunityDto,
    @Req() req: { user: UserEntity },
  ) {
    return this.communityService.create(createCommunityDto, req.user.id);
  }

  @Get()
  @RequiredActions(RbacActions.READ_ALL_COMMUNITIES)
  findAll() {
    return this.communityService.findAll();
  }

  @Get('/mine')
  @RequiredActions(RbacActions.READ_COMMUNITY)
  findAllMine(@Req() req: { user: UserEntity }) {
    return this.communityService.findAll(req.user.id);
  }

  @Get(':id')
  @RequiredActions(RbacActions.READ_COMMUNITY)
  findOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.communityService.findOne(id);
  }

  @Patch(':id')
  @RequiredActions(RbacActions.UPDATE_COMMUNITY)
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() updateCommunityDto: UpdateCommunityDto,
  ) {
    return this.communityService.update(id, updateCommunityDto);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequiredActions(RbacActions.DELETE_COMMUNITY)
  remove(@Param('id', ParseObjectIdPipe) id: string) {
    return this.communityService.remove(id);
  }
}
