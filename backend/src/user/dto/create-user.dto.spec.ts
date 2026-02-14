import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateUserDto } from './create-user.dto';

describe('CreateUserDto', () => {
  function createDto(partial: Partial<CreateUserDto>): CreateUserDto {
    return plainToInstance(CreateUserDto, partial);
  }

  it('should pass validation with valid fields', async () => {
    const dto = createDto({
      code: 'invite-code',
      username: 'testuser',
      password: 'mypassword123',
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should fail when username is shorter than 2 characters', async () => {
    const dto = createDto({
      code: 'invite-code',
      username: 'a',
      password: 'mypassword123',
    });

    const errors = await validate(dto);
    const usernameError = errors.find((e) => e.property === 'username');
    expect(usernameError).toBeDefined();
    expect(usernameError!.constraints).toBeDefined();
    expect(Object.values(usernameError!.constraints!)).toContain(
      'Username must be at least 2 characters',
    );
  });

  it('should fail when username is longer than 32 characters', async () => {
    const dto = createDto({
      code: 'invite-code',
      username: 'a'.repeat(33),
      password: 'mypassword123',
    });

    const errors = await validate(dto);
    const usernameError = errors.find((e) => e.property === 'username');
    expect(usernameError).toBeDefined();
    expect(usernameError!.constraints).toBeDefined();
    expect(Object.values(usernameError!.constraints!)).toContain(
      'Username must be at most 32 characters',
    );
  });

  it('should fail when password is shorter than 8 characters', async () => {
    const dto = createDto({
      code: 'invite-code',
      username: 'testuser',
      password: 'short12',
    });

    const errors = await validate(dto);
    const passwordError = errors.find((e) => e.property === 'password');
    expect(passwordError).toBeDefined();
    expect(passwordError!.constraints).toBeDefined();
    expect(Object.values(passwordError!.constraints!)).toContain(
      'Password must be at least 8 characters',
    );
  });

  it('should fail when password is longer than 128 characters', async () => {
    const dto = createDto({
      code: 'invite-code',
      username: 'testuser',
      password: 'a'.repeat(129),
    });

    const errors = await validate(dto);
    const passwordError = errors.find((e) => e.property === 'password');
    expect(passwordError).toBeDefined();
    expect(passwordError!.constraints).toBeDefined();
    expect(Object.values(passwordError!.constraints!)).toContain(
      'Password must be at most 128 characters',
    );
  });

  it('should pass validation with a valid email', async () => {
    const dto = createDto({
      code: 'invite-code',
      username: 'testuser',
      password: 'mypassword123',
      email: 'user@example.com',
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should fail when email is invalid', async () => {
    const dto = createDto({
      code: 'invite-code',
      username: 'testuser',
      password: 'mypassword123',
      email: 'not-an-email',
    });

    const errors = await validate(dto);
    const emailError = errors.find((e) => e.property === 'email');
    expect(emailError).toBeDefined();
    expect(emailError!.constraints).toBeDefined();
    expect(Object.keys(emailError!.constraints!)).toContain('isEmail');
  });
});
