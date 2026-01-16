import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToOne,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { SupportRequest } from '../../support-requests/entities/support-request.entity';

export enum CallStatus {
  INITIATED = 'initiated',
  RINGING = 'ringing',
  ACTIVE = 'active',
  ENDED = 'ended',
  CANCELLED = 'cancelled',
}

@Entity('video_calls')
export class VideoCall {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  customerId: string;

  @ManyToOne(() => User, (user) => user.customerCalls)
  @JoinColumn({ name: 'customerId' })
  customer: User;

  @Column({ type: 'uuid' })
  supporterId: string;

  @ManyToOne(() => User, (user) => user.supporterCalls)
  @JoinColumn({ name: 'supporterId' })
  supporter: User;

  @Column({ type: 'uuid', unique: true })
  supportRequestId: string;

  @OneToOne(() => SupportRequest, (request) => request.videoCall)
  @JoinColumn({ name: 'supportRequestId' })
  supportRequest: SupportRequest;

  @Column({
    type: 'enum',
    enum: CallStatus,
    default: CallStatus.INITIATED,
  })
  status: CallStatus;

  @Column({ type: 'varchar', unique: true })
  roomId: string;

  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  endedAt: Date;

  @Column({ type: 'int', nullable: true })
  duration: number; // in seconds

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

