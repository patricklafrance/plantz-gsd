export interface ReminderItem {
  plantId: string;
  nickname: string;
  roomName: string | null;
  statusLabel: string;
  daysOverdue: number;
}
