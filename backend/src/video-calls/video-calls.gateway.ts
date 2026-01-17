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
import { FRONTEND_URL } from 'src/base';

@WebSocketGateway({
  cors: {
    origin: FRONTEND_URL,
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
      console.log(`[Join Room] User ${data.userId} joining room ${data.roomId}, Client: ${client.id}`);
      const call = await this.videoCallsService.findByRoomId(data.roomId);

      // Verify user is part of the call
      if (
        call.customerId !== data.userId &&
        call.supporterId !== data.userId
      ) {
        console.log(`[Join Room] Unauthorized: User ${data.userId} not part of call`);
        client.emit('error', { message: 'Unauthorized' });
        return;
      }

      client.join(data.roomId);
      console.log(`[Join Room] Client ${client.id} joined room ${data.roomId}`);
      
      // Get room info before emitting
      const room = this.server.sockets.adapter.rooms.get(data.roomId);
      console.log(`[Join Room] Room ${data.roomId} now has ${room?.size || 0} users`);
      
      // Notify other users in the room
      client.to(data.roomId).emit('user-joined', { userId: data.userId });
      console.log(`[Join Room] Emitted user-joined event for user ${data.userId}`);

      // If both users are in the room, start the call
      if (room && room.size >= 2) {
        console.log(`[Join Room] Both users in room, starting call`);
        await this.videoCallsService.startCall(call.id);
        this.server.to(data.roomId).emit('call-started', { callId: call.id });
      }
    } catch (error) {
      console.error(`[Join Room] Error:`, error);
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
    console.log(`[Offer] Room: ${data.roomId}, Client: ${client.id}`);
    const room = this.server.sockets.adapter.rooms.get(data.roomId);
    console.log(`[Offer] Room size: ${room?.size || 0}`);
    client.to(data.roomId).emit('offer', data.offer);
    console.log(`[Offer] Sent to room: ${data.roomId}`);
  }

  @SubscribeMessage('answer')
  handleAnswer(
    @MessageBody() data: { roomId: string; answer: any },
    @ConnectedSocket() client: Socket,
  ) {
    console.log(`[Answer] Room: ${data.roomId}, Client: ${client.id}`);
    const room = this.server.sockets.adapter.rooms.get(data.roomId);
    console.log(`[Answer] Room size: ${room?.size || 0}`);
    client.to(data.roomId).emit('answer', data.answer);
    console.log(`[Answer] Sent to room: ${data.roomId}`);
  }

  @SubscribeMessage('ice-candidate')
  handleIceCandidate(
    @MessageBody() data: { roomId: string; candidate: any },
    @ConnectedSocket() client: Socket,
  ) {
    console.log(`[ICE] Room: ${data.roomId}, Client: ${client.id}, Candidate: ${data.candidate?.candidate?.substring(0, 50) || 'null'}`);
    client.to(data.roomId).emit('ice-candidate', data.candidate);
  }
}

