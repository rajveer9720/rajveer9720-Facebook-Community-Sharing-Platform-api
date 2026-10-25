import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FacebookGroup } from './facebook-group.entity';
import { WorkerGroupLibraryEntry } from './worker-group-library-entry.entity';
import { CampaignGroupAssignment } from './campaign-group-assignment.entity';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';
import { CampaignsModule } from '../campaigns/campaigns.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([FacebookGroup, WorkerGroupLibraryEntry, CampaignGroupAssignment]),
    CampaignsModule,
    AuditLogsModule,
  ],
  controllers: [GroupsController],
  providers: [GroupsService],
  exports: [GroupsService],
})
export class GroupsModule {}
