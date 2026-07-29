import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { CampaignCategory, CampaignPriority, CampaignStatus } from '../common/enums';

@Entity('campaigns')
export class Campaign {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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

  @Column({ type: 'datetime' })
  startDate: Date;

  @Column({ type: 'datetime' })
  endDate: Date;

  @Column()
  budgetMinor: number;

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

  @CreateDateColumn()
  createdAt: Date;
}
