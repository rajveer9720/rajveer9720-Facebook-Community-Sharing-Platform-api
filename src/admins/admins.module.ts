import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Admin } from './admin.entity';
import { AdminsService } from './admins.service';
import { AdminsController } from './admins.controller';
import { RolesModule } from '../roles/roles.module';
import { WorkersModule } from '../workers/workers.module';

@Module({
  imports: [TypeOrmModule.forFeature([Admin]), RolesModule, WorkersModule],
  controllers: [AdminsController],
  providers: [AdminsService],
  exports: [AdminsService],
})
export class AdminsModule {}
