import { TestBed } from '@suites/unit';
import type { Mocked } from '@suites/doubles.jest';
import { MessageOwnershipGuard } from './message-ownership.guard';
import { MessagesService } from '@/messages/messages.service';
import { RbacGuard } from './rbac.guard';
import {
  UserFactory,
  MessageFactory,
  createMockHttpExecutionContext,
} from '@/test-utils';

describe('MessageOwnershipGuard', () => {
  let guard: MessageOwnershipGuard;
  let messagesService: Mocked<MessagesService>;
  let rbacGuard: Mocked<RbacGuard>;

  beforeEach(async () => {
    const { unit, unitRef } = await TestBed.solitary(
      MessageOwnershipGuard,
    ).compile();
    guard = unit;
    messagesService = unitRef.get(MessagesService);
    rbacGuard = unitRef.get(RbacGuard);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Message ownership check', () => {
    it('should allow access when user is message owner', async () => {
      const user = UserFactory.build();
      const message = MessageFactory.build({ authorId: user.id });
      const context = createMockHttpExecutionContext({
        user,
        params: { id: message.id },
      });

      messagesService.findOne.mockResolvedValue(message);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(messagesService.findOne).toHaveBeenCalledWith(message.id);
      expect(rbacGuard.canActivate).not.toHaveBeenCalled();
    });

    it('should fall back to RBAC when user is not message owner', async () => {
      const user = UserFactory.build();
      const message = MessageFactory.build({ authorId: 'different-user-id' });
      const context = createMockHttpExecutionContext({
        user,
        params: { id: message.id },
      });

      messagesService.findOne.mockResolvedValue(message);
      rbacGuard.canActivate.mockResolvedValue(true);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(messagesService.findOne).toHaveBeenCalledWith(message.id);
      expect(rbacGuard.canActivate).toHaveBeenCalledWith(context);
    });

    it('should deny access via RBAC when user is not owner and lacks permissions', async () => {
      const user = UserFactory.build();
      const message = MessageFactory.build({ authorId: 'different-user-id' });
      const context = createMockHttpExecutionContext({
        user,
        params: { id: message.id },
      });

      messagesService.findOne.mockResolvedValue(message);
      rbacGuard.canActivate.mockResolvedValue(false);

      const result = await guard.canActivate(context);

      expect(result).toBe(false);
      expect(rbacGuard.canActivate).toHaveBeenCalledWith(context);
    });
  });

  describe('No message ID scenarios', () => {
    it('should fall back to RBAC when no messageId in params', async () => {
      const user = UserFactory.build();
      const context = createMockHttpExecutionContext({
        user,
        params: {},
      });

      rbacGuard.canActivate.mockResolvedValue(true);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(messagesService.findOne).not.toHaveBeenCalled();
      expect(rbacGuard.canActivate).toHaveBeenCalledWith(context);
    });

    it('should fall back to RBAC when messageId is undefined', async () => {
      const user = UserFactory.build();
      const context = createMockHttpExecutionContext({
        user,
        params: { id: undefined },
      });

      rbacGuard.canActivate.mockResolvedValue(false);

      const result = await guard.canActivate(context);

      expect(result).toBe(false);
      expect(messagesService.findOne).not.toHaveBeenCalled();
      expect(rbacGuard.canActivate).toHaveBeenCalledWith(context);
    });

    it('should fall back to RBAC when messageId is null', async () => {
      const user = UserFactory.build();
      const context = createMockHttpExecutionContext({
        user,
        params: { id: null },
      });

      rbacGuard.canActivate.mockResolvedValue(true);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(messagesService.findOne).not.toHaveBeenCalled();
      expect(rbacGuard.canActivate).toHaveBeenCalledWith(context);
    });
  });

  describe('No user scenarios', () => {
    it('should deny access when no user is authenticated', async () => {
      // Create custom context with explicit undefined user (not using factory default)

      const mockContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            user: undefined,
            params: { id: 'message-123' },
          }),
        }),
        getType: jest.fn().mockReturnValue('http'),
        getClass: jest.fn(),
        getHandler: jest.fn(),
        getArgs: jest.fn(),
        getArgByIndex: jest.fn(),
        switchToRpc: jest.fn(),
        switchToWs: jest.fn(),
      } as any;

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(false);
      expect(messagesService.findOne).not.toHaveBeenCalled();
      expect(rbacGuard.canActivate).not.toHaveBeenCalled();
    });

    it('should deny access when user is null', async () => {
      const context = createMockHttpExecutionContext({
        user: null,
        params: { id: 'message-123' },
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(false);
      expect(messagesService.findOne).not.toHaveBeenCalled();
      expect(rbacGuard.canActivate).not.toHaveBeenCalled();
    });
  });

  describe('Message not found scenarios', () => {
    it('should fall back to RBAC when message is not found', async () => {
      const user = UserFactory.build();
      const context = createMockHttpExecutionContext({
        user,
        params: { id: 'nonexistent-message' },
      });

      messagesService.findOne.mockRejectedValue(new Error('Not found'));
      rbacGuard.canActivate.mockResolvedValue(false);

      const result = await guard.canActivate(context);

      expect(result).toBe(false);
      expect(messagesService.findOne).toHaveBeenCalledWith(
        'nonexistent-message',
      );
      expect(rbacGuard.canActivate).toHaveBeenCalledWith(context);
    });

    it('should allow access via RBAC when message not found but user has permissions', async () => {
      const user = UserFactory.build();
      const context = createMockHttpExecutionContext({
        user,
        params: { id: 'nonexistent-message' },
      });

      messagesService.findOne.mockRejectedValue(new Error('Not found'));
      rbacGuard.canActivate.mockResolvedValue(true);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(rbacGuard.canActivate).toHaveBeenCalledWith(context);
    });
  });

  describe('Ownership vs RBAC priority', () => {
    it('should prioritize ownership over RBAC checks', async () => {
      const user = UserFactory.build();
      const message = MessageFactory.build({ authorId: user.id });
      const context = createMockHttpExecutionContext({
        user,
        params: { id: message.id },
      });

      messagesService.findOne.mockResolvedValue(message);
      // Mock RBAC to return false to ensure ownership check takes precedence
      rbacGuard.canActivate.mockResolvedValue(false);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      // RBAC should not be called because ownership check succeeded
      expect(rbacGuard.canActivate).not.toHaveBeenCalled();
    });

    it('should use RBAC when ownership check fails', async () => {
      const user = UserFactory.build();
      const message = MessageFactory.build({ authorId: 'other-user-id' });
      const context = createMockHttpExecutionContext({
        user,
        params: { id: message.id },
      });

      messagesService.findOne.mockResolvedValue(message);
      rbacGuard.canActivate.mockResolvedValue(true);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(rbacGuard.canActivate).toHaveBeenCalledWith(context);
    });
  });

  describe('Error handling', () => {
    it('should handle database errors gracefully', async () => {
      const user = UserFactory.build();
      const context = createMockHttpExecutionContext({
        user,
        params: { id: 'message-123' },
      });

      messagesService.findOne.mockRejectedValue(
        new Error('Database connection lost'),
      );
      rbacGuard.canActivate.mockResolvedValue(false);

      const result = await guard.canActivate(context);

      expect(result).toBe(false);
      expect(rbacGuard.canActivate).toHaveBeenCalledWith(context);
    });

    it('should handle service errors gracefully', async () => {
      const user = UserFactory.build();
      const context = createMockHttpExecutionContext({
        user,
        params: { id: 'message-123' },
      });

      messagesService.findOne.mockRejectedValue(
        new TypeError('Unexpected error'),
      );
      rbacGuard.canActivate.mockResolvedValue(true);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(rbacGuard.canActivate).toHaveBeenCalledWith(context);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty string messageId', async () => {
      const user = UserFactory.build();
      const context = createMockHttpExecutionContext({
        user,
        params: { id: '' },
      });

      rbacGuard.canActivate.mockResolvedValue(false);

      const result = await guard.canActivate(context);

      expect(result).toBe(false);
      expect(messagesService.findOne).not.toHaveBeenCalled();
      expect(rbacGuard.canActivate).toHaveBeenCalledWith(context);
    });

    it('should correctly compare user IDs for ownership', async () => {
      const userId = 'user-exact-match';
      const user = UserFactory.build({ id: userId });
      const message = MessageFactory.build({ authorId: userId });
      const context = createMockHttpExecutionContext({
        user,
        params: { id: message.id },
      });

      messagesService.findOne.mockResolvedValue(message);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(message.authorId).toBe(user.id);
    });

    it('should not grant access for similar but different user IDs', async () => {
      const user = UserFactory.build({ id: 'user-123' });
      const message = MessageFactory.build({ authorId: 'user-124' }); // Off by one
      const context = createMockHttpExecutionContext({
        user,
        params: { id: message.id },
      });

      messagesService.findOne.mockResolvedValue(message);
      rbacGuard.canActivate.mockResolvedValue(false);

      const result = await guard.canActivate(context);

      expect(result).toBe(false);
      expect(rbacGuard.canActivate).toHaveBeenCalled();
    });
  });
});
