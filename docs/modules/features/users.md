# Users Module

> **Location:** `backend/src/user/user.module.ts`  
> **Type:** Feature Module  
> **Domain:** user management & registration

## Overview

The Users Module provides comprehensive user management functionality for the Kraken application, including user registration via instance invitations, profile management, user search, and integration with community membership systems. It implements secure password handling, instance owner assignment for first users, and automatic community joining based on invitation configurations.

## Module Structure

```
user/
├── user.module.ts            # Module definition
├── user.service.ts           # Core user business logic
├── user.controller.ts        # HTTP endpoints with RBAC protection
├── user.service.spec.ts      # Service unit tests
├── user.controller.spec.ts   # Controller unit tests
└── dto/
    ├── create-user.dto.ts    # User registration DTO
    └── user-response.dto.ts  # User response DTO with security exclusions
```

## Services

### UserService

**Purpose:** Manages user lifecycle, registration process, search functionality, and integration with invitation and community systems.

#### Key Methods

```typescript
class UserService {
  constructor(
    private database: DatabaseService,
    private instanceInviteService: InviteService,
    private channelsService: ChannelsService,
  ) {}

  // Basic user operations
  async findByUsername(username: string): Promise<User | null> {
    // Retrieves user by username for authentication
    // Used by AuthService for login validation
  }

  async findById(id: string): Promise<User | null> {
    // Retrieves user by ID for profile operations
    // Used throughout application for user lookups
  }

  // Registration and onboarding
  async createUser(
    code: string, 
    username: string, 
    password: string, 
    email?: string
  ): Promise<User> {
    // Complete user registration workflow:
    // 1. Validates username/email uniqueness
    // 2. Validates and redeems invitation code
    // 3. Assigns instance role (OWNER for first user, USER for others)
    // 4. Creates user with hashed password
    // 5. Processes invitation default communities
    // 6. Adds user to general channels automatically
  }

  // Search and discovery
  async searchUsers(
    query: string,
    communityId?: string,
    limit: number = 50,
  ): Promise<UserEntity[]> {
    // Searches users by username or email
    // Optionally filters to exclude existing community members
    // Used for member invitation and discovery
  }

  async findAll(limit: number = 50, continuationToken?: string) {
    // Paginated user listing for admin interfaces
    // Returns users with continuation token for efficient pagination
  }

  // Helper methods
  async getInvite(code: string): Promise<InstanceInvite | null> {
    // Validates invitation code through InviteService
  }

  async checkForFieldConflicts(username?: string, email?: string): Promise<void> {
    // Prevents duplicate usernames and emails
    // Throws ConflictException for existing values
  }
}
```

#### User Registration Flow

```typescript
async createUser(code: string, username: string, password: string, email?: string): Promise<User> {
  // 1. Validate uniqueness
  await this.checkForFieldConflicts(username, email);
  
  // 2. Validate invitation
  const invite = await this.getInvite(code);
  if (!invite) {
    throw new NotFoundException('No invite found for the provided code.');
  }

  // 3. Determine user role (first user becomes OWNER)
  const userCount = await this.database.user.count();
  const role = userCount === 0 ? InstanceRole.OWNER : InstanceRole.USER;
  const verified = userCount === 0; // Auto-verify first user

  // 4. Hash password securely
  const hashedPassword = await bcrypt.hash(password, 10);

  // 5. Create user and process invitation atomically
  const user = await this.database.$transaction(async (tx) => {
    // Create user record
    const createdUser = await tx.user.create({
      data: {
        username: username.toLowerCase(),
        displayName: username.toLowerCase(),
        email,
        hashedPassword,
        verified,
        role,
      },
    });

    // Redeem invitation
    const updatedInvite = await this.instanceInviteService.redeemInviteWithTx(
      tx, invite.code, createdUser.id
    );

    // Process default community memberships
    if (updatedInvite.defaultCommunityId.length > 0) {
      // Create community memberships
      await tx.membership.createMany({
        data: updatedInvite.defaultCommunityId.map((communityId) => ({
          userId: createdUser.id,
          communityId,
        })),
      });

      // Add to general channels (graceful failure)
      for (const communityId of updatedInvite.defaultCommunityId) {
        try {
          await this.channelsService.addUserToGeneralChannel(
            communityId, createdUser.id
          );
        } catch (error) {
          console.warn('Failed to add user to general channel:', error);
          // Continue registration even if channel access fails
        }
      }
    }

    return createdUser;
  });

  return user;
}
```

