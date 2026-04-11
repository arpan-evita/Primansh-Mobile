import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import {
  CheckCircle2,
  Clock3,
  CreditCard,
  ExternalLink,
  IndianRupee,
  ReceiptText,
  Search,
  Send,
  X,
} from 'lucide-react-native';

import { GlassCard } from '../../components/ui/GlassCard';
import { getCurrentMobileProfile, normalizeRole, type MobileProfile } from '../../lib/meetings';
import { extractOfflineErrorMessage, isRetriableOfflineError, scopedStorageKey } from '../../lib/offline';
import { supabase } from '../../lib/supabase';
import { Colors, Fonts } from '../../lib/theme';

type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled' | 'pending';
type DisplayInvoiceStatus = 'paid' | 'overdue' | 'pending';

type InvoiceItem = {
  description?: string;
  quantity?: number;
  rate?: number;
};

type InvoiceRow = {
  id: string;
  invoice_number?: string | null;
  client_id: string;
  amount: number | string;
  status: InvoiceStatus;
  issued_date?: string | null;
  due_date?: string | null;
  paid_date?: string | null;
  sent_at?: string | null;
  notes?: string | null;
  items?: InvoiceItem[] | null;
  subtotal?: number | string | null;
  tax_rate?: number | string | null;
  created_at?: string | null;
  client?: { firm_name?: string | null } | { firm_name?: string | null }[] | null;
};

function formatCurrency(value: number | string | null | undefined) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function unwrapClientName(invoice: InvoiceRow) {
  if (Array.isArray(invoice.client)) return invoice.client[0]?.firm_name || 'Client';
  return invoice.client?.firm_name || 'Client';
}

function getDisplayStatus(invoice: InvoiceRow): DisplayInvoiceStatus {
  if (invoice.status === 'paid') return 'paid';
  if (invoice.status === 'overdue') return 'overdue';

  if (invoice.due_date) {
    const dueDate = new Date(invoice.due_date);
    const today = new Date();
    if (dueDate.getTime() < new Date(today.toDateString()).getTime()) {
      return 'overdue';
    }
  }

  return 'pending';
}

function canManageInvoices(profile: MobileProfile | null) {
  const role = normalizeRole(profile?.role || 'client');
  return role === 'admin';
}

function canViewAllInvoices(profile: MobileProfile | null) {
  const role = normalizeRole(profile?.role || 'client');
  return role === 'admin';
}

function isAssignedStaffRole(profile: MobileProfile | null) {
  const role = normalizeRole(profile?.role || 'client');
  return ['team', 'seo', 'content', 'developer'].includes(role);
}

function getPortalInvoiceUrl(invoice: InvoiceRow, download = false) {
  const baseUrl = `https://primansh.com/clientportal/${invoice.client_id}/invoice/${invoice.id}`;
  return download ? `${baseUrl}?download=1&source=mobile` : baseUrl;
}

const BILLING_CACHE_KEY = 'primansh_mobile_billing_cache_v1';
const BILLING_QUEUE_KEY = 'primansh_mobile_billing_queue_v1';

type PendingBillingOperation = {
  id: string;
  type: 'update_invoice_status';
  invoiceId: string;
  nextStatus: InvoiceStatus;
  paidDate: string | null;
  createdAt: string;
};

type BillingCacheSnapshot = {
  invoices: InvoiceRow[];
  lastSyncedAt?: string | null;
};

