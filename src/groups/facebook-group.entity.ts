import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { GroupStatus } from '../common/enums';

@Entity('facebook_groups')
export class FacebookGroup {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  category: string;

  @Column()
  country: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  url: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  language: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  privacyType: string | null;

  @Column({ default: 0 })
  qualityScore: number;

  @Column({ default: 0 })
  engagementScore: number;

  @Column({ default: 0 })
  spamScore: number;

  @Column({ default: false })
  blacklisted: boolean;

  @Column()
  cooldownHours: number;

  @Column({ type: 'varchar', length: 191, nullable: true })
  lastWorkerId: number | null;

  @Column({ type: 'varchar', length: 191, nullable: true })
  lastCampaignId: number | null;

  @Column({ type: 'enum', enum: GroupStatus, default: GroupStatus.PENDING })
  status: GroupStatus;

  @Column()
  memberCount: number;
}
