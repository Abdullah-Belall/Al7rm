import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { VideoCallsService } from './video-calls.service';
import { UseGuards } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
})
export class VideoCallsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(private videoCallsService: VideoCallsService) {}

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join-room')
  async handleJoinRoom(
    @MessageBody() data: { roomId: string; userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const call = await this.videoCallsService.findByRoomId(data.roomId);

      // Verify user is part of the call
      if (
        call.customerId !== data.userId &&
        call.supporterId !== data.userId
      ) {
        client.emit('error', { message: 'Unauthorized' });
        return;
      }

      client.join(data.roomId);
      client.to(data.roomId).emit('user-joined', { userId: data.userId });

      // If both users are in the room, start the call
      const room = this.server.sockets.adapter.rooms.get(data.roomId);
      if (room && room.size === 2) {
        await this.videoCallsService.startCall(call.id);
        this.server.to(data.roomId).emit('call-started', { callId: call.id });
      }
    } catch (error) {
      client.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('leave-room')
  async handleLeaveRoom(
    @MessageBody() data: { roomId: string; userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const call = await this.videoCallsService.findByRoomId(data.roomId);
      client.leave(data.roomId);
      client.to(data.roomId).emit('user-left', { userId: data.userId });

      // End call if user leaves
      await this.videoCallsService.endCall(call.id);
      this.server.to(data.roomId).emit('call-ended', { callId: call.id });
    } catch (error) {
      client.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('offer')
  handleOffer(
    @MessageBody() data: { roomId: string; offer: any },
    @ConnectedSocket() client: Socket,
  ) {
    client.to(data.roomId).emit('offer', data.offer);
  }

  @SubscribeMessage('answer')
  handleAnswer(
    @MessageBody() data: { roomId: string; answer: any },
    @ConnectedSocket() client: Socket,
  ) {
    client.to(data.roomId).emit('answer', data.answer);
  }

  @SubscribeMessage('ice-candidate')
  handleIceCandidate(
    @MessageBody() data: { roomId: string; candidate: any },
    @ConnectedSocket() client: Socket,
  ) {
    client.to(data.roomId).emit('ice-candidate', data.candidate);
  }
}

