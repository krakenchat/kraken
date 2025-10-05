import { FileValidator } from '@nestjs/common';
import { ResourceType } from '@prisma/client';
import {
  IFileValidationStrategy,
  MessageAttachmentValidationStrategy,
  UserAvatarValidationStrategy,
  CommunityBannerValidationStrategy,
  CustomEmojiValidationStrategy,
} from './strategies';

interface ResourceTypeFileValidatorOptions {
  resourceType: ResourceType;
}

/**
 * Custom file validator that uses strategy pattern to validate files
 * based on their ResourceType without switch statements
 */
export class ResourceTypeFileValidator extends FileValidator<ResourceTypeFileValidatorOptions> {
  private readonly strategies: Map<ResourceType, IFileValidationStrategy>;

  constructor(validationOptions: ResourceTypeFileValidatorOptions) {
    super(validationOptions);
    this.strategies = this.buildStrategyRegistry();
  }

  /**
   * Build the strategy registry mapping ResourceType to validation strategy
   */
  private buildStrategyRegistry(): Map<ResourceType, IFileValidationStrategy> {
    return new Map<ResourceType, IFileValidationStrategy>([
      [
        ResourceType.MESSAGE_ATTACHMENT,
        new MessageAttachmentValidationStrategy(),
      ],
      [ResourceType.USER_AVATAR, new UserAvatarValidationStrategy()],
      [ResourceType.USER_BANNER, new UserAvatarValidationStrategy()],
      [ResourceType.COMMUNITY_AVATAR, new CommunityBannerValidationStrategy()],
      [ResourceType.COMMUNITY_BANNER, new CommunityBannerValidationStrategy()],
      [ResourceType.CUSTOM_EMOJI, new CustomEmojiValidationStrategy()],
    ]);
  }

  async isValid(file?: Express.Multer.File): Promise<boolean> {
    if (!file) {
      return false;
    }

    const strategy = this.strategies.get(this.validationOptions.resourceType);

    if (!strategy) {
      return false;
    }

    // Check MIME type
    const allowedMimeTypes = strategy.getAllowedMimeTypes();
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return false;
    }

    // Check file size
    const maxSize = strategy.getMaxFileSize();
    if (file.size > maxSize) {
      return false;
    }

    // Check additional validation if defined
    if (strategy.validateAdditional) {
      return strategy.validateAdditional(file);
    }

    return true;
  }

  buildErrorMessage(file: Express.Multer.File): string {
    const strategy = this.strategies.get(this.validationOptions.resourceType);

    if (!strategy) {
      return `Invalid resource type: ${this.validationOptions.resourceType}`;
    }

    const allowedMimeTypes = strategy.getAllowedMimeTypes();
    const maxSize = strategy.getMaxFileSize();

    if (!allowedMimeTypes.includes(file.mimetype)) {
      return `Invalid file type. ${strategy.getValidationDescription()}`;
    }

    if (file.size > maxSize) {
      const maxSizeMB = (maxSize / 1024 / 1024).toFixed(2);
      const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
      return `File too large (${fileSizeMB}MB). Maximum allowed size is ${maxSizeMB}MB for ${this.validationOptions.resourceType}`;
    }

    return `File validation failed. ${strategy.getValidationDescription()}`;
  }
}
