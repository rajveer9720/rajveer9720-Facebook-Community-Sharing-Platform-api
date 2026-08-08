import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Admin } from './admin.entity';
import { CreateStaffInput, CreateStaffResponse, StaffSummary } from '../interfaces/admins.interface';
import { StaffRoleSummary } from '../interfaces/auth.interface';
import { CreateStaffDto, UpdateStaffDto } from '../dto/admins.dto';
import { RolesService } from '../roles/roles.service';
import { WorkersService } from '../workers/workers.service';
import { BCRYPT_SALT_ROUNDS, TEMPORARY_PASSWORD_BYTES } from '../common/constants/auth.constants';

@Injectable()
export class AdminsService {
  constructor(
    @InjectRepository(Admin) private readonly adminsRepository: Repository<Admin>,
    private readonly rolesService: RolesService,
    private readonly workersService: WorkersService,
  ) {}

  async createStaff(dto: CreateStaffDto): Promise<CreateStaffResponse> {
    const [existingAdmin, existingWorker] = await Promise.all([
      this.findByEmail(dto.email),
      this.workersService.findByEmail(dto.email),
    ]);
    if (existingAdmin || existingWorker) {
      throw new ConflictException('Email already in use');
    }

    const role = await this.rolesService.findById(dto.roleId);

    const temporaryPassword = crypto.randomBytes(TEMPORARY_PASSWORD_BYTES).toString('base64url');
    const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_SALT_ROUNDS);

    const admin = await this.createAdmin({
      email: dto.email,
      firstName: dto.firstName,
      lastName: dto.lastName,
      roleId: dto.roleId,
      passwordHash,
    });

    return {
      id: admin.id,
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
      role: { id: role.id, name: role.name, slug: role.slug },
      temporaryPassword,
    };
  }

  async findAllStaff(): Promise<StaffSummary[]> {
    const admins = await this.adminsRepository.find({
      relations: { role: true },
      order: { createdAt: 'DESC' },
    });

    return admins
      .filter((admin) => admin.role?.slug !== 'super-admin')
      .map((admin) => ({
        id: admin.id,
        email: admin.email,
        firstName: admin.firstName,
        lastName: admin.lastName,
        role: admin.role ? { id: admin.role.id, name: admin.role.name, slug: admin.role.slug } : null,
      }));
  }

  async updateStaff(id: number, dto: UpdateStaffDto, currentAdminId: number): Promise<StaffSummary> {
    if (id === currentAdminId) {
      throw new BadRequestException('You cannot update your own account here');
    }

    const admin = await this.adminsRepository.findOne({ where: { id }, relations: { role: true } });
    if (!admin) {
      throw new NotFoundException('Staff account not found');
    }
    if (admin.role?.slug === 'super-admin') {
      throw new BadRequestException('Cannot modify a super admin account');
    }

    if (dto.email && dto.email.toLowerCase() !== admin.email.toLowerCase()) {
      const [existingAdmin, existingWorker] = await Promise.all([
        this.findByEmail(dto.email),
        this.workersService.findByEmail(dto.email),
      ]);
      if (existingAdmin || existingWorker) {
        throw new ConflictException('Email already in use');
      }
      admin.email = dto.email;
    }

    let roleSummary: StaffRoleSummary | null = admin.role
      ? { id: admin.role.id, name: admin.role.name, slug: admin.role.slug }
      : null;

    if (dto.roleId !== undefined && dto.roleId !== admin.roleId) {
      const role = await this.rolesService.findById(dto.roleId);
      if (role.slug === 'super-admin') {
        throw new BadRequestException('Cannot assign the super admin role here');
      }
      admin.roleId = dto.roleId;
      roleSummary = { id: role.id, name: role.name, slug: role.slug };
    }

    if (dto.firstName !== undefined) admin.firstName = dto.firstName;
    if (dto.lastName !== undefined) admin.lastName = dto.lastName;

    const saved = await this.adminsRepository.save(admin);

    return {
      id: saved.id,
      email: saved.email,
      firstName: saved.firstName,
      lastName: saved.lastName,
      role: roleSummary,
    };
  }

  async deleteStaff(id: number, currentAdminId: number): Promise<void> {
    if (id === currentAdminId) {
      throw new BadRequestException('You cannot delete your own account');
    }

    const admin = await this.adminsRepository.findOne({ where: { id }, relations: { role: true } });
    if (!admin) {
      throw new NotFoundException('Staff account not found');
    }
    if (admin.role?.slug === 'super-admin') {
      throw new BadRequestException('Cannot delete a super admin account');
    }

    await this.adminsRepository.delete(id);
  }

  async createAdmin(input: CreateStaffInput): Promise<Admin> {
    const admin = this.adminsRepository.create({
      email: input.email,
      passwordHash: input.passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      roleId: input.roleId,
      refreshTokenHash: null,
      passwordResetTokenHash: null,
      passwordResetTokenExpiresAt: null,
    });
    return this.adminsRepository.save(admin);
  }

  findByEmail(email: string, withSecrets = false): Promise<Admin | null> {
    const query = this.adminsRepository
      .createQueryBuilder('admin')
      .addSelect('admin.passwordHash')
      .where('LOWER(admin.email) = LOWER(:email)', { email });

    if (withSecrets) {
      query
        .addSelect('admin.refreshTokenHash')
        .addSelect('admin.passwordResetTokenHash')
        .addSelect('admin.passwordResetTokenExpiresAt');
    }

    return query.getOne();
  }

  findById(id: number, withSecrets = false): Promise<Admin | null> {
    const query = this.adminsRepository.createQueryBuilder('admin').where('admin.id = :id', { id });

    if (!withSecrets) {
      return query.getOne();
    }

    return query
      .addSelect('admin.passwordHash')
      .addSelect('admin.refreshTokenHash')
      .addSelect('admin.passwordResetTokenHash')
      .addSelect('admin.passwordResetTokenExpiresAt')
      .getOne();
  }

  findAdminsWithResetSecrets(): Promise<Admin[]> {
    return this.adminsRepository
      .createQueryBuilder('admin')
      .addSelect('admin.passwordHash')
      .addSelect('admin.refreshTokenHash')
      .addSelect('admin.passwordResetTokenHash')
      .addSelect('admin.passwordResetTokenExpiresAt')
      .getMany();
  }

  async updateRefreshTokenHash(adminId: number, refreshTokenHash: string | null): Promise<void> {
    await this.adminsRepository.update(adminId, { refreshTokenHash });
  }

  async updatePasswordResetToken(
    adminId: number,
    passwordResetTokenHash: string | null,
    passwordResetTokenExpiresAt: Date | null,
  ): Promise<void> {
    await this.adminsRepository.update(adminId, { passwordResetTokenHash, passwordResetTokenExpiresAt });
  }

  async updatePasswordHash(adminId: number, passwordHash: string): Promise<void> {
    await this.adminsRepository.update(adminId, { passwordHash });
  }
}
