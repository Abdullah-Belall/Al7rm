import { DataSource, DataSourceOptions } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { SupportRequest } from '../support-requests/entities/support-request.entity';
import { VideoCall } from '../video-calls/entities/video-call.entity';

export const typeOrmConfig: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'al7ram_support',
  entities: [User, SupportRequest, VideoCall],
  synchronize: process.env.NODE_ENV !== 'production',
  logging: process.env.NODE_ENV === 'development',
  migrations: ['dist/migrations/*.js'],
  migrationsTableName: 'migrations',
};

export const AppDataSource = new DataSource(typeOrmConfig);
