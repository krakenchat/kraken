import { TestBed } from '@suites/unit';
import type { Mocked } from '@suites/doubles.jest';
import { MessageDispatchService } from './message-dispatch.service';
import { MessagesService } from './messages.service';
import { WebsocketService } from '@/websocket/websocket.service';
import { NotificationsService } from '@/notifications/notifications.service';
import { LinkPreviewsService } from '@/link-previews/link-previews.service';
import { ServerEvents } from '@semaphore-chat/shared';

describe('MessageDispatchService', () => {
  let service: MessageDispatchService;
  let messagesService: Mocked<MessagesService>;
  let websocketService: Mocked<WebsocketService>;
  let notificationsService: Mocked<NotificationsService>;
  let linkPreviewsService: Mocked<LinkPreviewsService>;

  const rawMessage = {
    id: 'msg-1',
    channelId: 'channel-1',
    spans: [{ type: 'PLAINTEXT', text: 'hello' }],
    attachments: [],
  };
  const enrichedMessage = { ...rawMessage, attachments: [] };

  beforeEach(async () => {
    const { unit, unitRef } = await TestBed.solitary(
      MessageDispatchService,
    ).compile();

    service = unit;
    messagesService = unitRef.get(MessagesService);
    websocketService = unitRef.get(WebsocketService);
    notificationsService = unitRef.get(NotificationsService);
    linkPreviewsService = unitRef.get(LinkPreviewsService);

    messagesService.enrichMessageWithFileMetadata.mockReturnValue(
      enrichedMessage as any,
    );
    notificationsService.processMessageForNotifications.mockResolvedValue(
      undefined,
    );
    linkPreviewsService.processMessageLinkPreviews.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('enriches the message before broadcasting it', async () => {
    const callOrder: string[] = [];
    messagesService.enrichMessageWithFileMetadata.mockImplementation((m) => {
      callOrder.push('enrich');
      return { ...(m as any), attachments: [] };
    });
    websocketService.sendToRoom.mockImplementation(() => {
      callOrder.push('sendToRoom');
      return true;
    });

    await service.dispatch(rawMessage as any, {
      room: 'channel-1',
      event: ServerEvents.NEW_MESSAGE,
      notifications: false,
      linkPreviews: false,
    });

    expect(callOrder).toEqual(['enrich', 'sendToRoom']);
  });

  it('broadcasts the enriched message to the given room/event', async () => {
    await service.dispatch(rawMessage as any, {
      room: 'channel-1',
      event: ServerEvents.NEW_MESSAGE,
      notifications: false,
      linkPreviews: false,
    });

    expect(messagesService.enrichMessageWithFileMetadata).toHaveBeenCalledWith(
      rawMessage,
    );
    expect(websocketService.sendToRoom).toHaveBeenCalledWith(
      'channel-1',
      ServerEvents.NEW_MESSAGE,
      { message: enrichedMessage },
    );
  });

  it('broadcasts NEW_DM to the dm room when configured', async () => {
    await service.dispatch(rawMessage as any, {
      room: 'dm:group-1',
      event: ServerEvents.NEW_DM,
      notifications: false,
      linkPreviews: false,
    });

    expect(websocketService.sendToRoom).toHaveBeenCalledWith(
      'dm:group-1',
      ServerEvents.NEW_DM,
      { message: enrichedMessage },
    );
  });

  it('fires notifications when notifications: true', async () => {
    await service.dispatch(rawMessage as any, {
      room: 'channel-1',
      event: ServerEvents.NEW_MESSAGE,
      notifications: true,
      linkPreviews: false,
    });

    expect(
      notificationsService.processMessageForNotifications,
    ).toHaveBeenCalledWith(rawMessage);
  });

  it('skips notifications when notifications: false (webhook path)', async () => {
    await service.dispatch(rawMessage as any, {
      room: 'channel-1',
      event: ServerEvents.NEW_MESSAGE,
      notifications: false,
      linkPreviews: false,
    });

    expect(
      notificationsService.processMessageForNotifications,
    ).not.toHaveBeenCalled();
  });

  it('fires link preview processing when linkPreviews: true, using the dispatch room', async () => {
    await service.dispatch(rawMessage as any, {
      room: 'dm:group-1',
      event: ServerEvents.NEW_DM,
      notifications: false,
      linkPreviews: true,
    });

    expect(linkPreviewsService.processMessageLinkPreviews).toHaveBeenCalledWith(
      rawMessage.id,
      rawMessage.spans,
      'dm:group-1',
      ServerEvents.UPDATE_MESSAGE,
    );
  });

  it('skips link preview processing when linkPreviews: false', async () => {
    await service.dispatch(rawMessage as any, {
      room: 'channel-1',
      event: ServerEvents.NEW_MESSAGE,
      notifications: false,
      linkPreviews: false,
    });

    expect(
      linkPreviewsService.processMessageLinkPreviews,
    ).not.toHaveBeenCalled();
  });

  it('catches and logs a rejected notifications promise without throwing', async () => {
    const error = new Error('notif boom');
    notificationsService.processMessageForNotifications.mockRejectedValue(
      error,
    );
    const errorSpy = jest
      .spyOn(service['logger'], 'error')
      .mockImplementation(() => undefined);

    await expect(
      service.dispatch(rawMessage as any, {
        room: 'channel-1',
        event: ServerEvents.NEW_MESSAGE,
        notifications: true,
        linkPreviews: false,
      }),
    ).resolves.toBeUndefined();

    // Allow the fire-and-forget rejection's .catch() to run.
    await Promise.resolve();
    await Promise.resolve();

    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to process notifications for message',
      error,
    );
  });

  it('catches and logs a rejected link-preview promise without throwing', async () => {
    const error = new Error('preview boom');
    linkPreviewsService.processMessageLinkPreviews.mockRejectedValue(error);
    const errorSpy = jest
      .spyOn(service['logger'], 'error')
      .mockImplementation(() => undefined);

    await expect(
      service.dispatch(rawMessage as any, {
        room: 'channel-1',
        event: ServerEvents.NEW_MESSAGE,
        notifications: false,
        linkPreviews: true,
      }),
    ).resolves.toBeUndefined();

    await Promise.resolve();
    await Promise.resolve();

    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to process link previews',
      error,
    );
  });
});
