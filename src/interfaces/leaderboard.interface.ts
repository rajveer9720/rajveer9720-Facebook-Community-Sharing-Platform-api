export interface LeaderboardEntryResponse {
  rank: number;
  workerId: number;
  workerName: string;
  approvedPosts: number;
  earningsMinor: number;
  isCurrentWorker: boolean;
}

export interface AchievementResponse {
  id: number;
  title: string;
  description: string;
  unlockedAt: string | null;
}
