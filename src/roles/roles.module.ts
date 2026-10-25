import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from './role.entity';
import { RolePermission } from './role-permission.entity';
import { Admin } from '../admins/admin.entity';
import { RolesService } from './roles.service';
import { RolesController } from './roles.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Role, RolePermission, Admin])],
  providers: [RolesService],
  controllers: [RolesController],
  exports: [RolesService],
})
export class RolesModule implements OnApplicationBootstrap {
  constructor(private readonly rolesService: RolesService) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.rolesService.ensureDefaultRolesSeeded();
  }
}
