import { IsEmail, IsInt, IsOptional } from 'class-validator';
import { EmailField, NonEmptyStringField, OptionalNonEmptyStringField } from '../common/validators/field.decorators';

export class CreateStaffDto {
  @EmailField()
  email: string;

  @NonEmptyStringField()
  firstName: string;

  @NonEmptyStringField()
  lastName: string;

  @IsInt()
  roleId: number;
}

export class UpdateStaffDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @OptionalNonEmptyStringField()
  firstName?: string;

  @OptionalNonEmptyStringField()
  lastName?: string;

  @IsOptional()
  @IsInt()
  roleId?: number;
}
