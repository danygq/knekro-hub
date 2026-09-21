export interface AuditLogEntry {
  id: number;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: number;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  description: string;
  created_at: string;
}
