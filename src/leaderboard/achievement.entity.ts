import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('achievements')
export class Achievement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column()
  description: string;

  @Column()
  thresholdApprovedPosts: number;

  @Column({ default: 0 })
  sortOrder: number;
}
