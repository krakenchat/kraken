import { instanceToPlain } from 'class-transformer';
import { FriendshipWithUsersDto } from './friends-response.dto';
import { UserEntity } from '@/user/dto/user-response.dto';
import { FriendshipStatus, InstanceRole } from '@prisma/client';
import { UserFactory, expectNoSensitiveUserFields } from '@/test-utils';

describe('FriendshipWithUsersDto', () => {
  it('should contain UserEntity instances for userA and userB', () => {
    const userA = new UserEntity(UserFactory.buildComplete());
    const userB = new UserEntity(UserFactory.buildComplete());

    const dto: FriendshipWithUsersDto = {
      id: 'friendship-1',
      userAId: userA.id,
      userBId: userB.id,
      status: FriendshipStatus.ACCEPTED,
      createdAt: new Date(),
      userA,
      userB,
    };

    expect(dto.userA).toBeInstanceOf(UserEntity);
    expect(dto.userB).toBeInstanceOf(UserEntity);
  });

  it('should not leak sensitive user fields when serialized', () => {
    const userA = new UserEntity(UserFactory.buildComplete());
    const userB = new UserEntity(UserFactory.buildComplete());

    expectNoSensitiveUserFields(userA);
    expectNoSensitiveUserFields(userB);
  });

  it('should serialize to valid JSON without BigInt errors', () => {
    const userA = new UserEntity(
      UserFactory.buildComplete({ username: 'alice' }),
    );
    const userB = new UserEntity(
      UserFactory.buildComplete({ username: 'bob' }),
    );

    const dto: FriendshipWithUsersDto = {
      id: 'friendship-1',
      userAId: userA.id,
      userBId: userB.id,
      status: FriendshipStatus.ACCEPTED,
      createdAt: new Date(),
      userA,
      userB,
    };

    const plainA = instanceToPlain(dto.userA);
    const plainB = instanceToPlain(dto.userB);

    expect(() => JSON.stringify(plainA)).not.toThrow();
    expect(() => JSON.stringify(plainB)).not.toThrow();

    const parsedA = JSON.parse(JSON.stringify(plainA));
    expect(parsedA.username).toBe('alice');
    expect(parsedA.hashedPassword).toBeUndefined();
  });
});
