import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { SupportRequestsModule } from './support-requests/support-requests.module';
import { VideoCallsModule } from './video-calls/video-calls.module';
import { typeOrmConfig } from './config/typeorm.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot(typeOrmConfig),
    UsersModule,
    SupportRequestsModule,
    VideoCallsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

