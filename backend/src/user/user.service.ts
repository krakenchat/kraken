import { Injectable } from '@nestjs/common';
import { InstanceRole, User } from '@prisma/postgres-client';
import * as bcrypt from 'bcrypt';
import { PostgresPrismaService } from 'src/database/postgres-prisma.service';

@Injectable()
export class UserService {
  constructor(private prisma: PostgresPrismaService) {}

  async findByUsername(username: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { username },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async createUser(
    username: string,
    password: string,
    email?: string,
  ): Promise<User> {
    const userCount = await this.prisma.user.count();
    const role = userCount === 0 ? InstanceRole.SUPER_ADMIN : InstanceRole.USER;
    const verified = userCount === 0;
    const hashedPassword = await bcrypt.hash(password, 10);

    return this.prisma.user.create({
      data: {
        username,
        email,
        hashedPassword,
        verified,
        role,
      },
    });
  }
}
