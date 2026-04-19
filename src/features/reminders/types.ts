export interface ReminderItem {
  plantId: string;
  nickname: string;
  roomName: string | null;
  statusLabel: string;
  daysOverdue: number;
}

/**
 * D-18 merged-feed cycle event. Sibling to ReminderItem — bell dropdown renders
 * overdue → due-today → unread cycle events → read cycle events in fixed buckets.
 * `type` matches NOTIFICATION_TYPES in @/features/household/constants.
 */
export interface CycleEventItem {
  notificationId: string;
  type:
    | "cycle_started"
    | "cycle_reassigned_manual_skip"
    | "cycle_reassigned_auto_skip"
    | "cycle_reassigned_member_left"
    | "cycle_fallback_owner";
  createdAt: Date;
  readAt: Date | null;
  priorAssigneeName: string | null; // null for cycle_started + cycle_fallback_owner
}
