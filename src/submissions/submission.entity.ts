import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { Campaign } from '../campaigns/campaign.entity';
import { FacebookGroup } from '../groups/facebook-group.entity';
import { SubmissionStatus } from '../common/enums';

@Entity('submissions')
export class Submission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  campaignId: string;

  @ManyToOne(() => Campaign, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'campaignId' })
  campaign: Campaign;

  @Column()
  workerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workerId' })
  worker: User;

  @Column()
  groupId: string;

  @ManyToOne(() => FacebookGroup, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'groupId' })
  group: FacebookGroup;

  @Column({ type: 'enum', enum: SubmissionStatus, default: SubmissionStatus.PENDING })
  status: SubmissionStatus;

  @Column()
  proofUrl: string;

  @Column({ type: 'text' })
  caption: string;

  @Column()
  rewardMinor: number;

  @CreateDateColumn()
  submittedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  reviewedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  reviewNote: string | null;
}
