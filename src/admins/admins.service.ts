import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Admin } from './admin.entity';

@Injectable()
export class AdminsService {
  constructor(@InjectRepository(Admin) private readonly adminsRepository: Repository<Admin>) {}

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
