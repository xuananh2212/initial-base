import { ResponseCodeEnum } from '@constant/response-code.enum';
import { InjectConfig } from '@nestcloud/config';
import { Injectable } from '@nestjs/common';
import { ResponseBuilder } from '@utils/response-builder';

@Injectable()
export class AppService {
  constructor(@InjectConfig() private readonly config: any) {}

  getHello(): string {
    return 'Hello World!';
  }

  getHealth(): any {
    return new ResponseBuilder()
      .withCode(ResponseCodeEnum.SUCCESS)
      .withMessage('This is user-service')
      .build();
  }
}
