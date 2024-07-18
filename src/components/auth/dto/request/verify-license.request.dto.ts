import { VerifyLicenseTypeEnum } from '@constant/common';
import { BaseDto } from './../../../../core/dto/base.dto';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber } from 'class-validator';
export class VerifyLicenseRequestDto extends BaseDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  @IsEnum(VerifyLicenseTypeEnum)
  type: VerifyLicenseTypeEnum;

  @ApiProperty( { description: 'phone or email or username'})
  value: string;
}
