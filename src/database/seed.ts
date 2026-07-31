import * as bcrypt from 'bcrypt';
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
import {
  CampaignCategory,
  CampaignPriority,
  CampaignStatus,
  GroupStatus,
  PaymentMethod,
  SubmissionStatus,
  UserRole,
  WithdrawalStatus,
} from '../common/enums';

const now = Date.now();
const hoursAgo = (h: number) => new Date(now - h * 60 * 60 * 1000);
const daysAgo = (d: number) => hoursAgo(d * 24);
const daysFromNow = (d: number) => new Date(now + d * 24 * 60 * 60 * 1000);

async function seed(): Promise<void> {
  const dataSource = await new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 3306),
    username: process.env.DB_USERNAME ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_DATABASE ?? 'fcsp',
    entities: [User, Campaign, FacebookGroup, WorkerGroupLibraryEntry, CampaignGroupAssignment, Submission, Wallet, Withdrawal, Achievement, AuditLog, Notification, WorkerPerformance],
    synchronize: true,
    dropSchema: true,
  }).initialize();

  // Clear existing data, children first.
  await dataSource.getRepository(Withdrawal).createQueryBuilder().delete().execute();
  await dataSource.getRepository(Submission).createQueryBuilder().delete().execute();
  await dataSource.getRepository(WorkerGroupLibraryEntry).createQueryBuilder().delete().execute();
  await dataSource.getRepository(Wallet).createQueryBuilder().delete().execute();
  await dataSource.getRepository(Achievement).createQueryBuilder().delete().execute();
  await dataSource.getRepository(FacebookGroup).createQueryBuilder().delete().execute();
  await dataSource.getRepository(Campaign).createQueryBuilder().delete().execute();
  await dataSource.getRepository(User).createQueryBuilder().delete().execute();

  const usersRepository = dataSource.getRepository(User);
  const [admin, worker1, worker2] = await usersRepository.save([
    {
      email: 'admin@example.com',
      passwordHash: await bcrypt.hash('Admin@12345', 10),
      firstName: 'John',
      lastName: 'Admin',
      role: UserRole.ADMIN,
    },
    {
      email: 'worker@example.com',
      passwordHash: await bcrypt.hash('Worker@12345', 10),
      firstName: 'Jane',
      lastName: 'Worker',
      role: UserRole.WORKER,
    },
    {
      email: 'worker2@example.com',
      passwordHash: await bcrypt.hash('Worker@12345', 10),
      firstName: 'Sam',
      lastName: 'Roberts',
      role: UserRole.WORKER,
    },
  ]);

  const groupsRepository = dataSource.getRepository(FacebookGroup);
  const [group1, group2, group3] = await groupsRepository.save([
    {
      name: 'UK Technology Professionals',
      category: 'Technology',
      country: 'United Kingdom',
      qualityScore: 88,
      cooldownHours: 72,
      status: GroupStatus.APPROVED,
      memberCount: 45210,
    },
    {
      name: 'Digital Innovation Community',
      category: 'Technology',
      country: 'United Kingdom',
      qualityScore: 84,
      cooldownHours: 72,
      status: GroupStatus.APPROVED,
      memberCount: 31875,
    },
    {
      name: 'Global Tech Founders Network',
      category: 'Technology',
      country: 'United States',
      qualityScore: 0,
      cooldownHours: 48,
      status: GroupStatus.PENDING,
      memberCount: 18420,
    },
  ]);

  const libraryRepository = dataSource.getRepository(WorkerGroupLibraryEntry);
  await libraryRepository.save([
    {
      workerId: worker1.id,
      groupId: group1.id,
      timesUsed: 7,
      lastPostedAt: daysAgo(2),
      availableAt: hoursAgo(-24),
    },
    {
      workerId: worker1.id,
      groupId: group2.id,
      timesUsed: 4,
      lastPostedAt: daysAgo(5),
      availableAt: null,
    },
  ]);

  const campaignsRepository = dataSource.getRepository(Campaign);
  const [campaign1, campaign2] = await campaignsRepository.save([
    {
      name: 'Technology Community Awareness',
      category: CampaignCategory.TECHNOLOGY,
      priority: CampaignPriority.HIGH,
      status: CampaignStatus.ACTIVE,
      instructions:
        'Share the campaign post in approved technology groups. Include the official caption and campaign link. One post per group per cooldown window.',
      startDate: daysAgo(3),
      endDate: daysFromNow(30),
      budgetMinor: 500000,
      rewardPerPostMinor: 250,
      currency: 'GBP',
      maximumWorkers: 100,
      maximumPostsPerWorker: 5,
      dailyPostingLimit: 2,
      workersJoined: 24,
    },
    {
      name: 'Small Business Spotlight',
      category: CampaignCategory.BUSINESS,
      priority: CampaignPriority.NORMAL,
      status: CampaignStatus.ACTIVE,
      instructions:
        'Post the business spotlight graphic with the provided caption in relevant business or entrepreneurship groups.',
      startDate: daysAgo(10),
      endDate: daysFromNow(14),
      budgetMinor: 300000,
      rewardPerPostMinor: 200,
      currency: 'GBP',
      maximumWorkers: 60,
      maximumPostsPerWorker: 3,
      dailyPostingLimit: 1,
      workersJoined: 41,
    },
    {
      name: 'Personal Finance Tips Series',
      category: CampaignCategory.FINANCE,
      priority: CampaignPriority.NORMAL,
      status: CampaignStatus.PAUSED,
      instructions: 'Share weekly personal finance tips in personal finance and budgeting groups only.',
      startDate: daysAgo(20),
      endDate: daysFromNow(5),
      budgetMinor: 200000,
      rewardPerPostMinor: 180,
      currency: 'GBP',
      maximumWorkers: 40,
      maximumPostsPerWorker: 4,
      dailyPostingLimit: 1,
      workersJoined: 12,
    },
  ]);

  const submissionsRepository = dataSource.getRepository(Submission);
  await submissionsRepository.save([
    {
      campaignId: campaign1.id,
      workerId: worker1.id,
      groupId: group1.id,
      status: SubmissionStatus.APPROVED,
      proofUrl: 'https://facebook.com/groups/uktech/posts/1001',
      caption: 'Excited to share this with the community!',
      rewardMinor: 250,
      submittedAt: daysAgo(4),
      reviewedAt: daysAgo(3),
      reviewNote: null,
    },
    {
      campaignId: campaign1.id,
      workerId: worker1.id,
      groupId: group2.id,
      status: SubmissionStatus.MANUAL_REVIEW,
      proofUrl: 'https://facebook.com/groups/digitalinnovation/posts/2002',
      caption: 'Sharing today’s update with the group.',
      rewardMinor: 250,
      submittedAt: hoursAgo(6),
      reviewedAt: null,
      reviewNote: null,
    },
    {
      campaignId: campaign1.id,
      workerId: worker2.id,
      groupId: group1.id,
      status: SubmissionStatus.PENDING,
      proofUrl: 'https://facebook.com/groups/uktech/posts/1050',
      caption: 'Posted the campaign update.',
      rewardMinor: 250,
      submittedAt: hoursAgo(1),
      reviewedAt: null,
      reviewNote: null,
    },
    {
      campaignId: campaign2.id,
      workerId: worker2.id,
      groupId: group2.id,
      status: SubmissionStatus.REJECTED,
      proofUrl: 'https://facebook.com/groups/digitalinnovation/posts/2090',
      caption: 'Shared the spotlight graphic.',
      rewardMinor: 0,
      submittedAt: daysAgo(6),
      reviewedAt: daysAgo(5),
      reviewNote: 'Caption did not match the approved campaign copy. Please resubmit with the exact wording.',
    },
  ]);

  const walletsRepository = dataSource.getRepository(Wallet);
  await walletsRepository.save([
    {
      workerId: worker1.id,
      availableMinor: 1250,
      pendingMinor: 250,
      withdrawalHoldMinor: 0,
      totalMinor: 1500,
      currency: 'GBP',
    },
    {
      workerId: worker2.id,
      availableMinor: 500,
      pendingMinor: 250,
      withdrawalHoldMinor: 0,
      totalMinor: 750,
      currency: 'GBP',
    },
  ]);

  const withdrawalsRepository = dataSource.getRepository(Withdrawal);
  await withdrawalsRepository.save([
    {
      workerId: worker1.id,
      amountMinor: 1000,
      currency: 'GBP',
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      paymentDetails: { accountReference: 'Sort code / account on file' },
      status: WithdrawalStatus.PENDING,
      requestedAt: hoursAgo(5),
    },
    {
      workerId: worker2.id,
      amountMinor: 500,
      currency: 'GBP',
      paymentMethod: PaymentMethod.PAYPAL,
      paymentDetails: { accountReference: 'PayPal on file' },
      status: WithdrawalStatus.APPROVED,
      requestedAt: daysAgo(2),
    },
  ]);

  const achievementsRepository = dataSource.getRepository(Achievement);
  await achievementsRepository.save([
    { title: 'First approved post', description: 'Get your first submission approved', thresholdApprovedPosts: 1, sortOrder: 1 },
    { title: '10 approved posts', description: 'Reach 10 approved submissions', thresholdApprovedPosts: 10, sortOrder: 2 },
    { title: '50 approved posts', description: 'Reach 50 approved submissions', thresholdApprovedPosts: 50, sortOrder: 3 },
  ]);

  console.log('Seed complete.');
  console.log(`  admin: admin@example.com / Admin@12345 (${admin.id})`);
  console.log(`  worker: worker@example.com / Worker@12345 (${worker1.id})`);
  console.log(`  worker2: worker2@example.com / Worker@12345 (${worker2.id})`);

  await dataSource.destroy();
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
