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
import { VideoCall } from '../../video-calls/entities/video-call.entity';
import { RequestPriority, RequestStatus, UserLanguage } from 'src/types/enums';

@Entity('support_requests')
export class SupportRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  customerId: string;

  @ManyToOne(() => User, (user) => user.customerRequests)
  @JoinColumn({ name: 'customerId' })
  customer: User;

  @Column({ type: 'uuid', nullable: true })
  supporterId: string;

  @ManyToOne(() => User, (user) => user.supporterRequests, { nullable: true })
  @JoinColumn({ name: 'supporterId' })
  supporter: User;

  @Column({
    type: 'enum',
    enum: RequestPriority,
    default: RequestPriority.MEDIUM,
  })
  priority: RequestPriority;

  @Column({
    type: 'enum',
    enum: RequestStatus,
    default: RequestStatus.PENDING,
  })
  status: RequestStatus;

  @Column({
    type: 'enum',
    enum: UserLanguage,
    nullable: true,
  })
  language: UserLanguage;

  @Column({ type: 'simple-array', nullable: true })
  rejectedBySupporterIds: string[]; // Track who rejected to avoid re-assigning

  @Column({ type: 'int', default: 0 })
  rejectionCount: number;

  @Column({ type: 'int', nullable: true })
  staffRating: number; // Rating for supporter (1-5)

  @Column({ type: 'int', nullable: true })
  serviceRating: number; // Rating for service (1-5)

  @OneToOne(() => VideoCall, (call) => call.supportRequest, { nullable: true })
  videoCall: VideoCall;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

