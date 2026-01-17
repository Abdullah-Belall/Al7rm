import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { FRONTEND_URL } from 'src/base';

@WebSocketGateway({
  namespace: '/support-requests',
  cors: {
    origin: FRONTEND_URL,
    credentials: true,
  },
})
export class SupportRequestsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    console.log(`Support Requests client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Support Requests client disconnected: ${client.id}`);
  }

  // Emit to all connected clients
  emitToAll(event: string, data: any) {
    this.server.emit(event, data);
  }

  // Emit to specific user (customer or supporter)
  emitToUser(userId: string, event: string, data: any) {
    this.server.emit(event, data);
  }

  // Notify supporters about new request
  notifyNewRequest(request: any) {
    this.server.emit('new-support-request', request);
  }

  // Notify customer about request update
  notifyRequestUpdate(request: any) {
    this.server.emit('support-request-updated', request);
  }
}

