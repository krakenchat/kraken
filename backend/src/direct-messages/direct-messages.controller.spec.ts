import { Test, TestingModule } from '@nestjs/testing';
import { DirectMessagesController } from './direct-messages.controller';
import { DirectMessagesService } from './direct-messages.service';
import { MessagesService } from '@/messages/messages.service';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { RbacGuard } from '@/auth/rbac.guard';
import {
  DirectMessageGroupFactory,
  UserFactory,
  MessageFactory,
} from '@/test-utils';
import { CreateDmGroupDto } from './dto/create-dm-group.dto';
import { AddMembersDto } from './dto/add-members.dto';

describe('DirectMessagesController', () => {
  let controller: DirectMessagesController;
  let directMessagesService: DirectMessagesService;
  let messagesService: MessagesService;

  const mockDirectMessagesService = {
    findUserDmGroups: jest.fn(),
    createDmGroup: jest.fn(),
    findDmGroup: jest.fn(),
    addMembers: jest.fn(),
    leaveDmGroup: jest.fn(),
  };

  const mockMessagesService = {
    findAllForDirectMessageGroup: jest.fn(),
  };

  const mockGuard = { canActivate: jest.fn(() => true) };

  const mockUser = UserFactory.build();
  const mockRequest = {
    user: { id: mockUser.id },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DirectMessagesController],
      providers: [
        {
          provide: DirectMessagesService,
          useValue: mockDirectMessagesService,
        },
        {
          provide: MessagesService,
          useValue: mockMessagesService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockGuard)
      .overrideGuard(RbacGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<DirectMessagesController>(DirectMessagesController);
    directMessagesService = module.get<DirectMessagesService>(
      DirectMessagesService,
    );
    messagesService = module.get<MessagesService>(MessagesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findUserDmGroups', () => {
    it('should return all DM groups for the user', async () => {
      const mockDmGroups = [
        DirectMessageGroupFactory.build(),
        DirectMessageGroupFactory.build(),
      ];

      jest
        .spyOn(directMessagesService, 'findUserDmGroups')
        .mockResolvedValue(mockDmGroups as any);

      const result = await controller.findUserDmGroups(mockRequest);

      expect(result).toEqual(mockDmGroups);
      expect(directMessagesService.findUserDmGroups).toHaveBeenCalledWith(
        mockUser.id,
      );
    });

    it('should return empty array when user has no DM groups', async () => {
      jest
        .spyOn(directMessagesService, 'findUserDmGroups')
        .mockResolvedValue([]);

      const result = await controller.findUserDmGroups(mockRequest);

      expect(result).toEqual([]);
    });
  });

  describe('createDmGroup', () => {
    it('should create a DM group with provided members', async () => {
      const createDto: CreateDmGroupDto = {
        userIds: ['user-1', 'user-2'],
        isGroup: true,
        name: 'Test Group',
      };

      const mockDmGroup = DirectMessageGroupFactory.build({
        name: 'Test Group',
        isGroup: true,
      });

      jest
        .spyOn(directMessagesService, 'createDmGroup')
        .mockResolvedValue(mockDmGroup as any);

      const result = await controller.createDmGroup(createDto, mockRequest);

      expect(result).toEqual(mockDmGroup);
      expect(directMessagesService.createDmGroup).toHaveBeenCalledWith(
        createDto,
        mockUser.id,
      );
    });

    it('should create a direct 1:1 DM', async () => {
      const createDto: CreateDmGroupDto = {
        userIds: ['user-1'],
        isGroup: false,
      };

      const mockDmGroup = DirectMessageGroupFactory.build({
        isGroup: false,
        name: null,
      });

      jest
        .spyOn(directMessagesService, 'createDmGroup')
        .mockResolvedValue(mockDmGroup as any);

      const result = await controller.createDmGroup(createDto, mockRequest);

      expect(result).toEqual(mockDmGroup);
      expect(result.isGroup).toBe(false);
    });
  });

  describe('findDmGroup', () => {
    it('should return a specific DM group', async () => {
      const dmGroupId = 'dm-group-123';
      const mockDmGroup = DirectMessageGroupFactory.build({ id: dmGroupId });

      jest
        .spyOn(directMessagesService, 'findDmGroup')
        .mockResolvedValue(mockDmGroup as any);

      const result = await controller.findDmGroup(dmGroupId, mockRequest);

      expect(result).toEqual(mockDmGroup);
      expect(directMessagesService.findDmGroup).toHaveBeenCalledWith(
        dmGroupId,
        mockUser.id,
      );
    });
  });

  describe('getDmMessages', () => {
    it('should return messages for a DM group', async () => {
      const dmGroupId = 'dm-group-123';
      const mockDmGroup = DirectMessageGroupFactory.build({ id: dmGroupId });
      const mockMessages = [MessageFactory.build(), MessageFactory.build()];

      jest
        .spyOn(directMessagesService, 'findDmGroup')
        .mockResolvedValue(mockDmGroup as any);
      jest
        .spyOn(messagesService, 'findAllForDirectMessageGroup')
        .mockResolvedValue(mockMessages as any);

      const result = await controller.getDmMessages(dmGroupId, mockRequest);

      expect(result).toEqual(mockMessages);
      expect(directMessagesService.findDmGroup).toHaveBeenCalledWith(
        dmGroupId,
        mockUser.id,
      );
      expect(messagesService.findAllForDirectMessageGroup).toHaveBeenCalledWith(
        dmGroupId,
      );
    });

    it('should verify user membership before returning messages', async () => {
      const dmGroupId = 'dm-group-123';
      const mockDmGroup = DirectMessageGroupFactory.build({ id: dmGroupId });

      jest
        .spyOn(directMessagesService, 'findDmGroup')
        .mockResolvedValue(mockDmGroup as any);
      jest
        .spyOn(messagesService, 'findAllForDirectMessageGroup')
        .mockResolvedValue({ messages: [], continuationToken: undefined });

      await controller.getDmMessages(dmGroupId, mockRequest);

      // findDmGroup should be called first (membership verification)
      expect(directMessagesService.findDmGroup).toHaveBeenCalled();
      expect(messagesService.findAllForDirectMessageGroup).toHaveBeenCalled();
    });
  });

  describe('addMembers', () => {
    it('should add members to a DM group', async () => {
      const dmGroupId = 'dm-group-123';
      const addMembersDto: AddMembersDto = {
        userIds: ['user-3', 'user-4'],
      };

      const mockDmGroup = DirectMessageGroupFactory.build({
        id: dmGroupId,
        isGroup: true,
      });

      jest
        .spyOn(directMessagesService, 'addMembers')
        .mockResolvedValue(mockDmGroup as any);

      const result = await controller.addMembers(
        dmGroupId,
        addMembersDto,
        mockRequest,
      );

      expect(result).toEqual(mockDmGroup);
      expect(directMessagesService.addMembers).toHaveBeenCalledWith(
        dmGroupId,
        addMembersDto,
        mockUser.id,
      );
    });
  });

  describe('leaveDmGroup', () => {
    it('should allow user to leave a DM group', async () => {
      const dmGroupId = 'dm-group-123';

      jest
        .spyOn(directMessagesService, 'leaveDmGroup')
        .mockResolvedValue(undefined);

      await controller.leaveDmGroup(dmGroupId, mockRequest);

      expect(directMessagesService.leaveDmGroup).toHaveBeenCalledWith(
        dmGroupId,
        mockUser.id,
      );
    });

    it('should return void when successfully leaving', async () => {
      const dmGroupId = 'dm-group-123';

      jest
        .spyOn(directMessagesService, 'leaveDmGroup')
        .mockResolvedValue(undefined);

      const result = await controller.leaveDmGroup(dmGroupId, mockRequest);

      expect(result).toBeUndefined();
    });
  });
});