#### User Search Implementation

```typescript
async searchUsers(
  query: string,
  communityId?: string,
  limit: number = 50,
): Promise<UserEntity[]> {
  const whereClause: Prisma.UserWhereInput = {
    OR: [
      { username: { contains: query, mode: 'insensitive' } },
      { email: { contains: query, mode: 'insensitive' } },
    ],
  };

  // Filter out existing community members for invitation purposes
  if (communityId) {
    whereClause.NOT = {
      memberships: {
        some: { communityId: communityId }
      }
    };
  }

  const users = await this.database.user.findMany({
    where: whereClause,
    take: limit,
    orderBy: { username: 'asc' },
  });

  return users.map((u) => new UserEntity(u));
}
```

## Controllers

### UserController

**Base Route:** `/api/users`

#### Endpoints

| Method | Endpoint | Description | Auth Required | RBAC Actions |
|--------|----------|-------------|---------------|--------------|
| POST | `/` | Register new user | ❌ (Public) | None |
| GET | `/profile` | Get current user profile | ✅ | None |
| GET | `/username/:name` | Get user by username | ✅ | None |
| GET | `/search` | Search users | ✅ | `READ_USER` |
| GET | `/:id` | Get user by ID | ✅ | None |
| GET | `/` | List all users (paginated) | ✅ | `READ_USER` |

#### Example Endpoint Implementation

```typescript
@Post()
@Public()
async register(@Body() dto: CreateUserDto): Promise<UserEntity> {
  const user = new UserEntity(
    await this.userService.createUser(
      dto.code,
      dto.username,
      dto.password,
      dto.email,
    ),
  );
  return user;
}

@Get('profile')
@UseGuards(JwtAuthGuard)
async getProfile(@Request() req: { user: { id: string } }): Promise<UserEntity> {
  const profile = await this.userService.findById(req.user.id);
  if (!profile) {
    throw new NotFoundException('User not found');
  }
  return new UserEntity(profile);
}

@Get('search')
@UseGuards(JwtAuthGuard)
@RequiredActions(RbacActions.READ_USER)
@RbacResource({ type: RbacResourceType.INSTANCE })
searchUsers(
  @Query('q') query: string,
  @Query('communityId') communityId?: string,
  @Query('limit', ParseIntPipe) limit?: number,
): Promise<UserEntity[]> {
  return this.userService.searchUsers(query, communityId, limit);
}
```

#### Security Patterns

```typescript
// Public registration endpoint (no authentication required)
@Post()
@Public()
async register(@Body() dto: CreateUserDto): Promise<UserEntity> {
  // Registration is public but requires valid invitation code
}

// Self-profile access (no RBAC required)
@Get('profile')
@UseGuards(JwtAuthGuard)
async getProfile(@Request() req: { user: { id: string } }) {
  // Users can always access their own profile
}

// Administrative operations require permissions
@Get()
@UseGuards(JwtAuthGuard)
@RequiredActions(RbacActions.READ_USER)
@RbacResource({ type: RbacResourceType.INSTANCE })
findAllUsers() {
  // Instance-level permission required for user listing
}
```

## DTOs (Data Transfer Objects)

### CreateUserDto

```typescript
export class CreateUserDto {
  code: string;           // Instance invitation code (required)
  username: string;       // Desired username (will be lowercased)
  password: string;       // Plain password (will be hashed)
  email?: string;         // Optional email address
}
```

### UserEntity (Response DTO)

