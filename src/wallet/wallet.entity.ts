import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import { User } from '../users/user.entity';

@Entity('wallets')
export class Wallet {
  @PrimaryColumn()
  workerId: number;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workerId' })
  worker: User;

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
