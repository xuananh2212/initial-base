import { AuthServiceInterface } from './interface/auth.service.interface';
import { LoginRequestDto } from './dto/request/login-request.dto';
import { MessagePattern } from '@nestjs/microservices';
import {
  Controller,
  Body,
  Inject,
  Post,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import { isEmpty } from 'lodash';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { LoginSucessfullyResponseDto } from './dto/response/login-sucessfully-response.dto';
import { VerifyLicenseRequestDto } from './dto/request/verify-license.request.dto';
import { NATS_AUTH } from '@config/nats.config';

@Controller('')
export class AuthController {
  constructor(
    @Inject('AuthServiceInterface')
    private readonly authService: AuthServiceInterface,
  ) {}

  @Post('/verify-license')
  public async verifyLicense(
    @Body() payload: VerifyLicenseRequestDto,
  ): Promise<any> {
    const { request, responseError } = payload;
    if (responseError && !isEmpty(responseError)) {
      return responseError;
    }

    return await this.authService.verifyLicense(request);
  }

  @MessagePattern(`${NATS_AUTH}.login`)
  @Post('/login')
  @ApiOperation({
    tags: ['Auth', 'Login'],
    summary: 'Login',
    description: 'Đăng nhập',
  })
  @ApiResponse({
    status: 200,
    description: 'Create successfully',
    type: LoginSucessfullyResponseDto,
  })
  public async getItems(@Body() payload: LoginRequestDto): Promise<any> {
    const { request, responseError } = payload;
    if (responseError && !isEmpty(responseError)) {
      return responseError;
    }

    return await this.authService.login(request);
  }

  @MessagePattern(`${NATS_AUTH}.validate_token`)
  public async validateToken(@Body() payload: any): Promise<any> {
    return await this.authService.validateToken({
      ...payload,
      jwt: payload?.token?.split(' ')[1],
    });
  }

  @Get('/token/refresh')
  @MessagePattern(`${NATS_AUTH}.refresh_token`)
  public async refreshToken(@Param() payload: any): Promise<any> {
    return await this.authService.refreshToken(payload);
  }
}
