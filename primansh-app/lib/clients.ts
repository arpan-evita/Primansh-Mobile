import { normalizeRole, type MobileProfile } from './meetings';

export const CLIENT_PAGE_SIZE = 18;

export type ClientPlan = 'basic' | 'growth' | 'premium';
export type ClientStatus = 'active' | 'inactive' | 'trial';
export type ClientSyncState = 'synced' | 'pending' | 'error';
export type ClientEventType =
  | 'client_created'
  | 'client_updated'
  | 'client_deleted'
  | 'client_assigned'
  | 'client_status_changed';

export type TeamMemberSummary = {
  id: string;
  full_name?: string | null;
  avatar_url?: string | null;
  role?: string | null;
  email?: string | null;
};

export type ClientFormInput = {
  firm_name: string;
  location: string;
  website_url: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  plan_type: ClientPlan;
  status: ClientStatus;
  health_score: number;
  assigned_team_member_id: string | null;
  assigned_team_member_ids: string[];
  onboarding_date: string;
  notes: string;
  services: string[];
  password: string;
};

export type MobileClient = {
  id: string;
  name: string;
  firm_name: string;
  location: string | null;
  website_url: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  plan_type: ClientPlan;
  status: ClientStatus;
  health_score: number;
  task_score: number | null;
  conversion_score: number | null;
  seo_score: number | null;
  billing_score: number | null;
  total_health_score: number;
  assigned_to?: string | null;
  assigned_team_member_id?: string | null;
  assigned_team_members?: TeamMemberSummary[];
  onboarding_date: string | null;
  notes: string | null;
  services: string[];
  slug?: string | null;
  monthly_revenue?: number | null;
  tracking_id?: string | null;
  site_api_key?: string | null;
  connected_at?: string | null;
  created_at: string;
  updated_at: string;
  syncState?: ClientSyncState;
  keyMetrics?: {
    tasks: number;
    leads: number;
    invoices: number;
    keywords: number;
    siteViews: number;
    messages: number;
  };
};

export type ClientUpdateItem = {
  id: string;
  type: 'task' | 'lead' | 'invoice' | 'note' | 'status' | 'seo' | 'billing';
  title: string;
  description?: string | null;
  created_at: string;
  status?: string | null;
};

export type ClientDetailSnapshot = {
  client: MobileClient;
  teamMembers: TeamMemberSummary[];
  tasks: any[];
  leads: any[];
  keywords: any[];
  invoices: any[];
  siteAnalytics: any[];
  messages: any[];
  updates: ClientUpdateItem[];
  metrics: {
    tasks: number;
    openTasks: number;
    leads: number;
    invoices: number;
    overdueInvoices: number;
    keywords: number;
    siteViews: number;
    messages: number;
  };
  fetchedAt: string;
};