```typescript
export class UserEntity implements User {
  id: string;                    // User ID
  username: string;              // Username (always lowercase)
  role: InstanceRole;            // OWNER or USER
  avatarUrl: string | null;      // Profile picture URL
  lastSeen: Date | null;         // Last activity timestamp
  displayName: string | null;    // Display name (defaults to username)

  // Security: Excluded from responses
  @Exclude()
  email: string | null;          // Email address (private)
  
  @Exclude()
  verified: boolean;             // Email verification status
  
  @Exclude()
  createdAt: Date;              // Account creation timestamp
  
  @Exclude()
  hashedPassword: string;        // Password hash (never exposed)

  constructor(partial: Partial<UserEntity>) {
    Object.assign(this, partial);
  }
}
```

### Security Exclusions

```typescript
// Sensitive fields automatically excluded from API responses
@Exclude() email: string | null;          // Privacy protection
@Exclude() verified: boolean;             // Internal verification state
@Exclude() createdAt: Date;              // Internal metadata
@Exclude() hashedPassword: string;        // Security critical
```

## Database Schema

### User Model

```prisma
model User {
  id             String        @id @default(auto()) @map("_id") @db.ObjectId
  username       String        @unique                    // Unique username
  email          String?       @unique                    // Optional unique email
  verified       Boolean       @default(false)           // Email verification
  hashedPassword String                                   // Bcrypt password hash
  role           InstanceRole  @default(USER)            // Instance role
  displayName    String?                                 // Display name
  avatarUrl      String?                                 // Avatar image URL
  lastSeen       DateTime?                               // Last activity
  createdAt      DateTime      @default(now())
  
  // Relations
  memberships    Membership[]     @relation("UserMemberships")
  UserRoles      UserRoles[]      // Community role assignments
  RefreshToken   RefreshToken[]   // Auth tokens
  ChannelMembership ChannelMembership[] @relation("UserChannelMemberships")
  
  // Direct message relations (planned)
  directMessageGroupMemberships DirectMessageGroupMember[]
  friendshipsA   Friendship[]     @relation("FriendshipA")
  friendshipsB   Friendship[]     @relation("FriendshipB")
  
  @@map("users")
}

enum InstanceRole {
  OWNER  // Instance administrator (first user)
  USER   // Regular user
}
```

### Instance Owner Assignment

```typescript
// First user automatically becomes instance owner
const userCount = await this.database.user.count();
const role = userCount === 0 ? InstanceRole.OWNER : InstanceRole.USER;
const verified = userCount === 0; // Auto-verify first user
```

## Dependencies

### Internal Dependencies
- `@/database/database.module` - User data persistence
- `@/invite/invite.module` - Invitation validation and redemption
- `@/channels/channels.module` - Automatic channel access setup
- `@/auth/auth.module` - Authentication and RBAC protection

### External Dependencies
- `@nestjs/common` - NestJS decorators and exceptions
- `bcrypt` - Secure password hashing
- `class-transformer` - DTO serialization with security exclusions
- `nestjs-object-id` - MongoDB ObjectId validation

## Authentication & Authorization

### Guards Used
- `JwtAuthGuard` - Ensures user authentication where required
- `RbacGuard` - Enforces role-based access control for admin operations

### RBAC Permissions

```typescript
// User management permissions
READ_USER    // View user information and perform searches
CREATE_USER  // Admin user creation (not used for public registration)
UPDATE_USER  // Modify user profiles (planned)
DELETE_USER  // Remove users (planned)
```

### Public vs Protected Endpoints

```typescript
// Public registration (invitation required)
@Post()
@Public()
async register() {
  // No authentication required, but valid invitation code needed
}

// Protected profile access
@Get('profile')
@UseGuards(JwtAuthGuard)
async getProfile() {
  // Authentication required, users access own profile
}

// Administrative operations
@Get()
@RequiredActions(RbacActions.READ_USER)
@RbacResource({ type: RbacResourceType.INSTANCE })
findAllUsers() {
  // Instance-level permission required
}
```

## Security Features

### Password Security
```typescript
// Secure password hashing with bcrypt
const hashedPassword = await bcrypt.hash(password, 10);

// Passwords never stored in plain text or returned in responses
@Exclude()
hashedPassword: string;
```

