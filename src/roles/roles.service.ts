import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Role } from './role.entity';
import { RolePermission } from './role-permission.entity';
import { Admin } from '../admins/admin.entity';
import { ALL_PERMISSIONS, DEFAULT_ROLES, PermissionPair } from '../permissions/permission-catalog';
import { CreateRoleDto, UpdateRoleDto } from '../dto/roles.dto';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role) private readonly rolesRepository: Repository<Role>,
    @InjectRepository(RolePermission) private readonly rolePermissionsRepository: Repository<RolePermission>,
    @InjectRepository(Admin) private readonly adminsRepository: Repository<Admin>,
  ) {}

  async ensureDefaultRolesSeeded(): Promise<void> {
    const existingRolesCount = await this.rolesRepository.count();
    if (existingRolesCount === 0) {
      for (const defaultRole of DEFAULT_ROLES) {
        const role = await this.rolesRepository.save(
          this.rolesRepository.create({ name: defaultRole.name, slug: defaultRole.slug, isSystem: true }),
        );
        if (defaultRole.permissions.length > 0) {
          await this.rolePermissionsRepository.save(
            defaultRole.permissions.map((permission) =>
              this.rolePermissionsRepository.create({ roleId: role.id, action: permission.action, subject: permission.subject }),
            ),
          );
        }
      }
    }

    const superAdminRole = await this.rolesRepository.findOne({ where: { slug: 'super-admin' } });
    if (superAdminRole) {
      await this.adminsRepository.update({ roleId: IsNull() }, { roleId: superAdminRole.id });
    }
  }

  findAll(): Promise<Role[]> {
    return this.rolesRepository.find({ relations: { permissions: true }, order: { name: 'ASC' } });
  }

  async findById(id: number): Promise<Role> {
    const role = await this.rolesRepository.findOne({ where: { id }, relations: { permissions: true } });
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    return role;
  }

  async create(dto: CreateRoleDto): Promise<Role> {
    this.validatePermissions(dto.permissions);
    const slug = this.slugify(dto.name);

    const existing = await this.rolesRepository.findOne({ where: [{ name: dto.name }, { slug }] });
    if (existing) {
      throw new ConflictException('A role with this name already exists');
    }

    const role = await this.rolesRepository.save(
      this.rolesRepository.create({ name: dto.name, slug, description: dto.description ?? null, isSystem: false }),
    );
    await this.replacePermissions(role.id, dto.permissions);
    return this.findById(role.id);
  }

  async update(id: number, dto: UpdateRoleDto): Promise<Role> {
    const role = await this.findById(id);

    if (dto.name !== undefined) role.name = dto.name;
    if (dto.description !== undefined) role.description = dto.description;
    await this.rolesRepository.save(role);

    if (dto.permissions !== undefined) {
      this.validatePermissions(dto.permissions);
      await this.replacePermissions(role.id, dto.permissions);
    }

    return this.findById(role.id);
  }

  async delete(id: number): Promise<void> {
    await this.findById(id);

    const assignedCount = await this.adminsRepository.count({ where: { roleId: id } });
    if (assignedCount > 0) {
      throw new ConflictException('Cannot delete a role that is still assigned to staff accounts');
    }

    await this.rolesRepository.delete(id);
  }

  async getPermissionsForRole(roleId: number | null): Promise<PermissionPair[]> {
    if (!roleId) {
      return [];
    }
    const permissions = await this.rolePermissionsRepository.find({ where: { roleId } });
    return permissions.map((permission) => ({ action: permission.action, subject: permission.subject }));
  }

  private async replacePermissions(roleId: number, permissions: PermissionPair[]): Promise<void> {
    await this.rolePermissionsRepository.delete({ roleId });
    if (permissions.length > 0) {
      await this.rolePermissionsRepository.save(
        permissions.map((permission) => this.rolePermissionsRepository.create({ roleId, action: permission.action, subject: permission.subject })),
      );
    }
  }

  private validatePermissions(permissions: PermissionPair[]): void {
    const validKeys = new Set(ALL_PERMISSIONS.map((permission) => `${permission.action}:${permission.subject}`));
    const invalid = permissions.filter((permission) => !validKeys.has(`${permission.action}:${permission.subject}`));
    if (invalid.length > 0) {
      throw new BadRequestException(`Unknown permission(s): ${invalid.map((permission) => `${permission.action}:${permission.subject}`).join(', ')}`);
    }
  }

  private slugify(name: string): string {
    return name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
}
