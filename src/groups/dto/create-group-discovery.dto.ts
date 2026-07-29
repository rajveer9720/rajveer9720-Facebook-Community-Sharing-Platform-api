import { IsInt, IsString, Min, MinLength } from 'class-validator';

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

  @IsInt()
  @Min(0)
  memberCount: number;
}
