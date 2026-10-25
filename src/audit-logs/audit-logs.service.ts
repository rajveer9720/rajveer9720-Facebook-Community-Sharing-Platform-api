import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';

@Injectable()
export class AuditLogsService {
  constructor(@InjectRepository(AuditLog) private readonly auditLogsRepository: Repository<AuditLog>) {}

  async record(input: {
    actorId?: string | number | null;
    action: string;
    resourceType: string;
    resourceId?: string | number | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<void> {
    const log = this.auditLogsRepository.create({
      actorId: input.actorId !== undefined && input.actorId !== null ? String(input.actorId) : null,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId !== undefined && input.resourceId !== null ? String(input.resourceId) : null,
      metadata: input.metadata ?? null,
    });
    await this.auditLogsRepository.save(log);
  }
}