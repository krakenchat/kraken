import { Injectable } from '@nestjs/common';
import { UserService } from '../user/user.service';
import * as bcrypt from 'bcrypt';
import { User } from '@prisma/postgres-client';

@Injectable()
export class AuthService {
  constructor(private readonly userService: UserService) {}

  async validateUser(
    username: string,
    pass: string,
  ): Promise<Omit<User, 'hashedPassword'> | null> {
    const user = await this.userService.findByUsername(username);
    if (user && (await bcrypt.compare(pass, user.hashedPassword))) {
      // Exclude password hash from returned object
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { hashedPassword, ...result } = user;
      return result;
    }

    return null;
  }
}
