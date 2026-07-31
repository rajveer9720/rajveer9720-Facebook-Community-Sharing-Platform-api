import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { CampaignCategory, CampaignPriority, CampaignStatus } from '../common/enums';

export interface CampaignMediaVariant {
  mediaUrl: string;
  mediaType: 'IMAGE' | 'VIDEO';
  caption: string;
}

@Entity('campaigns')
export class Campaign {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'enum', enum: CampaignCategory })
  category: CampaignCategory;

  @Column({ type: 'enum', enum: CampaignPriority })
  priority: CampaignPriority;

  @Column({ type: 'enum', enum: CampaignStatus, default: CampaignStatus.DRAFT })
  status: CampaignStatus;

  @Column({ type: 'text' })
  instructions: string;

  @Column({ type: 'json', default: '[]' })
  mediaVariants: CampaignMediaVariant[];

  @Column({ default: true })
  screenshotRequired: boolean;

  @Column({ default: false })
  facebookPostUrlRequired: boolean;

  @Column({ default: false })
  groupNameRequired: boolean;

  @Column({ default: false })
  manualReviewRequired: boolean;

  @Column({ default: true })
  aiVerificationEnabled: boolean;

  @Column({ default: false })
  autoApprovalEnabled: boolean;

  @Column({ type: 'datetime' })
  startDate: Date;

  @Column({ type: 'datetime' })
  endDate: Date;

  @Column()
  budgetMinor: number;

  @Column({ default: 0 })
  spentMinor: number;

  @Column()
  rewardPerPostMinor: number;

  @Column({ default: 'GBP' })
  currency: string;

  @Column()
  maximumWorkers: number;

  @Column()
  maximumPostsPerWorker: number;

  @Column()
  dailyPostingLimit: number;

  @Column({ default: 0 })
  workersJoined: number;

  @Column({ type: 'datetime', nullable: true })
  archivedAt: Date | null;

  @Column({ type: 'datetime', nullable: true })
  endingSoonNotifiedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
