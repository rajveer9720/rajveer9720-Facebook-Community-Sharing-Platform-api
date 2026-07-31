export interface NotificationResponse {
  id: number;
  userId: number;
  type: string;
  title: string;
  message: string;
  read: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}