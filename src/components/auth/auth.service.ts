import { isEmpty } from 'lodash';
import { LoginSucessfullyResponseDto } from './dto/response/login-sucessfully-response.dto';
import { plainToClass } from 'class-transformer';
import { ResponseBuilder } from '@utils/response-builder';
import {
  jwtConstants,
  SUPER_ADMIN,
  VerifyLicenseTypeEnum,
} from '../../constant/common';
import { ResponseCodeEnum } from '@constant/response-code.enum';
import { ApiError } from '@utils/api.error';
import { CACHE_MANAGER, Inject, Injectable } from '@nestjs/common';
import { AuthServiceInterface } from '@components/auth/interface/auth.service.interface';
import { ResponsePayload } from '@utils/response-payload';
import { LoginRequestDto } from './dto/request/login-request.dto';
import { JwtService } from '@nestjs/jwt';
import { UserRepositoryInterface } from '@components/user/interface/user.repository.interface';
import { UserServiceInterface } from '@components/user/interface/user.service.interface';
import { RememberPassword } from '@utils/common';
import { I18nService } from 'nestjs-i18n';
import { REQUEST } from '@nestjs/core';
import { FinalCheckUserPermissionRequestDto } from './dto/request/final-check-user-permission.request.dto';
import { UserRoleServiceInterface } from '../user-role/interface/user-role.service.interface';
import { ConfigService } from '@config/config.service';
import { UserEntity } from '@entities/user/user.entity';
import { Cache } from 'cache-manager';
import { VerifyLicenseRequestDto } from './dto/request/verify-license.request.dto';
import { UserStatusEnum } from '@components/user/user.contant';
import { ErrorMessageEnum } from '@constant/error-message.enum';

