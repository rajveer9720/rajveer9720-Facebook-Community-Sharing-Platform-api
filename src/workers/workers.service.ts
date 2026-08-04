import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Worker } from './worker.entity';
import { CreateWorkerInput } from '../interfaces/workers.interface';

@Injectable()
export class WorkersService {
  constructor(@InjectRepository(Worker) private readonly workersRepository: Repository<Worker>) {}

  async createWorker(input: CreateWorkerInput): Promise<Worker> {
    const worker = this.workersRepository.create({
      email: input.email,
      passwordHash: input.passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      refreshTokenHash: null,
      passwordResetTokenHash: null,
      passwordResetTokenExpiresAt: null,
    });
    return this.workersRepository.save(worker);
  }

  findByEmail(email: string, withSecrets = false): Promise<Worker | null> {
    const query = this.workersRepository
      .createQueryBuilder('worker')
      .addSelect('worker.passwordHash')
      .where('LOWER(worker.email) = LOWER(:email)', { email });

    if (withSecrets) {
      query
        .addSelect('worker.refreshTokenHash')
        .addSelect('worker.passwordResetTokenHash')
        .addSelect('worker.passwordResetTokenExpiresAt');
    }

    return query.getOne();
  }

  findById(id: number, withSecrets = false): Promise<Worker | null> {
    const query = this.workersRepository.createQueryBuilder('worker').where('worker.id = :id', { id });

    if (!withSecrets) {
      return query.getOne();
    }

    return query
      .addSelect('worker.passwordHash')
      .addSelect('worker.refreshTokenHash')
      .addSelect('worker.passwordResetTokenHash')
      .addSelect('worker.passwordResetTokenExpiresAt')
      .getOne();
  }

  findWorkersWithResetSecrets(): Promise<Worker[]> {
    return this.workersRepository
      .createQueryBuilder('worker')
      .addSelect('worker.passwordHash')
      .addSelect('worker.refreshTokenHash')
      .addSelect('worker.passwordResetTokenHash')
      .addSelect('worker.passwordResetTokenExpiresAt')
      .getMany();
  }

  findAll(): Promise<Worker[]> {
    return this.workersRepository.find();
  }

  async updateRefreshTokenHash(workerId: number, refreshTokenHash: string | null): Promise<void> {
    await this.workersRepository.update(workerId, { refreshTokenHash });
  }

  async updatePasswordResetToken(
    workerId: number,
    passwordResetTokenHash: string | null,
    passwordResetTokenExpiresAt: Date | null,
  ): Promise<void> {
    await this.workersRepository.update(workerId, { passwordResetTokenHash, passwordResetTokenExpiresAt });
  }

  async updatePasswordHash(workerId: number, passwordHash: string): Promise<void> {
    await this.workersRepository.update(workerId, { passwordHash });
  }
}
