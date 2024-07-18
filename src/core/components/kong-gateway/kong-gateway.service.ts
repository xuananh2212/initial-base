import { Boot, InjectBoot } from '@nestcloud/boot';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { KongGatewayServiceInterface } from './interface/kong-gateway.service.interface';
import { HttpService } from '@nestjs/axios';
import { catchError, firstValueFrom, map, of, retry } from 'rxjs';
import { genericRetryStrategy } from '@utils/rxjs-util';

@Injectable()
export class KongGatewayService
  implements KongGatewayServiceInterface, OnApplicationBootstrap
{
  private host: string;
  private port: string;
  private secretToken: string;
  private upstreamName: string;
  private servicePort: string;
  private dns: string;
  private serviceName: string;
  private apiPath: string;
  private readonly logger = new Logger(KongGatewayService.name);

  constructor(
    @InjectBoot() private readonly boot: Boot,
    private httpClientService: HttpService,
  ) {
    this.host = this.boot.get('kong.host') || 'localhost';
    this.port = this.boot.get('kong.port') || '8001';
    this.servicePort = this.boot.get('service.port') || '3001';
    this.secretToken = this.boot.get('kong.secretToken') || '';
    this.upstreamName = this.boot.get('kong.upstream.name') || '';
    this.apiPath = this.boot.get('service.apiPath') || '';
    this.serviceName = this.boot.get('service.name') || '';
    this.dns = `${this.boot.get('service.name') || ''}.service.consul`;
  }

  async onApplicationBootstrap() {
    this.init();
  }

  async init(): Promise<any> {
    await this.createOrUpdateService();
    await this.createOrUpdateRoute();
  }

  async createOrUpdateService(): Promise<any> {
    let service = await firstValueFrom(
      this.httpClientService
        .get(
          `${this.host}:${this.port}/services/${this.upstreamName}?key-auth=${this.secretToken}`,
        )
        .pipe(
          map((response) => response.data),
          catchError((error) => of(error)),
        ),
    );
    if (!service.id) {
      service = await firstValueFrom(
        this.httpClientService
          .put(
            `${this.host}:${this.port}/services/${this.upstreamName}?key-auth=${this.secretToken}`,
            {
              name: this.upstreamName,
              protocol: 'http',
              host: this.dns,
              port: parseInt(this.servicePort),
              path: '/',
            },
          )
          .pipe(
            map((response) => response.data),
            retry(
              genericRetryStrategy({
                scalingDuration: 1000,
                excludedStatusCodes: [409],
              }),
            ),
            catchError((error) => of(error)),
          ),
      );
    }
    this.logger.log(`KONG SERVICE: ${service?.id} registered!`);
  }

  async createOrUpdateRoute(): Promise<any> {
    let route = await firstValueFrom(
      this.httpClientService
        .get(
          `${this.host}:${this.port}/routes/${this.upstreamName}?key-auth=${this.secretToken}`,
        )
        .pipe(
          map((response) => response.data),
          catchError((error) => of(error)),
        ),
    );
    if (!route.id) {
      route = await firstValueFrom(
        this.httpClientService
          .put(
            `${this.host}:${this.port}/services/${this.upstreamName}/routes/${this.serviceName}?key-auth=${this.secretToken}`,
            {
              name: this.serviceName,
              protocols: ['http', 'https'],
              paths: [this.apiPath],
              strip_path: false,
            },
          )
          .pipe(
            map((response) => response.data),
            retry(
              genericRetryStrategy({
                scalingDuration: 1000,
                excludedStatusCodes: [409],
              }),
            ),
            catchError((error) => of(error)),
          ),
      );
    }
    this.logger.log(`KONG ROUTE: ${route?.id} registered!`);
  }
}
