import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { Campaign } from '../campaigns/campaign.entity';
import { FacebookGroup } from '../groups/facebook-group.entity';
import { SubmissionStatus } from '../common/enums';

@Entity('submissions')
export class Submission {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  campaignId: number;

  @ManyToOne(() => Campaign, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'campaignId' })
  campaign: Campaign;

  @Column()
  workerId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workerId' })
  worker: User;

  @Column()
  groupId: number;

  @ManyToOne(() => FacebookGroup, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'groupId' })
  group: FacebookGroup;

  @Column({ type: 'enum', enum: SubmissionStatus, default: SubmissionStatus.PENDING })
  status: SubmissionStatus;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  proofUrl: string | null;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  facebookPostUrl: string | null;

  @Column({ type: 'varchar', length: 191, nullable: true })
  submittedGroupName: string | null;

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

  @Column({ default: 0 })
  verificationConfidence: number;

  @Column({ type: 'text', nullable: true })
  verificationExplanation: string | null;

  @Column({ default: false })
  duplicateProofDetected: boolean;

  @Column({ default: false })
  duplicateUrlDetected: boolean;

  @Column({ default: 0 })
  fraudRiskScore: number;

  @Column({ default: false })
  flaggedForFraud: boolean;

  @Column({ type: 'json', nullable: true })
  fraudSignals: Record<string, unknown> | null;
}
