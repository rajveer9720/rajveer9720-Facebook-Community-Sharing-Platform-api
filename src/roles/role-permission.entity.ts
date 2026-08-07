import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { Role } from './role.entity';

@Entity('role_permissions')
@Unique(['roleId', 'action', 'subject'])
export class RolePermission {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  roleId: number;

  @ManyToOne(() => Role, (role) => role.permissions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'roleId' })
  role: Role;

  @Column({ length: 64 })
  action: string;

  @Column({ length: 64 })
  subject: string;
}