@Injectable()
export class AuthService implements AuthServiceInterface {
  constructor(
    @Inject('UserRepositoryInterface')
    private readonly userRepository: UserRepositoryInterface,

    @Inject('UserServiceInterface')
    private readonly userService: UserServiceInterface,

    @Inject('UserRoleServiceInterface')
    private readonly userRoleService: UserRoleServiceInterface,

    private readonly jwtService: JwtService,

    private readonly i18n: I18nService,

    @Inject('ConfigServiceInterface')
    private readonly configService: ConfigService,

    @Inject(REQUEST) private request: any,

    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  /**
   *
   * @param payload
   * @returns
   */
  async validateToken(payload: any): Promise<any> {
    const { permissionCode, jwt } = payload;
    if (this.isInternalCall(jwt))
      return new ResponseBuilder({}).withCode(ResponseCodeEnum.SUCCESS).build();

    try {
      this.jwtService.verify(jwt);
      const jwtDecode: any = this.jwtService.decode(jwt);
      // const userDataCacheKey = genCacheKey(`_USER_TOKEN_PERMISSION_${jwtDecode?.id}`);
      // let userData: any = await this.cacheManager.get(userDataCacheKey);

      // if (isEmpty(userData)) {
      const userData = await this.userRepository.findOneById(jwtDecode?.id);

      if (isEmpty(userData)) {
        return new ApiError(ResponseCodeEnum.UNAUTHORIZED).toResponse();
      }

      if (this.isSuperAdmin(userData)) {
        return new ResponseBuilder(userData)
          .withCode(ResponseCodeEnum.SUCCESS)
          .build();
      }

      const userId = jwtDecode?.id;
      if (permissionCode && !this.isSuperAdmin(userData)) {
        const checkPermissionCondition =
          new FinalCheckUserPermissionRequestDto();
        checkPermissionCondition.userId = userId;
        checkPermissionCondition.permissionCode = permissionCode;

        const response = await this.userRoleService.finalCheckUserPermission(
          checkPermissionCondition,
        );
        if (response.statusCode !== ResponseCodeEnum.SUCCESS) {
          return new ApiError(
            ResponseCodeEnum.NOT_ACCEPTABLE,
            await this.i18n.translate('error.NOT_ACCEPTABLE'),
          ).toResponse();
        }
      }
      // this.cacheManager.set(userDataCacheKey, userData, {
      //   ttl: 10,
      // });
      // }

      return new ResponseBuilder(userData)
        .withCode(ResponseCodeEnum.SUCCESS)
        .build();
    } catch (error) {
      console.log('======', error);

      if (error.constructor.name === 'TokenExpiredError') {
        return new ApiError(
          ResponseCodeEnum.TOKEN_EXPIRED,
          error.message,
        ).toResponse();
      }
      return new ApiError(
        ResponseCodeEnum.UNAUTHORIZED,
        error.message,
      ).toResponse();
    }
  }

  async refreshToken(payload: any): Promise<any> {
    const jwt = this.request.headers['authorization']?.split(' ')[1];

    try {
      this.jwtService.verify(jwt);

      const jwtDecode: any = this.jwtService.decode(jwt);

      const user = await this.userRepository.findOneById(jwtDecode.id);
      if (isEmpty(user)) {
        return new ApiError(ResponseCodeEnum.UNAUTHORIZED).toResponse();
      }

      const accessToken = this._createToken(user.id, user.code, user.username);

      const refreshToken = this._createRefreshToken(
        user.id,
        payload.rememberPassword,
      );

      const userData = await this.userService.getDetail(user.id);
      const response = plainToClass(
        LoginSucessfullyResponseDto,
        {
          userInfo: userData,
          accessToken: accessToken,
          refreshToken: refreshToken,
          rememberPassword: payload.rememberPassword,
        },
        {
          excludeExtraneousValues: true,
        },
      );
      return new ResponseBuilder(response)
        .withCode(ResponseCodeEnum.SUCCESS)
        .build();
    } catch (error) {
      if (error.constructor.name === 'TokenExpiredError') {
        return new ApiError(
          ResponseCodeEnum.TOKEN_EXPIRED,
          error.message,
        ).toResponse();
      }
      return new ApiError(
        ResponseCodeEnum.UNAUTHORIZED,
        error.message,
      ).toResponse();
    }
  }

  public async login(payload: LoginRequestDto): Promise<ResponsePayload<any>> {
    const { username, password } = payload;
    const user = await this.userRepository.validateUser(username, password);

    if (user) {
      return new ApiError(
        ResponseCodeEnum.UNAUTHORIZED,
        await this.i18n.translate('error.WRONG_USERNAME_PASSWORD'),
      ).toResponse();
    }
    // const userData = await this.userService.getDetail(user.id);

    // if (userData.status !== UserStatusEnum.ACTIVE) {
    //   return new ApiError(
    //     ResponseCodeEnum.UNAUTHORIZED,
    //     await this.i18n.translate('error.INVALID_USER_STATUS'),
    //   ).toResponse();
    // }

    const accessToken = this._createToken(user?.id, user?.code, user?.username);

    const refreshToken = this._createRefreshToken(user.id);

    const response = plainToClass(
      LoginSucessfullyResponseDto,
      {
        // userInfo: userData,
        accessToken: accessToken,
        refreshToken: refreshToken,
      },
      {
        excludeExtraneousValues: true,
      },
    );
    return new ResponseBuilder(response)
      .withCode(ResponseCodeEnum.SUCCESS)
      .build();
  }

  _createToken(id: number, code: string, username: string): any {
    const expiresIn = jwtConstants.acessTokenExpiresIn || 60;

    const token = this.jwtService.sign(
      {
        id: id,
        code: code,
        username: username,
      },
      {
        expiresIn: `${expiresIn}s`,
      },
    );
    return token;
  }

  _createRefreshToken(id: number, rememberPassword?: number) {
    const expiresIn = jwtConstants.refeshTokenExpiresIn || 60;

    const token = this.jwtService.sign(
      {
        id: id,
      },
      {
        expiresIn: `${expiresIn}s`,
      },
    );
    return token;
  }

  private isInternalCall(token) {
    return token === this.configService.get('INTERNAL_TOKEN');
  }

  private isSuperAdmin(user: UserEntity): boolean {
    return user.code === SUPER_ADMIN.code;
  }

  public async verifyLicense(payload: VerifyLicenseRequestDto): Promise<any> {
    const { type, value } = payload;

    // map type to field
    const field = {
      [VerifyLicenseTypeEnum.PHONE]: 'phone',
      [VerifyLicenseTypeEnum.EMAIL]: 'email',
      [VerifyLicenseTypeEnum.USERNAME]: 'username',
    }[type];

    // find user by field
    const user = await this.userRepository.findOneByCondition({
      [field]: value,
    });

    if(!user) {
      return new ApiError(
        ResponseCodeEnum.UNAUTHORIZED,
        await this.i18n.translate('error.USER_NOT_FOUND'),
      ).toResponse();
    }

    if(user.status === UserStatusEnum.BLOCKED) {
      return new ApiError(
        ResponseCodeEnum.UNAUTHORIZED,
        await this.i18n.translate('error.USER_BLOCKED'),
      ).toResponse();
    }
  }
}
