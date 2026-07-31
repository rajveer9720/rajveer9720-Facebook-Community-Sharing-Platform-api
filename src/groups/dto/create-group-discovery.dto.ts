import { IsInt, IsIn, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateGroupDiscoveryDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @MinLength(1)
  category: string;

  @IsString()
  @MinLength(1)
  country: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  url?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  language?: string;

  @IsOptional()
  @IsString()
  @IsIn(['PUBLIC', 'PRIVATE', 'MIXED'])
  privacyType?: string;

  @IsInt()
  @Min(0)
  memberCount: number;
}
