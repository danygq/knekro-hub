export type AuditActionType = "UPDATE_GAME_STATUS";
export type AuditEntityType = "games";

export interface AuditLogEntry {
  id: number;
  user_id: string;
  action_type: AuditActionType;
  entity_type: AuditEntityType;
  entity_id: number;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  description: string;
  created_at: string;
}
