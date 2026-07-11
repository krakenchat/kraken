import { ConfigService } from '@nestjs/config';
import { MailerService } from './mailer.service';

const sendMailMock = jest.fn().mockResolvedValue(undefined);
const createTransportMock = jest.fn(() => ({ sendMail: sendMailMock }));

jest.mock('nodemailer', () => ({
  createTransport: (...args: unknown[]) =>
    (createTransportMock as (...args: unknown[]) => unknown)(...args),
}));

describe('MailerService', () => {
  const mockConfigService = (
    overrides: Record<string, string | undefined> = {},
  ) => {
    const defaults: Record<string, string | undefined> = {
      SMTP_HOST: 'smtp.example.com',
      SMTP_FROM: 'noreply@example.com',
      PUBLIC_APP_URL: 'https://chat.example.com',
    };
    const merged = { ...defaults, ...overrides };
    return {
      get: jest.fn((key: string) => merged[key]),
    } as unknown as ConfigService;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    sendMailMock.mockResolvedValue(undefined);
  });

  describe('isEnabled', () => {
    it('is true when SMTP_HOST, SMTP_FROM, and PUBLIC_APP_URL are all set', () => {
      const service = new MailerService(mockConfigService());
      expect(service.isEnabled).toBe(true);
    });

    it('is false when SMTP_HOST is missing', () => {
      const service = new MailerService(
        mockConfigService({ SMTP_HOST: undefined }),
      );
      expect(service.isEnabled).toBe(false);
    });

    it('is false when SMTP_FROM is missing', () => {
      const service = new MailerService(
        mockConfigService({ SMTP_FROM: undefined }),
      );
      expect(service.isEnabled).toBe(false);
    });

    it('is false when PUBLIC_APP_URL is missing', () => {
      const service = new MailerService(
        mockConfigService({ PUBLIC_APP_URL: undefined }),
      );
      expect(service.isEnabled).toBe(false);
    });

    it('is false when nothing is configured', () => {
      const service = new MailerService(
        mockConfigService({
          SMTP_HOST: undefined,
          SMTP_FROM: undefined,
          PUBLIC_APP_URL: undefined,
        }),
      );
      expect(service.isEnabled).toBe(false);
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('sends mail with the correct to/from/subject/link when enabled', async () => {
      const service = new MailerService(mockConfigService());

      await service.sendPasswordResetEmail(
        'user@example.com',
        'https://chat.example.com/reset-password?token=abc123',
      );

      expect(sendMailMock).toHaveBeenCalledTimes(1);
      const call = sendMailMock.mock.calls[0][0] as {
        from: string;
        to: string;
        subject: string;
        text: string;
        html: string;
      };
      expect(call.from).toBe('noreply@example.com');
      expect(call.to).toBe('user@example.com');
      expect(call.subject).toBe('Reset your Semaphore Chat password');
      expect(call.text).toContain(
        'https://chat.example.com/reset-password?token=abc123',
      );
      expect(call.html).toContain(
        'https://chat.example.com/reset-password?token=abc123',
      );
    });

    it('builds the transport lazily and only once across multiple sends', async () => {
      const service = new MailerService(mockConfigService());

      await service.sendPasswordResetEmail('a@example.com', 'https://x/1');
      await service.sendPasswordResetEmail('b@example.com', 'https://x/2');

      expect(createTransportMock).toHaveBeenCalledTimes(1);
      expect(sendMailMock).toHaveBeenCalledTimes(2);
    });

    it('passes host/port/secure/auth to the transport', async () => {
      const service = new MailerService(
        mockConfigService({
          SMTP_PORT: '465',
          SMTP_SECURE: 'true',
          SMTP_USER: 'smtp-user',
          SMTP_PASS: 'smtp-pass',
        }),
      );

      await service.sendPasswordResetEmail('user@example.com', 'https://x');

      expect(createTransportMock).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'smtp.example.com',
          port: 465,
          secure: true,
          auth: { user: 'smtp-user', pass: 'smtp-pass' },
        }),
      );
    });

    it('defaults port to 587 and omits auth when SMTP_USER/SMTP_PASS are unset', async () => {
      const service = new MailerService(mockConfigService());

      await service.sendPasswordResetEmail('user@example.com', 'https://x');

      expect(createTransportMock).toHaveBeenCalledWith(
        expect.objectContaining({
          port: 587,
          secure: false,
          auth: undefined,
        }),
      );
    });

    it('no-ops (logs a warning) and does not build a transport when disabled', async () => {
      const service = new MailerService(
        mockConfigService({ SMTP_HOST: undefined }),
      );

      await service.sendPasswordResetEmail('user@example.com', 'https://x');

      expect(createTransportMock).not.toHaveBeenCalled();
      expect(sendMailMock).not.toHaveBeenCalled();
    });
  });
});
