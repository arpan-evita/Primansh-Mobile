/**
 * canMessage — Role-based messaging permission check
 *
 * Rules:
 *   Admin      → can message ALL users
 *   Team member → can message admins + ONLY their assigned clients
 *   Client      → can message admins + ONLY their assigned team members
 */

export interface CanMessageProfile {
  id: string;
  role: string;
  associated_client_id?: string | null;
}

export const normalizeRole = (role: string): string => {
  if (!role) return 'client';
  const r = role.toLowerCase().trim().replace(/[\s_-]+/g, '');
  if (r.includes('admin') || r.includes('manager') || r.includes('owner')) return 'admin';
  if (r.includes('seo')) return 'seo';
  if (r.includes('content')) return 'content';
  if (r.includes('dev')) return 'developer';
  if (r.includes('team')) return 'team';
  if (r.includes('client')) return 'client';
  return 'client';
};

export function canMessage(
  sender: CanMessageProfile,
  receiver: CanMessageProfile,
  senderAssignedClientIds: string[] = []
): boolean {
  // Can never message yourself
  if (sender.id === receiver.id) return false;

  const sRole = normalizeRole(sender.role);
  const rRole = normalizeRole(receiver.role);

  // Admin can message everyone
  if (sRole === "admin") return true;

  // Everyone can message admins
  if (rRole === "admin") return true;

  // Clients: can only message team members assigned to same client
  if (sRole === "client") {
    if (rRole === "client") return false;
    return receiver.associated_client_id === sender.associated_client_id;
  }

  // Team members/Staff:
  const isStaff = ['seo', 'content', 'developer', 'team'].includes(sRole);
  
  if (isStaff) {
    if (rRole === "client") {
      return senderAssignedClientIds.includes(receiver.associated_client_id || '');
    }
  }

  return false;
}

/** Filter a list of profiles to only those the sender can message */
export function getAllowedRecipients(
  sender: CanMessageProfile,
  allProfiles: CanMessageProfile[],
  senderAssignedClientIds: string[] = []
): CanMessageProfile[] {
  return allProfiles.filter((p) => canMessage(sender, p, senderAssignedClientIds));
}
