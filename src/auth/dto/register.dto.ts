import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { Role } from '../../common/enums/role.enum';

export class RegisterDto {
  @ApiProperty({ example: 'Ada' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Lovelace' })
  @IsString()
  lastName: string;

  @ApiProperty({ example: 'ada@hillspace.test' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '+2348012345678' })
  @IsString()
  phone: string;

  @ApiProperty({ example: 'password123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ enum: Role, example: Role.BUYER })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
