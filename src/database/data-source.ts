import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { User } from '../users/user.entity';
import { Campaign } from '../campaigns/campaign.entity';
import { FacebookGroup } from '../groups/facebook-group.entity';
import { WorkerGroupLibraryEntry } from '../groups/worker-group-library-entry.entity';
import { CampaignGroupAssignment } from '../groups/campaign-group-assignment.entity';
import { Submission } from '../submissions/submission.entity';
import { Wallet } from '../wallet/wallet.entity';
import { Withdrawal } from '../wallet/withdrawal.entity';
import { Achievement } from '../leaderboard/achievement.entity';
import { AuditLog } from '../audit-logs/audit-log.entity';
import { Notification } from '../notifications/notification.entity';
import { WorkerPerformance } from '../worker-performance/worker-performance.entity';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 3306),
  username: process.env.DB_USERNAME ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_DATABASE ?? 'fcsp',
  entities: [
    User,
    Campaign,
    FacebookGroup,
    WorkerGroupLibraryEntry,
    CampaignGroupAssignment,
    Submission,
    Wallet,
    Withdrawal,
    Achievement,
    AuditLog,
    Notification,
    WorkerPerformance,
  ],
  synchronize: true,
});
