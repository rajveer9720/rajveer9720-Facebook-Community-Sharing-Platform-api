import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Worker } from './worker.entity';
import { WorkersService } from './workers.service';

@Module({
  imports: [TypeOrmModule.forFeature([Worker])],
  providers: [WorkersService],
  exports: [WorkersService],
})
export class WorkersModule {}
