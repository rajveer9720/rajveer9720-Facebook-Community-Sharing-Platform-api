import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import { Worker } from '../workers/worker.entity';

@Entity('wallets')
export class Wallet {
  @PrimaryColumn()
  workerId: number;

  @OneToOne(() => Worker, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workerId' })
  worker: Worker;

  @Column({ default: 0 })
  availableMinor: number;

  @Column({ default: 0 })
  pendingMinor: number;

  @Column({ default: 0 })
  withdrawalHoldMinor: number;

  @Column({ default: 0 })
  totalMinor: number;

  @Column({ default: 'GBP' })
  currency: string;
}