type RawClientRow = {
  id: string;
  firm_name?: string | null;
  location?: string | null;
  website_url?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  plan_type?: ClientPlan | null;
  status?: ClientStatus | null;
  health_score?: number | null;
  task_score?: number | null;
  conversion_score?: number | null;
  seo_score?: number | null;
  billing_score?: number | null;
  total_health_score?: number | null;
  assigned_to?: string | null;
  assigned_team_member_id?: string | null;
  onboarding_date?: string | null;
  notes?: string | null;
  services?: string[] | null;
  slug?: string | null;
  monthly_revenue?: number | null;
  tracking_id?: string | null;
  site_api_key?: string | null;
  connected_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export function buildClientSlug(firmName: string) {
  return firmName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function normalizeClientPlan(plan?: string | null): ClientPlan {
  const normalized = (plan || 'basic').toLowerCase();
  if (normalized === 'growth' || normalized === 'premium') return normalized;
  return 'basic';
}

export function normalizeClientStatus(status?: string | null): ClientStatus {
  const normalized = (status || 'active').toLowerCase();
  if (normalized === 'inactive' || normalized === 'trial') return normalized;
  return 'active';
}

export function getClientDisplayName(client: Pick<MobileClient, 'contact_name' | 'firm_name' | 'name'>) {
  return client.contact_name || client.name || client.firm_name || 'Client';
}

export function buildClientSearchValue(client: Pick<MobileClient, 'name' | 'firm_name' | 'contact_name' | 'contact_email' | 'contact_phone' | 'notes' | 'status' | 'plan_type' | 'location' | 'services'>) {
  return [
    client.name,
    client.firm_name,
    client.contact_name,
    client.contact_email,
    client.contact_phone,
    client.notes,
    client.location,
    client.status,
    client.plan_type,
    ...(client.services || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function sortClients(clients: MobileClient[]) {
  return [...clients].sort((left, right) => {
    const leftTime = new Date(left.updated_at || left.created_at).getTime();
    const rightTime = new Date(right.updated_at || right.created_at).getTime();
    return rightTime - leftTime;
  });
}

export function mergeClientCollections(current: MobileClient[], incoming: MobileClient[]) {
  const byId = new Map<string, MobileClient>();

  for (const client of current) {
    byId.set(client.id, client);
  }

  for (const client of incoming) {
    const previous = byId.get(client.id);
    byId.set(client.id, {
      ...previous,
      ...client,
      syncState: client.syncState ?? previous?.syncState ?? 'synced',
      keyMetrics: client.keyMetrics ?? previous?.keyMetrics,
    });
  }

  return sortClients(Array.from(byId.values()));
}

export function emptyClientForm(): ClientFormInput {
  return {
    firm_name: '',
    location: '',
    website_url: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    plan_type: 'basic',
    status: 'active',
    health_score: 50,
    assigned_team_member_id: null,
    assigned_team_member_ids: [],
    onboarding_date: new Date().toISOString().slice(0, 10),
    notes: '',
    services: [],
    password: '',
  };
}

export function mapClientRow(row: RawClientRow, assignedTeamMembers: TeamMemberSummary[] = []): MobileClient {
  const firmName = row.firm_name || 'Client';
  return {
    id: row.id,
    name: row.contact_name || firmName,
    firm_name: firmName,
    location: row.location || null,
    website_url: row.website_url || null,
    contact_name: row.contact_name || null,
    contact_email: row.contact_email || null,
    contact_phone: row.contact_phone || null,
    plan_type: normalizeClientPlan(row.plan_type),
    status: normalizeClientStatus(row.status),
    health_score: Number(row.health_score ?? 50),
    task_score: row.task_score ?? null,
    conversion_score: row.conversion_score ?? null,
    seo_score: row.seo_score ?? null,
    billing_score: row.billing_score ?? null,
    total_health_score: Number(row.total_health_score ?? row.health_score ?? 50),
    assigned_to: row.assigned_to || null,
    assigned_team_member_id: row.assigned_team_member_id || null,
    assigned_team_members: assignedTeamMembers,
    onboarding_date: row.onboarding_date || null,
    notes: row.notes || null,
    services: row.services || [],
    slug: row.slug || null,
    monthly_revenue: row.monthly_revenue ?? null,
    tracking_id: row.tracking_id || null,
    site_api_key: row.site_api_key || null,
    connected_at: row.connected_at || null,
    created_at: row.created_at || new Date().toISOString(),
    updated_at: row.updated_at || row.created_at || new Date().toISOString(),
    syncState: 'synced',
  };
}

export function isRetriableClientError(error: unknown) {
  const message =
    typeof error === 'string'
      ? error
      : error && typeof error === 'object' && 'message' in error
        ? String((error as any).message)
        : '';

  const normalized = message.toLowerCase();
  return (
    normalized.includes('network') ||
    normalized.includes('fetch') ||
    normalized.includes('timeout') ||
    normalized.includes('offline') ||
    normalized.includes('failed to fetch') ||
    normalized.includes('connection')
  );
}

export function canViewClient(profile: MobileProfile | null, client: MobileClient) {
  if (!profile) return false;
  const role = normalizeRole(profile.role);
  if (role === 'admin') return true;
  if (role === 'client') return profile.associated_client_id === client.id;
  if (['team', 'seo', 'content', 'developer'].includes(role)) {
    if (client.assigned_team_member_id === profile.id) return true;
    return (client.assigned_team_members || []).some((member) => member.id === profile.id);
  }
  return false;
}

export function canCreateClient(profile: MobileProfile | null) {
  if (!profile) return false;
  return normalizeRole(profile.role) === 'admin';
}

export function canEditClientCore(profile: MobileProfile | null, client?: MobileClient | null) {
  if (!profile) return false;
  const role = normalizeRole(profile.role);
  if (role === 'admin') return true;
  return false;
}

export function canEditClientNotes(profile: MobileProfile | null, client?: MobileClient | null) {
  if (!profile || !client) return false;
  const role = normalizeRole(profile.role);
  if (role === 'admin') return true;
  if (['team', 'seo', 'content', 'developer'].includes(role)) {
    return canViewClient(profile, client);
  }
  return false;
}

export function canEditClientStatus(profile: MobileProfile | null, client?: MobileClient | null) {
  return canEditClientNotes(profile, client);
}

export function canDeleteClient(profile: MobileProfile | null) {
  if (!profile) return false;
  return normalizeRole(profile.role) === 'admin';
}

export function getClientStatusTone(status: ClientStatus) {
  if (status === 'inactive') return { background: 'rgba(148, 163, 184, 0.14)', color: '#cbd5e1', border: 'rgba(148, 163, 184, 0.18)' };
  if (status === 'trial') return { background: 'rgba(251, 191, 36, 0.14)', color: '#fbbf24', border: 'rgba(251, 191, 36, 0.18)' };
  return { background: 'rgba(34, 197, 94, 0.14)', color: '#4ade80', border: 'rgba(34, 197, 94, 0.18)' };
}

export function getClientPlanTone(plan: ClientPlan) {
  if (plan === 'premium') return { background: 'rgba(133, 173, 255, 0.14)', color: '#85adff', border: 'rgba(133, 173, 255, 0.2)' };
  if (plan === 'growth') return { background: 'rgba(144, 147, 255, 0.14)', color: '#9093ff', border: 'rgba(144, 147, 255, 0.2)' };
  return { background: 'rgba(255, 255, 255, 0.04)', color: '#a6aabc', border: 'rgba(255, 255, 255, 0.06)' };
}
