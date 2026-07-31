import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('campaign_group_assignments')
export class CampaignGroupAssignment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  campaignId: number;

  @Column()
  groupId: number;

  @Column()
  workerId: number;

  @CreateDateColumn()
  assignedAt: Date;

  @Column({ type: 'datetime' })
  cooldownUntil: Date;

  @Column({ type: 'datetime', nullable: true })
  consumedAt: Date | null;
}