import { NatsClientService } from '@core/transporter/nats-transporter/nats-client.service';
import { TcpClientService } from '@core/transporter/tcp-transporter/tcp-client.service';
import { Body, Controller, Get } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { ApiBearerAuth } from '@nestjs/swagger';
import { AppService } from './app.service';
import { ResponseBuilder } from '@utils/response-builder';
import { NATS_AUTH, NATS_USER } from '@config/nats.config';

@Controller('')
@ApiBearerAuth('access-token')
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly natsClientService: NatsClientService,
    private readonly tcpClientService: TcpClientService,
  ) {}

  @Get('ping')
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  getHealth(): string {
    return this.appService.getHealth();
  }

  @MessagePattern(`${NATS_AUTH}.ping`)
  pingServer(@Body() body: any) {
    return new ResponseBuilder()
      .withData({ msg: 'user-service: pong', data: body })
      .build();
  }

  @Get('ping-nats')
  async pingNats(): Promise<any> {
    return await this.natsClientService.send(`${NATS_USER}.ping`, {
      msg: 'ping',
      queue: NATS_USER,
    });
  }

  @Get('ping-tcp')
  async pingTcp(): Promise<any> {
    // Test for connect user service
    return await this.tcpClientService.send('get_user_detail', {
      id: 1,
      withExtraInfo: true,
    });
  }
}
