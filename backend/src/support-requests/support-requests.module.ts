import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupportRequestsService } from './support-requests.service';
import { SupportRequestsController } from './support-requests.controller';
import { SupportRequest } from './entities/support-request.entity';
import { UsersModule } from '../users/users.module';
import { VideoCallsModule } from '../video-calls/video-calls.module';
import { SupportRequestsGateway } from './support-requests.gateway';

@Module({
  imports: [
    TypeOrmModule.forFeature([SupportRequest]),
    UsersModule,
    VideoCallsModule,
  ],
  controllers: [SupportRequestsController],
  providers: [SupportRequestsService, SupportRequestsGateway],
  exports: [SupportRequestsService],
})
export class SupportRequestsModule {}

