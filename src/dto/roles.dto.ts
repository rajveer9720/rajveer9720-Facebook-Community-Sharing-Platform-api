import { Type } from 'class-transformer';
import { IsArray, IsOptional, ValidateNested } from 'class-validator';
import { NonEmptyStringField, OptionalNonEmptyStringField } from '../common/validators/field.decorators';

export class PermissionPairDto {
  @NonEmptyStringField()
  action: string;

  @NonEmptyStringField()
  subject: string;
}

export class CreateRoleDto {
  @NonEmptyStringField()
  name: string;

  @OptionalNonEmptyStringField()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionPairDto)
  permissions: PermissionPairDto[];
}

export class UpdateRoleDto {
  @OptionalNonEmptyStringField()
  name?: string;

  @OptionalNonEmptyStringField()
  description?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionPairDto)
  permissions?: PermissionPairDto[];
}
