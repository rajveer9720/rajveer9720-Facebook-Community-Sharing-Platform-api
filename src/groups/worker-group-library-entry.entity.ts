import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { FacebookGroup } from './facebook-group.entity';

@Entity('worker_group_library_entries')
export class WorkerGroupLibraryEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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

  @Column({ default: 0 })
  timesUsed: number;

  @Column({ type: 'datetime', nullable: true })
  lastPostedAt: Date | null;

  @Column({ type: 'datetime', nullable: true })
  availableAt: Date | null;
}
