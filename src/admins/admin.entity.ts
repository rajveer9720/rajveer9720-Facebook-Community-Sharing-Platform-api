import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('admins')
export class Admin {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column({ select: false })
  passwordHash: string;

  @Column({ type: 'text', nullable: true, select: false })
  refreshTokenHash: string | null;

  @Column({ type: 'text', nullable: true, select: false })
  passwordResetTokenHash: string | null;

  @Column({ type: 'datetime', nullable: true, select: false })
  passwordResetTokenExpiresAt: Date | null;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
