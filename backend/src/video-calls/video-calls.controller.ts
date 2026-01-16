import {
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
  Request,
} from '@nestjs/common';
import { VideoCallsService } from './video-calls.service';
import { JwtAuthGuard } from '../users/guards/jwt-auth.guard';

@Controller('video-calls')
@UseGuards(JwtAuthGuard)
export class VideoCallsController {
  constructor(private readonly videoCallsService: VideoCallsService) {}

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.videoCallsService.findOne(id);
  }

  @Get('room/:roomId')
  async findByRoomId(@Param('roomId') roomId: string) {
    return this.videoCallsService.findByRoomId(roomId);
  }

  @Patch(':id/start')
  async startCall(@Param('id') id: string) {
    return this.videoCallsService.startCall(id);
  }

  @Patch(':id/end')
  async endCall(@Param('id') id: string) {
    return this.videoCallsService.endCall(id);
  }

  @Patch(':id/cancel')
  async cancelCall(@Param('id') id: string) {
    return this.videoCallsService.cancelCall(id);
  }
}

