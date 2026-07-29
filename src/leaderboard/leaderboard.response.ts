export interface LeaderboardEntryResponse {
  rank: number;
  workerId: string;
  workerName: string;
  approvedPosts: number;
  earningsMinor: number;
  isCurrentWorker: boolean;
}

export interface AchievementResponse {
  id: string;
  title: string;
  description: string;
  unlockedAt: string | null;
}
