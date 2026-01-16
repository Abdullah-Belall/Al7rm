import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VideoCall, CallStatus } from './entities/video-call.entity';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class VideoCallsService {
  constructor(
    @InjectRepository(VideoCall)
    private videoCallsRepository: Repository<VideoCall>,
  ) {}

  async create(data: {
    customerId: string;
    supporterId: string;
    supportRequestId: string;
  }): Promise<VideoCall> {
    const call = this.videoCallsRepository.create({
      ...data,
      roomId: uuidv4(),
      status: CallStatus.INITIATED,
    });

    return this.videoCallsRepository.save(call);
  }

  async findOne(id: string): Promise<VideoCall> {
    const call = await this.videoCallsRepository.findOne({
      where: { id },
      relations: ['customer', 'supporter', 'supportRequest'],
    });

    if (!call) {
      throw new NotFoundException('Video call not found');
    }

    return call;
  }

  async findByRoomId(roomId: string): Promise<VideoCall> {
    const call = await this.videoCallsRepository.findOne({
      where: { roomId },
      relations: ['customer', 'supporter', 'supportRequest'],
    });

    if (!call) {
      throw new NotFoundException('Video call not found');
    }

    return call;
  }

  async startCall(id: string): Promise<VideoCall> {
    const call = await this.findOne(id);
    call.status = CallStatus.ACTIVE;
    call.startedAt = new Date();
    return this.videoCallsRepository.save(call);
  }

  async endCall(id: string): Promise<VideoCall> {
    const call = await this.findOne(id);
    call.status = CallStatus.ENDED;
    call.endedAt = new Date();

    if (call.startedAt) {
      const duration = Math.floor(
        (call.endedAt.getTime() - call.startedAt.getTime()) / 1000,
      );
      call.duration = duration;
    }

    return this.videoCallsRepository.save(call);
  }

  async cancelCall(id: string): Promise<VideoCall> {
    const call = await this.findOne(id);
    call.status = CallStatus.CANCELLED;
    return this.videoCallsRepository.save(call);
  }
}