export default function LiveBillingScreen() {
  const [profile, setProfile] = useState<MobileProfile | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | InvoiceStatus>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRow | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [pendingQueue, setPendingQueue] = useState<PendingBillingOperation[]>([]);
  const [flushingQueue, setFlushingQueue] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const queueRef = useRef<PendingBillingOperation[]>([]);
  const invoicesRef = useRef<InvoiceRow[]>([]);
  const profileRef = useRef<MobileProfile | null>(null);
  const lastSyncedAtRef = useRef<string | null>(null);
  const storageOwnerIdRef = useRef<string | null>(null);
  const cacheHydratedRef = useRef(false);
  const flushingRef = useRef(false);

  useEffect(() => {
    queueRef.current = pendingQueue;
  }, [pendingQueue]);

  useEffect(() => {
    invoicesRef.current = invoices;
  }, [invoices]);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    lastSyncedAtRef.current = lastSyncedAt;
  }, [lastSyncedAt]);

  const persistState = useCallback(
    async (
      ownerId: string | null = storageOwnerIdRef.current,
      nextInvoices: InvoiceRow[] = invoicesRef.current,
      nextQueue: PendingBillingOperation[] = queueRef.current,
      nextSyncedAt: string | null = lastSyncedAtRef.current
    ) => {
      if (!ownerId) return;

      const snapshot: BillingCacheSnapshot = {
        invoices: nextInvoices,
        lastSyncedAt: nextSyncedAt,
      };

      await Promise.all([
        AsyncStorage.setItem(scopedStorageKey(BILLING_CACHE_KEY, ownerId), JSON.stringify(snapshot)),
        AsyncStorage.setItem(scopedStorageKey(BILLING_QUEUE_KEY, ownerId), JSON.stringify(nextQueue)),
      ]);
    },
    []
  );

  const loadCachedState = useCallback(async (currentProfile: MobileProfile | null) => {
    const ownerId = currentProfile?.id || null;

    if (cacheHydratedRef.current && storageOwnerIdRef.current === ownerId) {
      return;
    }

    storageOwnerIdRef.current = ownerId;
    cacheHydratedRef.current = true;

    if (!ownerId) {
      setPendingQueue([]);
      queueRef.current = [];
      setLastSyncedAt(null);
      return;
    }

    const [cacheValue, queueValue] = await Promise.all([
      AsyncStorage.getItem(scopedStorageKey(BILLING_CACHE_KEY, ownerId)),
      AsyncStorage.getItem(scopedStorageKey(BILLING_QUEUE_KEY, ownerId)),
    ]);

    if (cacheValue) {
      try {
        const parsed = JSON.parse(cacheValue) as BillingCacheSnapshot;
        setInvoices(Array.isArray(parsed.invoices) ? parsed.invoices : []);
        setLastSyncedAt(parsed.lastSyncedAt || null);
      } catch {
        setInvoices([]);
        setLastSyncedAt(null);
      }
    }

    if (queueValue) {
      try {
        const parsedQueue = JSON.parse(queueValue) as PendingBillingOperation[];
        const nextQueue = Array.isArray(parsedQueue) ? parsedQueue : [];
        setPendingQueue(nextQueue);
        queueRef.current = nextQueue;
      } catch {
        setPendingQueue([]);
        queueRef.current = [];
      }
    } else {
      setPendingQueue([]);
      queueRef.current = [];
    }
  }, []);

  const enqueueOperation = useCallback(
    async (operation: PendingBillingOperation) => {
      const nextQueue = [...queueRef.current, operation];
      setPendingQueue(nextQueue);
      queueRef.current = nextQueue;
      await persistState();
    },
    [persistState]
  );

  const loadInvoices = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setRefreshing(!showLoader);

    try {
      const currentProfile = await getCurrentMobileProfile().catch(() => null);
      setProfile(currentProfile);

      if (!currentProfile) {
        setInvoices([]);
        setPendingQueue([]);
        setLastSyncedAt(null);
        queueRef.current = [];
        cacheHydratedRef.current = false;
        storageOwnerIdRef.current = null;
        return;
      }

      await loadCachedState(currentProfile);

      let query = supabase
        .from('invoices')
        .select('id, invoice_number, client_id, amount, status, issued_date, due_date, paid_date, sent_at, notes, items, subtotal, tax_rate, created_at, client:clients(firm_name)')
        .order('created_at', { ascending: false })
        .limit(100);

      if (!canViewAllInvoices(currentProfile)) {
        const normalizedRole = normalizeRole(currentProfile.role || 'client');

        if (normalizedRole === 'client') {
          if (!currentProfile.associated_client_id) {
            setInvoices([]);
            return;
          }

          query = query.eq('client_id', currentProfile.associated_client_id);
        } else if (isAssignedStaffRole(currentProfile)) {
          const { data: assignments, error: assignmentsError } = await supabase
            .from('team_assigned_clients')
            .select('client_id')
            .eq('team_member_id', currentProfile.id);

          if (assignmentsError) throw assignmentsError;

          const assignedClientIds = (assignments || []).map((item) => item.client_id).filter(Boolean);
          if (!assignedClientIds.length) {
            setInvoices([]);
            return;
          }

          query = query.in('client_id', assignedClientIds);
        }
      }

      const { data, error } = await query;

      if (error) throw error;
      const nextInvoices = (data || []) as unknown as InvoiceRow[];
      setInvoices(nextInvoices);
      const syncedAt = new Date().toISOString();
      setLastSyncedAt(syncedAt);
      await persistState(currentProfile.id, nextInvoices, queueRef.current, syncedAt);
    } catch (error: any) {
      console.error('[MobileBilling] load failed', error);
      if (showLoader && !isRetriableOfflineError(error)) {
        Alert.alert('Billing unavailable', extractOfflineErrorMessage(error, 'Could not load invoice data right now.'));
      } else if (showLoader && isRetriableOfflineError(error) && invoicesRef.current.length > 0) {
        Alert.alert('Offline Mode', 'Showing last synced invoices while connectivity is restored.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadCachedState, persistState]);

  useEffect(() => {
    void loadInvoices(true);
  }, [loadInvoices]);

  useEffect(() => {
    if (!profile?.id) return;

    const channel = supabase
      .channel(`mobile-billing:${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => {
        void loadInvoices(false);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadInvoices, profile?.id]);

  const openInvoice = useCallback(async (invoice: InvoiceRow, download = false) => {
    try {
      await WebBrowser.openBrowserAsync(getPortalInvoiceUrl(invoice, download));
    } catch (error: any) {
      Alert.alert('Open Failed', error?.message || 'The invoice could not be opened right now.');
    }
  }, []);

  const retryPendingQueue = useCallback(async () => {
    if (flushingRef.current || queueRef.current.length === 0) return;

    const currentProfile = profileRef.current || (await getCurrentMobileProfile().catch(() => null));
    if (!currentProfile) return;

    flushingRef.current = true;
    setFlushingQueue(true);

    try {
      let nextQueue = [...queueRef.current];
      let syncedAt = lastSyncedAtRef.current;
      let nextInvoices = [...invoicesRef.current];

      for (const operation of queueRef.current) {
        try {
          if (operation.type === 'update_invoice_status') {
            const { error } = await supabase
              .from('invoices')
              .update({
                status: operation.nextStatus,
                paid_date: operation.paidDate,
              })
              .eq('id', operation.invoiceId);

            if (error) throw error;

            nextQueue = nextQueue.filter((item) => item.id !== operation.id);
            syncedAt = new Date().toISOString();
            nextInvoices = nextInvoices.map((item) =>
              item.id === operation.invoiceId
                ? { ...item, status: operation.nextStatus, paid_date: operation.paidDate }
                : item
            );
          }
        } catch (error) {
          if (isRetriableOfflineError(error)) {
            break;
          }

          console.error('[MobileBilling] dropping non-retriable queued operation', error);
          nextQueue = nextQueue.filter((item) => item.id !== operation.id);
        }
      }

      setInvoices(nextInvoices);
      setPendingQueue(nextQueue);
      queueRef.current = nextQueue;
      if (syncedAt) {
        setLastSyncedAt(syncedAt);
      }
      await persistState(currentProfile.id, nextInvoices, nextQueue, syncedAt);
    } finally {
      flushingRef.current = false;
      setFlushingQueue(false);
    }
  }, [persistState]);

  useEffect(() => {
    if (!profile?.id) return;

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void retryPendingQueue();
      }
    });

    const intervalId = setInterval(() => {
      void retryPendingQueue();
    }, 20000);

    return () => {
      subscription.remove();
      clearInterval(intervalId);
    };
  }, [profile?.id, retryPendingQueue]);

  useEffect(() => {
    if (pendingQueue.length === 0) return;
    void retryPendingQueue();
  }, [pendingQueue.length, retryPendingQueue]);

  const filteredInvoices = useMemo(() => {
    const term = search.trim().toLowerCase();
    return invoices.filter((invoice) => {
      const displayStatus = getDisplayStatus(invoice);
      const matchesFilter = filter === 'all' || displayStatus === filter;
      const matchesSearch =
        !term ||
        (invoice.invoice_number || '').toLowerCase().includes(term) ||
        unwrapClientName(invoice).toLowerCase().includes(term);
      return matchesFilter && matchesSearch;
    });
  }, [filter, invoices, search]);

  const stats = useMemo(() => {
    const total = invoices.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);
    const paid = invoices
      .filter((invoice) => getDisplayStatus(invoice) === 'paid')
      .reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);
    const pending = invoices
      .filter((invoice) => getDisplayStatus(invoice) === 'pending')
      .reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);
    const overdue = invoices
      .filter((invoice) => getDisplayStatus(invoice) === 'overdue')
      .reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);

    return { total, paid, pending, overdue };
  }, [invoices]);

  const toggleInvoiceStatus = useCallback(
    async (invoice: InvoiceRow) => {
      if (!canManageInvoices(profile)) return;

      const nextStatus: InvoiceStatus = getDisplayStatus(invoice) === 'paid' ? 'pending' : 'paid';
      const nextPaidDate = nextStatus === 'paid' ? new Date().toISOString().split('T')[0] : null;
      const previousStatus = invoice.status;
      const previousPaidDate = invoice.paid_date || null;
      setUpdatingStatus(invoice.id);
      setInvoices((current) =>
        current.map((item) =>
          item.id === invoice.id ? { ...item, status: nextStatus, paid_date: nextPaidDate } : item
        )
      );

      try {
        const { error } = await supabase
          .from('invoices')
          .update({
            status: nextStatus,
            paid_date: nextPaidDate,
          })
          .eq('id', invoice.id);

        if (error) throw error;
        const syncedAt = new Date().toISOString();
        setLastSyncedAt(syncedAt);
        await persistState(storageOwnerIdRef.current, undefined, undefined, syncedAt);
      } catch (error: any) {
        if (isRetriableOfflineError(error)) {
          await enqueueOperation({
            id: `queue-${Date.now()}`,
            type: 'update_invoice_status',
            invoiceId: invoice.id,
            nextStatus,
            paidDate: nextPaidDate,
            createdAt: new Date().toISOString(),
          });
          Alert.alert('Queued Offline', 'Invoice status update will sync automatically when network returns.');
        } else {
          console.error('[MobileBilling] toggle status failed', error);
          setInvoices((current) =>
            current.map((item) =>
              item.id === invoice.id
                ? { ...item, status: previousStatus, paid_date: previousPaidDate }
                : item
            )
          );
          Alert.alert(
            'Update Failed',
            extractOfflineErrorMessage(error, 'Invoice status could not be updated right now.')
          );
        }
      } finally {
        setUpdatingStatus(null);
      }
    },
    [enqueueOperation, persistState, profile]
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loadingText}>Loading invoice data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void loadInvoices(false)} tintColor={Colors.accent} />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Billing & Invoices</Text>
            <Text style={styles.subtitle}>
              Live invoice visibility synced across the admin panel and client portal.
            </Text>
            <Text style={styles.syncHint}>
              {flushingQueue
                ? 'Syncing queued invoice updates...'
                : pendingQueue.length > 0
                  ? `${pendingQueue.length} invoice update${pendingQueue.length > 1 ? 's' : ''} queued offline`
                  : lastSyncedAt
                    ? `Last sync ${new Date(lastSyncedAt).toLocaleTimeString()}`
                    : 'Waiting for first sync'}
            </Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <StatsCard icon={ReceiptText} label="Invoiced" value={formatCurrency(stats.total)} accent="#85adff" />
          <StatsCard icon={CheckCircle2} label="Paid" value={formatCurrency(stats.paid)} accent="#10b981" />
          <StatsCard icon={Clock3} label="Pending" value={formatCurrency(stats.pending)} accent="#f59e0b" />
          <StatsCard icon={IndianRupee} label="Overdue" value={formatCurrency(stats.overdue)} accent="#ef4444" />
        </View>

        <GlassCard style={styles.searchCard} intensity={28}>
          <View style={styles.searchRow}>
            <Search color={Colors.slate500} size={18} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search invoices or clients..."
              placeholderTextColor={Colors.slate500}
              style={styles.searchInput}
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            <FilterChip label="All" active={filter === 'all'} onPress={() => setFilter('all')} />
            <FilterChip label="Paid" active={filter === 'paid'} onPress={() => setFilter('paid')} />
            <FilterChip label="Pending" active={filter === 'pending'} onPress={() => setFilter('pending')} />
            <FilterChip label="Overdue" active={filter === 'overdue'} onPress={() => setFilter('overdue')} />
          </ScrollView>
        </GlassCard>

        <View style={styles.invoiceList}>
          {filteredInvoices.length === 0 ? (
            <GlassCard style={styles.emptyCard} intensity={24}>
              <CreditCard color={Colors.slate500} size={28} />
              <Text style={styles.emptyTitle}>No invoices found</Text>
              <Text style={styles.emptyText}>Billing records that match your access scope will appear here.</Text>
            </GlassCard>
          ) : (
            filteredInvoices.map((invoice) => {
              const displayStatus = getDisplayStatus(invoice);
              const statusStyle = STATUS_STYLES[displayStatus];

              return (
                <GlassCard key={invoice.id} style={styles.invoiceCard} intensity={26}>
                  <TouchableOpacity activeOpacity={0.9} onPress={() => setSelectedInvoice(invoice)}>
                    <View style={styles.invoiceHeader}>
                      <View style={styles.invoiceTitleWrap}>
                        <Text style={styles.invoiceNumber}>
                          {invoice.invoice_number || `INV-${invoice.id.slice(0, 8)}`}
                        </Text>
                        <Text style={styles.invoiceClient}>{unwrapClientName(invoice)}</Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: statusStyle.background }]}>
                        <Text style={[styles.statusBadgeText, { color: statusStyle.color }]}>{displayStatus}</Text>
                      </View>
                    </View>

                    <View style={styles.invoiceMetaRow}>
                      <Text style={styles.invoiceAmount}>{formatCurrency(invoice.amount)}</Text>
                      <Text style={styles.invoiceDate}>
                        Due {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : 'on receipt'}
                      </Text>
                    </View>

                    <View style={styles.invoiceFooter}>
                      <View style={styles.footerBadge}>
                        <Send color={invoice.sent_at ? '#10b981' : Colors.slate500} size={14} />
                        <Text style={styles.footerBadgeText}>
                          {invoice.sent_at ? `Sent ${new Date(invoice.sent_at).toLocaleDateString()}` : 'Draft / unsent'}
                        </Text>
                      </View>

                      <View style={styles.footerActions}>
                        <TouchableOpacity
                          activeOpacity={0.9}
                          onPress={() => void openInvoice(invoice, false)}
                          style={styles.openAction}
                        >
                          <ExternalLink color="#cbd5e1" size={14} />
                          <Text style={styles.openActionText}>Open</Text>
                        </TouchableOpacity>

                        {canManageInvoices(profile) ? (
                          <TouchableOpacity
                            activeOpacity={0.9}
                            disabled={updatingStatus === invoice.id}
                            onPress={() => void toggleInvoiceStatus(invoice)}
                            style={[styles.statusAction, displayStatus === 'paid' && styles.statusActionPaid]}
                          >
                            {updatingStatus === invoice.id ? (
                              <ActivityIndicator size="small" color={displayStatus === 'paid' ? '#fff' : '#020617'} />
                            ) : (
                              <Text
                                style={[
                                  styles.statusActionText,
                                  displayStatus === 'paid' && styles.statusActionTextPaid,
                                ]}
                              >
                                {displayStatus === 'paid' ? 'Set Pending' : 'Mark Paid'}
                              </Text>
                            )}
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>
                  </TouchableOpacity>
                </GlassCard>
              );
            })
          )}
        </View>
      </ScrollView>

      <Modal visible={!!selectedInvoice} transparent animationType="slide" onRequestClose={() => setSelectedInvoice(null)}>
        <View style={styles.modalScrim}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {selectedInvoice?.invoice_number || (selectedInvoice ? selectedInvoice.id.slice(0, 8) : '')}
                </Text>
                <Text style={styles.modalSubtitle}>{selectedInvoice ? unwrapClientName(selectedInvoice) : ''}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedInvoice(null)} style={styles.modalClose}>
                <X color="#e2e8f0" size={18} />
              </TouchableOpacity>
            </View>

            {selectedInvoice ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.detailGrid}>
                  <DetailRow label="Subtotal" value={formatCurrency(selectedInvoice.subtotal)} />
                  <DetailRow label="Tax Rate" value={`${selectedInvoice.tax_rate || 18}%`} />
                  <DetailRow 
                    label="Tax Amount" 
                    value={formatCurrency((Number(selectedInvoice.subtotal || 0) * Number(selectedInvoice.tax_rate || 18)) / 100)} 
                  />
                  <DetailRow label="Total Amount" value={formatCurrency(selectedInvoice.amount)} />
                  <DetailRow label="Status" value={getDisplayStatus(selectedInvoice)} />
                  <DetailRow label="Due Date" value={selectedInvoice.due_date ? new Date(selectedInvoice.due_date).toLocaleDateString() : 'N/A'} />
                  {selectedInvoice.paid_date && <DetailRow label="Paid On" value={new Date(selectedInvoice.paid_date).toLocaleDateString()} />}
                </View>

                <Text style={styles.sectionLabel}>Line Items</Text>
                {Array.isArray(selectedInvoice.items) && selectedInvoice.items.length > 0 ? (
                  selectedInvoice.items.map((item, index) => (
                    <View key={`${selectedInvoice.id}-item-${index}`} style={styles.itemRow}>
                      <View style={styles.itemCopy}>
                        <Text style={styles.itemTitle}>{item.description || 'Service item'}</Text>
                        <Text style={styles.itemMeta}>
                          Qty {item.quantity || 1} × {formatCurrency(item.rate || 0)}
                        </Text>
                      </View>
                      <Text style={styles.itemTotal}>
                        {formatCurrency((item.quantity || 1) * Number(item.rate || 0))}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.notesText}>No line items were attached to this invoice.</Text>
                )}

                <Text style={styles.sectionLabel}>Notes</Text>
                <Text style={styles.notesText}>
                  {selectedInvoice.notes?.trim() || 'No internal notes or payment remarks on this invoice.'}
                </Text>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    style={styles.modalSecondaryButton}
                    onPress={() => void openInvoice(selectedInvoice, false)}
                  >
                    <ExternalLink color="#e2e8f0" size={16} />
                    <Text style={styles.modalSecondaryButtonText}>Open Invoice</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.9}
                    style={styles.modalPrimaryButton}
                    onPress={() => void openInvoice(selectedInvoice, true)}
                  >
                    <ReceiptText color="#020617" size={16} />
                    <Text style={styles.modalPrimaryButtonText}>Download PDF</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function StatsCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: any;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <GlassCard style={styles.statsCard} intensity={24}>
      <View style={[styles.statsIconWrap, { backgroundColor: `${accent}18` }]}>
        <Icon color={accent} size={18} />
      </View>
      <Text style={styles.statsLabel}>{label}</Text>
      <Text style={styles.statsValue}>{value}</Text>
    </GlassCard>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={[styles.filterChip, active && styles.filterChipActive]}
    >
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const STATUS_STYLES: Record<DisplayInvoiceStatus, { background: string; color: string }> = {
  paid: { background: 'rgba(16, 185, 129, 0.16)', color: '#34d399' },
  pending: { background: 'rgba(245, 158, 11, 0.16)', color: '#fbbf24' },
  overdue: { background: 'rgba(239, 68, 68, 0.16)', color: '#f87171' },
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 120,
    gap: 18,
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontFamily: Fonts.Outfit_500Medium,
    fontSize: 14,
    color: Colors.slate500,
  },
  header: {
    gap: 6,
  },
  headerCopy: {
    gap: 6,
  },
  title: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 28,
    color: '#fff',
  },
  subtitle: {
    fontFamily: Fonts.Outfit_400Regular,
    fontSize: 13,
    lineHeight: 20,
    color: Colors.slate500,
  },
  syncHint: {
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 10,
    color: '#64748b',
    letterSpacing: 0.8,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statsCard: {
    width: '48.2%',
    minHeight: 120,
  },
  statsIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  statsLabel: {
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 10,
    color: Colors.slate500,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  statsValue: {
    marginTop: 6,
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 20,
    color: '#fff',
  },
  searchCard: {
    gap: 14,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  searchInput: {
    flex: 1,
    minHeight: 42,
    color: '#fff',
    fontFamily: Fonts.Outfit_400Regular,
    fontSize: 14,
  },
  filterRow: {
    gap: 8,
    paddingRight: 20,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  filterChipActive: {
    backgroundColor: '#85adff',
    borderColor: '#85adff',
  },
  filterChipText: {
    fontFamily: Fonts.Outfit_600SemiBold,
    fontSize: 12,
    color: '#cbd5e1',
  },
  filterChipTextActive: {
    color: '#020617',
  },
  invoiceList: {
    gap: 12,
  },
  invoiceCard: {
    paddingVertical: 8,
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
  },
  invoiceTitleWrap: {
    flex: 1,
    gap: 4,
  },
  invoiceNumber: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 16,
    color: '#fff',
  },
  invoiceClient: {
    fontFamily: Fonts.Outfit_400Regular,
    fontSize: 13,
    color: Colors.slate500,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusBadgeText: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 11,
    textTransform: 'uppercase',
  },
  invoiceMetaRow: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'baseline',
  },
  invoiceAmount: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 22,
    color: '#85adff',
  },
  invoiceDate: {
    fontFamily: Fonts.Outfit_400Regular,
    fontSize: 12,
    color: Colors.slate500,
  },
  invoiceFooter: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    alignItems: 'center',
  },
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  footerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerBadgeText: {
    fontFamily: Fonts.Outfit_400Regular,
    fontSize: 12,
    color: Colors.slate500,
  },
  openAction: {
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  openActionText: {
    fontFamily: Fonts.Outfit_600SemiBold,
    fontSize: 12,
    color: '#cbd5e1',
  },
  statusAction: {
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#85adff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusActionPaid: {
    backgroundColor: 'rgba(239,68,68,0.2)',
  },
  statusActionText: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 12,
    color: '#020617',
  },
  statusActionTextPaid: {
    color: '#fff',
  },
  emptyCard: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 36,
  },
  emptyTitle: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 16,
    color: '#fff',
  },
  emptyText: {
    fontFamily: Fonts.Outfit_400Regular,
    fontSize: 13,
    lineHeight: 20,
    color: Colors.slate500,
    textAlign: 'center',
  },
  modalScrim: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.72)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    maxHeight: '88%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: '#0f172a',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
    gap: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
  },
  modalTitle: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 20,
    color: '#fff',
  },
  modalSubtitle: {
    marginTop: 4,
    fontFamily: Fonts.Outfit_400Regular,
    fontSize: 12,
    color: Colors.slate500,
  },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailGrid: {
    gap: 10,
    marginBottom: 18,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
  },
  detailLabel: {
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 10,
    color: Colors.slate500,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  detailValue: {
    fontFamily: Fonts.Outfit_600SemiBold,
    fontSize: 14,
    color: '#fff',
  },
  sectionLabel: {
    marginBottom: 10,
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 10,
    color: Colors.slate500,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  itemCopy: {
    flex: 1,
    gap: 4,
  },
  itemTitle: {
    fontFamily: Fonts.Outfit_600SemiBold,
    fontSize: 14,
    color: '#fff',
  },
  itemMeta: {
    fontFamily: Fonts.Outfit_400Regular,
    fontSize: 12,
    color: Colors.slate500,
  },
  itemTotal: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 14,
    color: '#85adff',
  },
  notesText: {
    fontFamily: Fonts.Outfit_400Regular,
    fontSize: 13,
    lineHeight: 20,
    color: '#cbd5e1',
    marginBottom: 12,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
    marginBottom: 12,
  },
  modalSecondaryButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  modalSecondaryButtonText: {
    fontFamily: Fonts.Outfit_600SemiBold,
    fontSize: 13,
    color: '#e2e8f0',
  },
  modalPrimaryButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: '#85adff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  modalPrimaryButtonText: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 13,
    color: '#020617',
  },
});
