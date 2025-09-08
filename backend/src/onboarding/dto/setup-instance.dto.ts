export class SetupInstanceDto {
  // Admin user creation
  adminUsername: string;
  adminPassword: string;
  adminEmail?: string;

  // Instance configuration
  instanceName: string;
  instanceDescription?: string;

  // Default community setup
  defaultCommunityName?: string;
  createDefaultCommunity?: boolean;

  // Setup token for validation
  setupToken: string;
}

export class OnboardingStatusDto {
  needsSetup: boolean;
  hasUsers: boolean;
  setupToken?: string;
}
