import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { UserRole } from '../common/enums';

export interface CreateWorkerInput {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
}

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly usersRepository: Repository<User>) {}

  async createWorker(input: CreateWorkerInput): Promise<User> {
    const user = this.usersRepository.create({
      email: input.email,
      passwordHash: input.passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      role: UserRole.WORKER,
      refreshTokenHash: null,
      passwordResetTokenHash: null,
      passwordResetTokenExpiresAt: null,
    });
    return this.usersRepository.save(user);
  }

  findByEmail(email: string, withSecrets = false): Promise<User | null> {
    const query = this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('LOWER(user.email) = LOWER(:email)', { email });

    if (withSecrets) {
      query
        .addSelect('user.refreshTokenHash')
        .addSelect('user.passwordResetTokenHash')
        .addSelect('user.passwordResetTokenExpiresAt');
    }

    return query.getOne();
  }

  findById(id: number, withSecrets = false): Promise<User | null> {
    const query = this.usersRepository.createQueryBuilder('user').where('user.id = :id', { id });

    if (!withSecrets) {
      return query.getOne();
    }

    return query
      .addSelect('user.passwordHash')
      .addSelect('user.refreshTokenHash')
      .addSelect('user.passwordResetTokenHash')
      .addSelect('user.passwordResetTokenExpiresAt')
      .getOne();
  }

  findUsersWithResetSecrets(): Promise<User[]> {
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .addSelect('user.refreshTokenHash')
      .addSelect('user.passwordResetTokenHash')
      .addSelect('user.passwordResetTokenExpiresAt')
      .getMany();
  }

  countByRole(role: UserRole): Promise<number> {
    return this.usersRepository.count({ where: { role } });
  }

  listByRole(role: UserRole): Promise<User[]> {
    return this.usersRepository.find({ where: { role } });
  }

  async updateRefreshTokenHash(userId: number, refreshTokenHash: string | null): Promise<void> {
    await this.usersRepository.update(userId, { refreshTokenHash });
  }

  async updatePasswordResetToken(
    userId: number,
    passwordResetTokenHash: string | null,
    passwordResetTokenExpiresAt: Date | null,
  ): Promise<void> {
    await this.usersRepository.update(userId, { passwordResetTokenHash, passwordResetTokenExpiresAt });
  }

  async updatePasswordHash(userId: number, passwordHash: string): Promise<void> {
    await this.usersRepository.update(userId, { passwordHash });
  }
}
