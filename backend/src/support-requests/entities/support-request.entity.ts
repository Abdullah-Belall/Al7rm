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
import { User, UserLanguage } from '../../users/entities/user.entity';
import { VideoCall } from '../../video-calls/entities/video-call.entity';

export enum RequestStatus {
  PENDING = 'pending',
  ASSIGNED = 'assigned',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum RequestPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum RequestCategory {
  PRAYER = 'prayer',
  GUIDANCE = 'guidance',
  EMERGENCY = 'emergency',
  INFORMATION = 'information',
  OTHER = 'other',
}

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

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: RequestCategory,
    default: RequestCategory.OTHER,
  })
  category: RequestCategory;

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
    default: UserLanguage.ARABIC
  })
  language: UserLanguage;

  @Column({ type: 'simple-array', nullable: true })
  rejectedBySupporterIds: string[]; // Track who rejected to avoid re-assigning

  @Column({ type: 'int', default: 0 })
  rejectionCount: number;

  @OneToOne(() => VideoCall, (call) => call.supportRequest, { nullable: true })
  videoCall: VideoCall;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

