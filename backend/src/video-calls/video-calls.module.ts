import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VideoCallsService } from './video-calls.service';
import { VideoCallsController } from './video-calls.controller';
import { VideoCall } from './entities/video-call.entity';
import { VideoCallsGateway } from './video-calls.gateway';

@Module({
  imports: [TypeOrmModule.forFeature([VideoCall])],
  controllers: [VideoCallsController],
  providers: [VideoCallsService, VideoCallsGateway],
  exports: [VideoCallsService],
})
export class VideoCallsModule {}

