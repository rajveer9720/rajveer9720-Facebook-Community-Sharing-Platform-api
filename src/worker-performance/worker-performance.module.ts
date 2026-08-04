import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Submission } from '../submissions/submission.entity';
import { Worker } from '../workers/worker.entity';
import { WorkerPerformance } from './worker-performance.entity';
import { WorkerPerformanceController } from './worker-performance.controller';
import { WorkerPerformanceService } from './worker-performance.service';

@Module({
  imports: [TypeOrmModule.forFeature([WorkerPerformance, Submission, Worker])],
  providers: [WorkerPerformanceService],
  controllers: [WorkerPerformanceController],
  exports: [WorkerPerformanceService],
})
export class WorkerPerformanceModule {}