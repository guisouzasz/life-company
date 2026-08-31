import { Module } from '@nestjs/common';
import { LogsController } from './logs.controller';
import { LogsService } from './logs.service';
import { LogsInterceptor } from './logs.interceptor';

@Module({
  controllers: [LogsController],
  providers: [LogsService, LogsInterceptor],
  exports: [LogsService, LogsInterceptor],
})
export class LogsModule {}