### Data Privacy
```typescript
// Sensitive user data excluded from API responses
@Exclude() email: string | null;
@Exclude() verified: boolean;
@Exclude() createdAt: Date;

// UserEntity constructor filters response data automatically
export class UserEntity {
  constructor(partial: Partial<UserEntity>) {
    Object.assign(this, partial);
  }
}
```

### Username Normalization
```typescript
// Usernames consistently lowercased for storage
const createdUser = await tx.user.create({
  data: {
    username: username.toLowerCase(),
    displayName: username.toLowerCase(),
    // ...
  },
});
```

### Field Conflict Prevention
```typescript
async checkForFieldConflicts(username?: string, email?: string): Promise<void> {
  const existingUser = await this.database.user.findFirst({
    where: { OR: [{ username }, { email }] }
  });

  if (existingUser) {
    const conflictField = existingUser.username === username ? 'username' : 'email';
    throw new ConflictException(`A user with this ${conflictField} already exists.`);
  }
}
```

## Integration with Other Modules

### Invitation System Integration
```typescript
// Registration requires valid invitation
const invite = await this.getInvite(code);
if (!invite) {
  throw new NotFoundException('No invite found for the provided code.');
}

// Redeem invitation during user creation
const updatedInvite = await this.instanceInviteService.redeemInviteWithTx(
  tx, invite.code, createdUser.id
);
```

### Community Integration
```typescript
// Automatic community membership from invitation
if (updatedInvite.defaultCommunityId.length > 0) {
  await tx.membership.createMany({
    data: updatedInvite.defaultCommunityId.map((communityId) => ({
      userId: createdUser.id,
      communityId,
    })),
  });
}
```

### Channel Integration
```typescript
// Automatic general channel access (graceful failure)
for (const communityId of updatedInvite.defaultCommunityId) {
  try {
    await this.channelsService.addUserToGeneralChannel(communityId, createdUser.id);
  } catch (error) {
    console.warn('Failed to add user to general channel:', error);
    // Registration continues even if channel access fails
  }
}
```

## Error Handling

### Registration Validation
```typescript
// Username/email conflicts
throw new ConflictException('A user with this username already exists.');

// Invalid invitation codes
throw new NotFoundException('No invite found for the provided code.');

// Invitation redemption failures
throw new NotFoundException('Failed to redeem invite.');
```

### User Lookup Failures
```typescript
// User not found scenarios
if (!user) {
  throw new NotFoundException('User not found');
}

// Profile access for non-existent users
if (!profile) {
  throw new NotFoundException('User not found');
}
```

## Performance Considerations

- **Cursor-based Pagination:** Efficient user listing for large datasets
- **Database Indexes:** Unique indexes on username and email for fast lookups
- **Search Optimization:** Uses database-level text search with case-insensitive matching
- **Password Hashing:** Bcrypt with salt rounds optimized for security vs performance
- **Transaction Usage:** Atomic user creation with invitation processing

## Testing

### Service Tests
```typescript
describe('UserService', () => {
  describe('createUser', () => {
    it('should create first user as OWNER', async () => {
      mockDatabase.user.count.mockResolvedValue(0);
      
      const user = await service.createUser('invite-code', 'admin', 'password123');
      
      expect(user.role).toBe(InstanceRole.OWNER);
      expect(user.verified).toBe(true);
    });

    it('should create subsequent users as USER', async () => {
      mockDatabase.user.count.mockResolvedValue(1);
      
      const user = await service.createUser('invite-code', 'user1', 'password123');
      
      expect(user.role).toBe(InstanceRole.USER);
      expect(user.verified).toBe(false);
    });

    it('should handle username conflicts', async () => {
      mockDatabase.user.findFirst.mockResolvedValue({ username: 'existing' });
      
      await expect(service.createUser('code', 'existing', 'pass'))
        .rejects.toThrow(ConflictException);
    });
  });

  describe('searchUsers', () => {
    it('should search by username and email', async () => {
      const users = await service.searchUsers('john');
      
      expect(mockDatabase.user.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { username: { contains: 'john', mode: 'insensitive' } },
            { email: { contains: 'john', mode: 'insensitive' } }
          ]
        }
      });
    });

    it('should exclude community members when filtering', async () => {
      await service.searchUsers('john', 'community-123');
      
      expect(mockDatabase.user.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          NOT: {
            memberships: {
              some: { communityId: 'community-123' }
            }
          }
        })
      });
    });
  });
});
```

