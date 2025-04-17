import { Test, TestingModule } from '@nestjs/testing';
import { PostgresPrismaService } from './postgres-prisma.service';

describe('PostgresPrismaService', () => {
  let service: PostgresPrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PostgresPrismaService],
    }).compile();

    service = module.get<PostgresPrismaService>(PostgresPrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
