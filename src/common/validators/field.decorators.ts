import { applyDecorators } from '@nestjs/common';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export function EmailField() {
  return applyDecorators(IsEmail());
}

export function NonEmptyStringField() {
  return applyDecorators(IsString(), MinLength(1));
}

export function OptionalNonEmptyStringField() {
  return applyDecorators(IsOptional(), IsString(), MinLength(1));
}

export function PasswordField() {
  return applyDecorators(IsString(), MinLength(8));
}