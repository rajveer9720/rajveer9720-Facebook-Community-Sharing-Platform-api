import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { GroupStatus } from '../common/enums';

@Entity('facebook_groups')
export class FacebookGroup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  category: string;

  @Column()
  country: string;

  @Column({ default: 0 })
  qualityScore: number;

  @Column()
  cooldownHours: number;

  @Column({ type: 'enum', enum: GroupStatus, default: GroupStatus.PENDING })
  status: GroupStatus;

  @Column()
  memberCount: number;
}
