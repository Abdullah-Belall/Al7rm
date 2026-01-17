import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { SupportRequest } from '../../support-requests/entities/support-request.entity';
import { VideoCall } from '../../video-calls/entities/video-call.entity';
import { UserLanguage, UserRole } from 'src/types/enums';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  phone: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.CUSTOMER,
  })
  role: UserRole;

  @Column({
    type: 'enum',
    enum: UserLanguage,
    default: UserLanguage.ARABIC,
  })
  preferredLanguage: UserLanguage;

  // Supporter specific fields
  @Column({ default: false })
  isAvailable: boolean;

  @Column({ type: 'simple-array', nullable: true })
  specialties: string[]; // e.g., ['prayer', 'guidance', 'emergency']

  @Column({ type: 'int', default: 0 })
  currentRequestsCount: number;

  @Column({ type: 'int', default: 0 })
  maxConcurrentRequests: number;

  @OneToMany(() => SupportRequest, (request) => request.customer)
  customerRequests: SupportRequest[];

  @OneToMany(() => SupportRequest, (request) => request.supporter)
  supporterRequests: SupportRequest[];

  @OneToMany(() => VideoCall, (call) => call.customer)
  customerCalls: VideoCall[];

  @OneToMany(() => VideoCall, (call) => call.supporter)
  supporterCalls: VideoCall[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

