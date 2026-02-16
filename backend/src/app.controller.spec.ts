import { TestBed } from '@suites/unit';
import type { Mocked } from '@suites/doubles.jest';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;
  let appService: Mocked<AppService>;

  beforeEach(async () => {
    const { unit, unitRef } = await TestBed.solitary(AppController).compile();
    appController = unit;
    appService = unitRef.get(AppService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      appService.getHello.mockReturnValue('Hello World!');

      expect(appController.getHello()).toBe('Hello World!');
    });
  });
});
