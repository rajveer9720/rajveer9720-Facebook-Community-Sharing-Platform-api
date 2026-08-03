import { EmailField, NonEmptyStringField, PasswordField } from '../common/validators/field.decorators';

export class LoginDto {
  @EmailField()
  email: string;

  @NonEmptyStringField()
  password: string;
}

export class RegisterDto {
  @EmailField()
  email: string;

  @NonEmptyStringField()
  firstName: string;

  @NonEmptyStringField()
  lastName: string;

  @PasswordField()
  password: string;
}

export class RefreshTokenDto {
  @NonEmptyStringField()
  refreshToken: string;
}

export class ForgotPasswordDto {
  @EmailField()
  email: string;
}

export class ResetPasswordDto {
  @NonEmptyStringField()
  resetToken: string;

  @PasswordField()
  newPassword: string;
}
