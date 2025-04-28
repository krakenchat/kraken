import { Injectable } from '@nestjs/common';
import { UserService } from '../user/user.service';
import * as bcrypt from 'bcrypt';
import { UserEntity } from 'src/user/dto/user-response.dto';

@Injectable()
export class AuthService {
  constructor(private readonly userService: UserService) {}

  async validateUser(
    username: string,
    pass: string,
  ): Promise<UserEntity | null> {
    const user = await this.userService.findByUsername(username);
    if (user && (await bcrypt.compare(pass, user.hashedPassword))) {
      // Exclude password hash from returned object
      return user;
    }

    return null;
  }
}
