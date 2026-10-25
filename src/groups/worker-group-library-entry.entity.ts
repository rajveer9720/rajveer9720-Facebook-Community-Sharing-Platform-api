import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Worker } from '../workers/worker.entity';
import { FacebookGroup } from './facebook-group.entity';

@Entity('worker_group_library_entries')
export class WorkerGroupLibraryEntry {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  workerId: number;

  @ManyToOne(() => Worker, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workerId' })
  worker: Worker;

  @Column()
  groupId: number;

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
