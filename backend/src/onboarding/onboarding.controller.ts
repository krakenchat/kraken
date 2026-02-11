import {
  Controller,
  Get,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import {
  SetupInstanceDto,
  OnboardingStatusDto,
} from './dto/setup-instance.dto';
import { Public } from '@/auth/public.decorator';
import { SetupResponseDto } from './dto/setup-response.dto';
import { Throttle } from '@nestjs/throttler';

@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get('status')
  @Public()
  async getStatus(): Promise<OnboardingStatusDto> {
    return this.onboardingService.getStatus();
  }

  @Post('setup')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 2, ttl: 1000 }, long: { limit: 5, ttl: 60000 } })
  async setupInstance(
    @Body() dto: SetupInstanceDto,
  ): Promise<SetupResponseDto> {
    if (!dto.setupToken) {
      throw new BadRequestException('Setup token is required');
    }

    const result = await this.onboardingService.completeSetup(
      dto,
      dto.setupToken,
    );

    return {
      success: true,
      message: 'Instance setup completed successfully',
      adminUserId: (result.adminUser as { id: string }).id,
      defaultCommunityId: (
        result.defaultCommunity as { id: string } | undefined
      )?.id,
    };
  }
}
