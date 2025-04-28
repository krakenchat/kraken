import { Injectable } from '@nestjs/common';
import { InstanceRole, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class UserService {
  constructor(private database: DatabaseService) {}

  async findByUsername(username: string): Promise<User | null> {
    return this.database.user.findUnique({
      where: { username },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.database.user.findUnique({
      where: { id },
    });
  }

  async createUser(
    username: string,
    password: string,
    email?: string,
  ): Promise<User> {
    const userCount = await this.database.user.count();
    const role = userCount === 0 ? InstanceRole.SUPER_ADMIN : InstanceRole.USER;
    const verified = userCount === 0;
    const hashedPassword = await bcrypt.hash(password, 10);

    return this.database.user.create({
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
