import { Test, TestingModule } from '@nestjs/testing';
import { MongoPrismaService } from './mongo-prisma.service';

describe('MongoPrismaService', () => {
  let service: MongoPrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MongoPrismaService],
    }).compile();

    service = module.get<MongoPrismaService>(MongoPrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