### Controller Tests
```typescript
describe('UserController', () => {
  describe('register', () => {
    it('should register user with valid invitation', async () => {
      const registerDto = {
        code: 'valid-invite',
        username: 'newuser',
        password: 'password123'
      };

      const result = await controller.register(registerDto);
      
      expect(result).toBeInstanceOf(UserEntity);
      expect(result.username).toBe('newuser');
      expect(result.hashedPassword).toBeUndefined(); // Excluded from response
    });
  });

  describe('getProfile', () => {
    it('should return user profile', async () => {
      const profile = await controller.getProfile({ user: { id: 'user-123' } });
      
      expect(profile).toBeInstanceOf(UserEntity);
      expect(mockUserService.findById).toHaveBeenCalledWith('user-123');
    });
  });
});
```

## Common Usage Patterns

### Pattern 1: User Registration Flow
```typescript
// Frontend registration form submits to public endpoint
POST /users
{
  "code": "invitation-code-123",
  "username": "newuser",
  "password": "securePassword123",
  "email": "user@example.com"
}

// Server validates invitation, creates user, assigns communities
// Response excludes sensitive data
{
  "id": "user-456",
  "username": "newuser",
  "role": "USER",
  "displayName": "newuser",
  "avatarUrl": null,
  "lastSeen": null
}
```

### Pattern 2: Profile Management
```typescript
// Authenticated users access their own profile
GET /users/profile
Headers: { Authorization: "Bearer jwt-token" }

// Returns current user's profile information
// Sensitive data automatically excluded via UserEntity
```

### Pattern 3: User Search for Community Invitations
```typescript
// Admin searches for users to invite to community
GET /users/search?q=john&communityId=community-123&limit=10

// Returns users matching "john" who are NOT already members
// Used for community member invitation interfaces
```

### Pattern 4: Instance Owner Operations
```typescript
// First user registration automatically creates instance owner
const userCount = await this.database.user.count();
if (userCount === 0) {
  // This user becomes instance owner with full permissions
  role = InstanceRole.OWNER;
  verified = true; // Auto-verify first user
}
```

## Related Modules

- **Auth Module** - User authentication and session management
- **Invite Module** - User registration via invitation system
- **Membership Module** - Community membership management
- **Channels Module** - Automatic channel access setup
- **Roles Module** - User role and permission management

## Migration Notes

### User Model Evolution
- **Version 1.x:** Basic user registration with instance roles
- **Future:** Enhanced profiles, email verification, account settings

### Registration System
- **Current:** Invitation-only registration
- **Future:** Potential for public registration modes or admin-created accounts

## Troubleshooting

### Common Issues
1. **Registration Failures with Invalid Invitations**
   - **Symptoms:** NotFoundException on user creation
   - **Cause:** Invalid or expired invitation codes
   - **Solution:** Verify invitation system and code generation

2. **Username Conflicts During Registration**
   - **Symptoms:** ConflictException during user creation
   - **Cause:** Username or email already exists
   - **Solution:** Implement client-side validation and suggest alternatives

3. **General Channel Access Failures**
   - **Symptoms:** User created but not in community channels
   - **Cause:** Channel service errors during registration
   - **Solution:** Check channel service availability and default channel setup

4. **Instance Owner Assignment Issues**
   - **Symptoms:** Multiple owners or no owner assigned
   - **Cause:** Race conditions during first user registration
   - **Solution:** Verify user count check and transaction handling

## Related Documentation

- [Auth Module](../auth/auth.md)
- [Invite Module](invite.md)
- [Membership Module](membership.md)
- [Instance Invites](../../features/instance-invites.md)
- [Users API](../../api/user.md)
- [RBAC System](../../features/auth-rbac.md)