import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
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
import * as Linking from 'expo-linking';
import {
  Download,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Lock,
  Search,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react-native';

import { GlassCard } from '../../components/ui/GlassCard';
import { getCurrentMobileProfile, normalizeRole, type MobileProfile } from '../../lib/meetings';
import { extractOfflineErrorMessage, isRetriableOfflineError, scopedStorageKey } from '../../lib/offline';
import { supabase } from '../../lib/supabase';
import { Colors, Fonts } from '../../lib/theme';

type DocumentType = 'asset' | 'credentials' | 'report';

type VisibilityType = 'admin' | 'team' | 'client';

type ClientOption = {
  id: string;
  firm_name: string;
};

type TaskOption = {
  id: string;
  title: string;
};

type ClientDocument = {
  id: string;
  name: string;
  type: DocumentType;
  client_id: string;
  linked_task_id?: string | null;
  visibility: VisibilityType;
  file_path: string;
  size: number;
  secure: boolean;
  created_at: string;
  mime_type?: string | null;
  uploaded_by?: string | null;
  client?: { firm_name?: string | null } | { firm_name?: string | null }[] | null;
  task?: { title?: string | null } | null;
};

const DOCUMENT_BUCKET = 'client-documents';
const MAX_DOCUMENT_SIZE_BYTES = 50 * 1024 * 1024;
const DOCUMENT_CACHE_KEY = 'primansh_mobile_documents_cache_v1';
const DOCUMENT_QUEUE_KEY = 'primansh_mobile_documents_queue_v1';
const DOCUMENT_TYPES: { value: DocumentType; label: string }[] = [
  { value: 'asset', label: 'Assets' },
  { value: 'credentials', label: 'Credentials' },
  { value: 'report', label: 'Reports' },
];

const VISIBILITY_OPTIONS: { value: VisibilityType; label: string }[] = [
  { value: 'client', label: 'Client (Public)' },
  { value: 'team', label: 'Team Only' },
  { value: 'admin', label: 'Admin Only' },
];

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'application/x-zip-compressed',
  'text/plain',
];

type QueuedDocumentUpload = {
  id: string;
  type: 'upload_document';
  createdAt: string;
  payload: {
    name: string;
    type: DocumentType;
    client_id: string;
    linked_task_id: string | null;
    visibility: VisibilityType;
    secure: boolean;
    mime_type: string | null;
    size: number;
    uploaded_by: string;
  };
  asset: {
    uri: string;
    name: string;
    mimeType: string | null;
    size: number;
  };
};

type DocumentsCacheSnapshot = {
  documents: ClientDocument[];
  clients: ClientOption[];
  lastSyncedAt?: string | null;
};

function base64ToArrayBuffer(base64: string) {
  const cleanBase64 = base64.includes(',') ? base64.split(',').pop() || '' : base64;
  const binaryString = globalThis.atob(cleanBase64);
  const bytes = new Uint8Array(binaryString.length);

  for (let index = 0; index < binaryString.length; index += 1) {
    bytes[index] = binaryString.charCodeAt(index);
  }

  return bytes.buffer;
}

function sanitizeFileName(name: string) {
  return name.replace(/[^\w.\-]+/g, '_');
}

async function persistAssetForOffline(asset: DocumentPicker.DocumentPickerAsset) {
  const targetUri = `${FileSystem.documentDirectory || FileSystem.cacheDirectory}${Date.now()}_${sanitizeFileName(asset.name)}`;
  await FileSystem.copyAsync({
    from: asset.uri,
    to: targetUri,
  });
  return {
    uri: targetUri,
    name: asset.name,
    mimeType: asset.mimeType || null,
    size: asset.size || 0,
  };
}

function formatBytes(bytes: number) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

function unwrapClientName(document: ClientDocument) {
  if (Array.isArray(document.client)) {
    return document.client[0]?.firm_name || 'Client';
  }
  return document.client?.firm_name || 'Client';
}

function canUploadDocuments(profile: MobileProfile | null) {
  const role = normalizeRole(profile?.role || 'client');
  return ['admin', 'team', 'seo', 'content', 'developer'].includes(role);
}

function isAllowedMimeType(mimeType?: string | null) {
  if (!mimeType) return true;
  if (ALLOWED_MIME_TYPES.includes(mimeType)) return true;
  return mimeType.startsWith('image/');
}

function getDocumentMeta(document: ClientDocument) {
  const mimeType = document.mime_type || '';

  if (mimeType.startsWith('image/')) {
    return { Icon: FileImage, color: '#60a5fa', badge: 'Image' };
  }

  if (mimeType.includes('sheet') || mimeType.includes('excel')) {
    return { Icon: FileSpreadsheet, color: '#22c55e', badge: 'Sheet' };
  }

  if (mimeType.includes('zip') || mimeType.includes('compressed')) {
    return { Icon: FileArchive, color: '#a78bfa', badge: 'Archive' };
  }

  return { Icon: FileText, color: '#f59e0b', badge: document.type === 'credentials' ? 'Secure' : 'Doc' };
}

export default function LiveDocumentsScreen() {
  const [profile, setProfile] = useState<MobileProfile | null>(null);
  const [documents, setDocuments] = useState<ClientDocument[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [availableTasks, setAvailableTasks] = useState<TaskOption[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedTaskId, setSelectedTaskId] = useState<string>('none');
  const [selectedType, setSelectedType] = useState<DocumentType>('asset');
  const [visibility, setVisibility] = useState<VisibilityType>('client');
  const [secureUpload, setSecureUpload] = useState(false);
  const [pickedAsset, setPickedAsset] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | DocumentType>('all');
  const [taskFilter, setTaskFilter] = useState<'all' | string>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [pendingQueue, setPendingQueue] = useState<QueuedDocumentUpload[]>([]);
  const [flushingQueue, setFlushingQueue] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const queueRef = useRef<QueuedDocumentUpload[]>([]);
  const documentsRef = useRef<ClientDocument[]>([]);
  const clientsRef = useRef<ClientOption[]>([]);
  const profileRef = useRef<MobileProfile | null>(null);
  const lastSyncedAtRef = useRef<string | null>(null);
  const storageOwnerIdRef = useRef<string | null>(null);
  const cacheHydratedRef = useRef(false);
  const flushingRef = useRef(false);

  useEffect(() => {
    queueRef.current = pendingQueue;
  }, [pendingQueue]);

  useEffect(() => {
    documentsRef.current = documents;
  }, [documents]);

  useEffect(() => {
    clientsRef.current = clients;
  }, [clients]);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    lastSyncedAtRef.current = lastSyncedAt;
  }, [lastSyncedAt]);

  const persistState = useCallback(
    async (
      ownerId: string | null = storageOwnerIdRef.current,
      nextDocuments: ClientDocument[] = documentsRef.current,
      nextClients: ClientOption[] = clientsRef.current,
      nextQueue: QueuedDocumentUpload[] = queueRef.current,
      nextSyncedAt: string | null = lastSyncedAtRef.current
    ) => {
      if (!ownerId) return;

      const snapshot: DocumentsCacheSnapshot = {
        documents: nextDocuments,
        clients: nextClients,
        lastSyncedAt: nextSyncedAt,
      };

      await Promise.all([
        AsyncStorage.setItem(scopedStorageKey(DOCUMENT_CACHE_KEY, ownerId), JSON.stringify(snapshot)),
        AsyncStorage.setItem(scopedStorageKey(DOCUMENT_QUEUE_KEY, ownerId), JSON.stringify(nextQueue)),
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
      AsyncStorage.getItem(scopedStorageKey(DOCUMENT_CACHE_KEY, ownerId)),
      AsyncStorage.getItem(scopedStorageKey(DOCUMENT_QUEUE_KEY, ownerId)),
    ]);

    if (cacheValue) {
      try {
        const parsed = JSON.parse(cacheValue) as DocumentsCacheSnapshot;
        setDocuments(Array.isArray(parsed.documents) ? parsed.documents : []);
        setClients(Array.isArray(parsed.clients) ? parsed.clients : []);
        setLastSyncedAt(parsed.lastSyncedAt || null);
      } catch {
        setDocuments([]);
        setClients([]);
        setLastSyncedAt(null);
      }
    }

    if (queueValue) {
      try {
        const parsedQueue = JSON.parse(queueValue) as QueuedDocumentUpload[];
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
    async (operation: QueuedDocumentUpload) => {
      const nextQueue = [...queueRef.current, operation];
      setPendingQueue(nextQueue);
      queueRef.current = nextQueue;
      await persistState();
    },
    [persistState]
  );

  const loadData = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setRefreshing(!showLoader);

    try {
      const currentProfile = await getCurrentMobileProfile().catch(() => null);
      setProfile(currentProfile);

      if (!currentProfile) {
        setDocuments([]);
        setClients([]);
        setPendingQueue([]);
        setLastSyncedAt(null);
        queueRef.current = [];
        cacheHydratedRef.current = false;
        storageOwnerIdRef.current = null;
        return;
      }

      await loadCachedState(currentProfile);

      const [docsResult, clientsResult] = await Promise.all([
        supabase
          .from('client_documents')
          .select('id, name, type, client_id, linked_task_id, visibility, file_path, size, secure, created_at, mime_type, uploaded_by, client:clients(firm_name), task:tasks(title)')
          .order('created_at', { ascending: false })
          .limit(150),
        supabase.from('clients').select('id, firm_name').order('firm_name', { ascending: true }),
      ]);

      if (docsResult.error) throw docsResult.error;
      if (clientsResult.error) throw clientsResult.error;

      const nextClients = (clientsResult.data || []) as ClientOption[];
      const nextDocuments = (docsResult.data || []) as unknown as ClientDocument[];
      setClients(nextClients);
      setDocuments(nextDocuments);
      setSelectedClientId((current) => current || nextClients[0]?.id || '');
      const syncedAt = new Date().toISOString();
      setLastSyncedAt(syncedAt);
      await persistState(currentProfile.id, nextDocuments, nextClients, queueRef.current, syncedAt);
    } catch (error: any) {
      console.error('[MobileDocuments] load failed', error);
      if (showLoader && !isRetriableOfflineError(error)) {
        Alert.alert('Documents unavailable', extractOfflineErrorMessage(error, 'Could not load the document vault right now.'));
      } else if (showLoader && isRetriableOfflineError(error) && documentsRef.current.length > 0) {
        Alert.alert('Offline Mode', 'Showing last synced documents while connectivity is restored.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadCachedState, persistState]);

  const fetchTasksForClient = useCallback(async (clientId: string) => {
    if (!clientId) return;
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title')
        .eq('client_id', clientId)
        .order('title', { ascending: true });
      
      if (!error && data) {
        setAvailableTasks(data);
      }
    } catch (e) {
      console.error('Failed to fetch tasks', e);
    }
  }, []);

  useEffect(() => {
    if (uploadModalOpen && selectedClientId) {
      fetchTasksForClient(selectedClientId);
    }
  }, [uploadModalOpen, selectedClientId, fetchTasksForClient]);

  useEffect(() => {
    void loadData(true);
  }, [loadData]);

  useEffect(() => {
    if (!profile?.id) return;

    const channel = supabase
      .channel(`mobile-documents:${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'client_documents' }, () => {
        void loadData(false);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData, profile?.id]);

  const filteredDocuments = useMemo(() => {
    const term = search.trim().toLowerCase();
    return documents.filter((document) => {
      const matchesFilter = filter === 'all' || document.type === filter;
      const matchesTaskFilter = taskFilter === 'all' || document.linked_task_id === taskFilter;
      const matchesSearch =
        !term ||
        document.name.toLowerCase().includes(term) ||
        unwrapClientName(document).toLowerCase().includes(term);
      return matchesFilter && matchesTaskFilter && matchesSearch;
    });
  }, [documents, filter, taskFilter, search]);

  const stats = useMemo(() => {
    const secureCount = documents.filter((document) => document.secure).length;
    const totalBytes = documents.reduce((sum, document) => sum + (document.size || 0), 0);
    return {
      total: documents.length,
      secure: secureCount,
      size: formatBytes(totalBytes),
    };
  }, [documents]);

  const pickDocument = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: ['application/pdf', 'image/*', 'text/plain', 'application/*', 'text/*'],
    });

    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];

    if ((asset.size || 0) > MAX_DOCUMENT_SIZE_BYTES) {
      Alert.alert('File too large', 'Choose a file that is 50MB or smaller.');
      return;
    }

    if (!isAllowedMimeType(asset.mimeType)) {
      Alert.alert('Unsupported file', 'Upload PDF, Office files, ZIP archives, text, or images.');
      return;
    }

    setPickedAsset(asset);
  }, []);

  const openDocument = useCallback(async (document: ClientDocument) => {
    try {
      const { data, error } = await supabase.storage
        .from(DOCUMENT_BUCKET)
        .createSignedUrl(document.file_path, 60 * 10);

      if (error || !data?.signedUrl) throw error || new Error('Could not create download link');
      await Linking.openURL(data.signedUrl);
    } catch (error: any) {
      if (isRetriableOfflineError(error)) {
        Alert.alert('Offline', 'Reconnect to open this document.');
        return;
      }
      Alert.alert('Download failed', extractOfflineErrorMessage(error, 'Could not open this document.'));
    }
  }, []);

  const executeUploadOperation = useCallback(
    async (operation: QueuedDocumentUpload) => {
      const filePath = `${operation.payload.client_id}/${Date.now()}_${sanitizeFileName(operation.asset.name)}`;
      const base64 = await FileSystem.readAsStringAsync(operation.asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const fileBuffer = base64ToArrayBuffer(base64);

      const { error: uploadError } = await supabase.storage
        .from(DOCUMENT_BUCKET)
        .upload(filePath, fileBuffer, {
          contentType: operation.asset.mimeType || undefined,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: inserted, error: insertError } = await supabase
        .from('client_documents')
        .insert({
          name: operation.payload.name,
          type: operation.payload.type,
          client_id: operation.payload.client_id,
          linked_task_id: operation.payload.linked_task_id,
          visibility: operation.payload.visibility,
          file_path: filePath,
          size: operation.payload.size,
          secure: operation.payload.secure,
          mime_type: operation.payload.mime_type,
          uploaded_by: operation.payload.uploaded_by,
        })
        .select('id, name, type, client_id, linked_task_id, visibility, file_path, size, secure, created_at, mime_type, uploaded_by, client:clients(firm_name), task:tasks(title)')
        .single();

      if (insertError) {
        await supabase.storage.from(DOCUMENT_BUCKET).remove([filePath]).catch(() => undefined);
        throw insertError;
      }

      const createdDoc = inserted as unknown as ClientDocument;
      setDocuments((current) => [createdDoc, ...current.filter((item) => item.id !== createdDoc.id)]);
      return createdDoc;
    },
    []
  );

  const retryPendingQueue = useCallback(async () => {
    if (flushingRef.current || queueRef.current.length === 0) return;

    const currentProfile = profileRef.current || (await getCurrentMobileProfile().catch(() => null));
    if (!currentProfile) return;

    flushingRef.current = true;
    setFlushingQueue(true);

    try {
      let nextQueue = [...queueRef.current];
      let nextDocuments = [...documentsRef.current];
      let syncedAt = lastSyncedAtRef.current;

      for (const operation of queueRef.current) {
        try {
          if (operation.type === 'upload_document') {
            const uploaded = await executeUploadOperation(operation);
            nextDocuments = [uploaded, ...nextDocuments.filter((item) => item.id !== uploaded.id)];
            nextQueue = nextQueue.filter((item) => item.id !== operation.id);
            syncedAt = new Date().toISOString();
            await FileSystem.deleteAsync(operation.asset.uri, { idempotent: true }).catch(() => undefined);
          }
        } catch (error) {
          if (isRetriableOfflineError(error)) {
            break;
          }

          console.error('[MobileDocuments] dropping non-retriable queued operation', error);
          nextQueue = nextQueue.filter((item) => item.id !== operation.id);
          await FileSystem.deleteAsync(operation.asset.uri, { idempotent: true }).catch(() => undefined);
        }
      }

      setDocuments(nextDocuments);
      setPendingQueue(nextQueue);
      queueRef.current = nextQueue;
      if (syncedAt) {
        setLastSyncedAt(syncedAt);
      }
      await persistState(currentProfile.id, nextDocuments, clientsRef.current, nextQueue, syncedAt);
    } finally {
      flushingRef.current = false;
      setFlushingQueue(false);
    }
  }, [executeUploadOperation, persistState]);

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

  const uploadDocument = useCallback(async () => {
    if (!profile || !pickedAsset || !selectedClientId) {
      Alert.alert('Missing details', 'Select a client and a file before uploading.');
      return;
    }

    setUploading(true);

    try {
      const operation: QueuedDocumentUpload = {
        id: `queue-${Date.now()}`,
        type: 'upload_document',
        createdAt: new Date().toISOString(),
        payload: {
          name: pickedAsset.name,
          type: selectedType,
          client_id: selectedClientId,
          linked_task_id: selectedTaskId === 'none' ? null : selectedTaskId,
          visibility: visibility,
          secure: secureUpload,
          mime_type: pickedAsset.mimeType || null,
          size: pickedAsset.size || 0,
          uploaded_by: profile.id,
        },
        asset: {
          uri: pickedAsset.uri,
          name: pickedAsset.name,
          mimeType: pickedAsset.mimeType || null,
          size: pickedAsset.size || 0,
        },
      };

      const createdDoc = await executeUploadOperation(operation);
      const syncedAt = new Date().toISOString();
      setLastSyncedAt(syncedAt);
      await persistState(storageOwnerIdRef.current, [createdDoc, ...documentsRef.current.filter((item) => item.id !== createdDoc.id)], clientsRef.current, queueRef.current, syncedAt);

      setUploadModalOpen(false);
      setPickedAsset(null);
      setSecureUpload(false);
      setSelectedType('asset');
      setSelectedTaskId('none');
      setVisibility('client');
    } catch (error: any) {
      if (isRetriableOfflineError(error)) {
        try {
          const persistentAsset = await persistAssetForOffline(pickedAsset);
          await enqueueOperation({
            id: `queue-${Date.now()}`,
            type: 'upload_document',
            createdAt: new Date().toISOString(),
            payload: {
              name: pickedAsset.name,
              type: selectedType,
              client_id: selectedClientId,
              linked_task_id: selectedTaskId === 'none' ? null : selectedTaskId,
              visibility: visibility,
              secure: secureUpload,
              mime_type: pickedAsset.mimeType || null,
              size: pickedAsset.size || 0,
              uploaded_by: profile.id,
            },
            asset: persistentAsset,
          });

          setUploadModalOpen(false);
          setPickedAsset(null);
          setSecureUpload(false);
          setSelectedType('asset');
          setSelectedTaskId('none');
          setVisibility('client');
          Alert.alert('Queued Offline', 'Document upload will sync automatically when network returns.');
        } catch (queueError: any) {
          Alert.alert('Queue Failed', extractOfflineErrorMessage(queueError, 'Could not queue this upload.'));
        }
      } else {
        console.error('[MobileDocuments] upload failed', error);
        Alert.alert('Upload failed', extractOfflineErrorMessage(error, 'Could not upload this document.'));
      }
    } finally {
      setUploading(false);
    }
  }, [
    enqueueOperation,
    executeUploadOperation,
    persistState,
    pickedAsset,
    profile,
    secureUpload,
    selectedClientId,
    selectedType,
    selectedTaskId,
    visibility,
  ]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loadingText}>Loading secure document access...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void loadData(false)} tintColor={Colors.accent} />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Document Vault</Text>
            <Text style={styles.subtitle}>Secure client documents synced from Supabase storage</Text>
            <Text style={styles.syncHint}>
              {flushingQueue
                ? 'Syncing queued uploads...'
                : pendingQueue.length > 0
                  ? `${pendingQueue.length} document upload${pendingQueue.length > 1 ? 's' : ''} queued offline`
                  : lastSyncedAt
                    ? `Last sync ${new Date(lastSyncedAt).toLocaleTimeString()}`
                    : 'Waiting for first sync'}
            </Text>
          </View>
          {canUploadDocuments(profile) ? (
            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.uploadButton}
              onPress={() => setUploadModalOpen(true)}
            >
              <Upload color="#020617" size={16} />
              <Text style={styles.uploadButtonText}>Upload</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.statsGrid}>
          <StatsCard icon={FolderOpen} label="Total Files" value={String(stats.total)} accent="#60a5fa" />
          <StatsCard icon={ShieldCheck} label="Secure" value={String(stats.secure)} accent="#a78bfa" />
          <StatsCard icon={FileText} label="Storage" value={stats.size} accent="#f59e0b" />
        </View>

        <GlassCard style={styles.searchCard} intensity={28}>
          <View style={styles.searchRow}>
            <Search color={Colors.slate500} size={18} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search files or clients..."
              placeholderTextColor={Colors.slate500}
              style={styles.searchInput}
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            <FilterChip label="All" active={filter === 'all'} onPress={() => setFilter('all')} />
            {DOCUMENT_TYPES.map((item) => (
              <FilterChip
                key={item.value}
                label={item.label}
                active={filter === item.value}
                onPress={() => setFilter(item.value)}
              />
            ))}
          </ScrollView>

          {documents.some(d => d.linked_task_id) && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              <FilterChip 
                label="No Task" 
                active={taskFilter === 'none'} 
                onPress={() => setTaskFilter(taskFilter === 'none' ? 'all' : 'none')} 
              />
              {Array.from(new Set(documents.filter(d => d.task?.title).map(d => JSON.stringify({id: d.linked_task_id, title: d.task!.title}))))
                .map(tStr => JSON.parse(tStr) as TaskOption)
                .map((task) => (
                  <FilterChip
                    key={task.id}
                    label={task.title}
                    active={taskFilter === task.id}
                    onPress={() => setTaskFilter(taskFilter === task.id ? 'all' : task.id)}
                  />
              ))}
            </ScrollView>
          )}
        </GlassCard>

        <View style={styles.listSection}>
          {filteredDocuments.length === 0 ? (
            <GlassCard style={styles.emptyCard} intensity={24}>
              <FolderOpen color={Colors.slate500} size={28} />
              <Text style={styles.emptyTitle}>No documents found</Text>
              <Text style={styles.emptyText}>
                Files you can access will appear here automatically. Pull to refresh after uploads.
              </Text>
            </GlassCard>
          ) : (
            filteredDocuments.map((document) => {
              const meta = getDocumentMeta(document);
              const Icon = meta.Icon;

              return (
                <GlassCard key={document.id} style={styles.documentCard} intensity={26}>
                  <View style={styles.documentRow}>
                    <View style={[styles.documentIconWrap, { backgroundColor: `${meta.color}18` }]}>
                      <Icon color={meta.color} size={20} />
                    </View>

                    <View style={styles.documentInfo}>
                      <View style={styles.documentTitleRow}>
                        <Text style={styles.documentTitle} numberOfLines={1}>
                          {document.name}
                        </Text>
                        {document.secure ? <Lock color="#a78bfa" size={14} /> : null}
                      </View>
                      <Text style={styles.documentMeta} numberOfLines={1}>
                        {unwrapClientName(document)} 
                        {document.task?.title ? ` · ${document.task.title}` : ''} 
                        {` · ${formatBytes(document.size)} · ${new Date(document.created_at).toLocaleDateString()}`}
                      </Text>
                    </View>

                    <View style={styles.documentRight}>
                      <View style={[styles.visibilityBadge, { backgroundColor: document.visibility === 'client' ? 'rgba(74,222,128,0.1)' : document.visibility === 'team' ? 'rgba(96,165,250,0.1)' : 'rgba(248,113,113,0.1)' }]}>
                        <Text style={[styles.visibilityText, { color: document.visibility === 'client' ? '#4ade80' : document.visibility === 'team' ? '#60a5fa' : '#f87171' }]}>
                          {document.visibility === 'admin' ? 'SECURE' : document.visibility.toUpperCase()}
                        </Text>
                      </View>

                      <TouchableOpacity
                        activeOpacity={0.85}
                        style={styles.downloadButton}
                        onPress={() => void openDocument(document)}
                      >
                        <Download color="#e2e8f0" size={16} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </GlassCard>
              );
            })
          )}
        </View>
      </ScrollView>

      <Modal visible={uploadModalOpen} transparent animationType="slide" onRequestClose={() => setUploadModalOpen(false)}>
        <View style={styles.modalScrim}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Upload Document</Text>
                <Text style={styles.modalSubtitle}>Only assigned client records can be targeted.</Text>
              </View>
              <TouchableOpacity onPress={() => setUploadModalOpen(false)} style={styles.modalClose}>
                <X color="#e2e8f0" size={18} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.sectionLabel}>Client</Text>
              <View style={styles.clientList}>
                {clients.map((client) => (
                  <TouchableOpacity
                    key={client.id}
                    onPress={() => setSelectedClientId(client.id)}
                    style={[
                      styles.clientOption,
                      selectedClientId === client.id && styles.clientOptionActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.clientOptionText,
                        selectedClientId === client.id && styles.clientOptionTextActive,
                      ]}
                    >
                      {client.firm_name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.sectionLabel}>Linked Task (Optional)</Text>
              <View style={styles.clientList}>
                <TouchableOpacity
                  onPress={() => setSelectedTaskId('none')}
                  style={[
                    styles.clientOption,
                    selectedTaskId === 'none' && styles.clientOptionActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.clientOptionText,
                      selectedTaskId === 'none' && styles.clientOptionTextActive,
                    ]}
                  >
                    Not Task Specific
                  </Text>
                </TouchableOpacity>
                {availableTasks.map((task) => (
                  <TouchableOpacity
                    key={task.id}
                    onPress={() => setSelectedTaskId(task.id)}
                    style={[
                      styles.clientOption,
                      selectedTaskId === task.id && styles.clientOptionActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.clientOptionText,
                        selectedTaskId === task.id && styles.clientOptionTextActive,
                      ]}
                    >
                      {task.title}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.sectionLabel}>Visibility</Text>
              <View style={styles.typeRow}>
                {VISIBILITY_OPTIONS.map((item) => (
                  <FilterChip
                    key={item.value}
                    label={item.label}
                    active={visibility === item.value}
                    onPress={() => setVisibility(item.value)}
                  />
                ))}
              </View>

              <Text style={styles.sectionLabel}>Document Type</Text>
              <View style={styles.typeRow}>
                {DOCUMENT_TYPES.map((item) => (
                  <FilterChip
                    key={item.value}
                    label={item.label}
                    active={selectedType === item.value}
                    onPress={() => setSelectedType(item.value)}
                  />
                ))}
              </View>

              <TouchableOpacity activeOpacity={0.9} onPress={pickDocument} style={styles.pickFileButton}>
                <Upload color="#85adff" size={18} />
                <Text style={styles.pickFileText}>{pickedAsset ? pickedAsset.name : 'Choose file'}</Text>
              </TouchableOpacity>

              {pickedAsset ? (
                <Text style={styles.assetMeta}>
                  {formatBytes(pickedAsset.size || 0)} · {pickedAsset.mimeType || 'Unknown type'}
                </Text>
              ) : null}

              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => setSecureUpload((current) => !current)}
                style={[styles.secureToggle, secureUpload && styles.secureToggleActive]}
              >
                <ShieldCheck color={secureUpload ? '#020617' : '#a78bfa'} size={16} />
                <Text style={[styles.secureToggleText, secureUpload && styles.secureToggleTextActive]}>
                  Mark as secure
                </Text>
              </TouchableOpacity>
            </ScrollView>

            <TouchableOpacity
              activeOpacity={0.9}
              style={[styles.submitButton, uploading && styles.submitButtonDisabled]}
              disabled={uploading}
              onPress={() => void uploadDocument()}
            >
              {uploading ? <ActivityIndicator color="#020617" /> : <Text style={styles.submitButtonText}>Upload to vault</Text>}
            </TouchableOpacity>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
  },
  headerCopy: {
    flex: 1,
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
  uploadButton: {
    minHeight: 42,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: '#85adff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  uploadButtonText: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 13,
    color: '#020617',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statsCard: {
    flex: 1,
    minHeight: 116,
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
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18,
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
  listSection: {
    gap: 12,
  },
  documentCard: {
    paddingVertical: 8,
  },
  documentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  documentIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  documentInfo: {
    flex: 1,
    gap: 4,
  },
  documentTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  documentTitle: {
    flex: 1,
    fontFamily: Fonts.Outfit_600SemiBold,
    fontSize: 15,
    color: '#fff',
  },
  documentMeta: {
    fontFamily: Fonts.Outfit_400Regular,
    fontSize: 12,
    color: Colors.slate500,
  },
  downloadButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  documentRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  visibilityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  visibilityText: {
    fontFamily: Fonts.SpaceMono_700Bold,
    fontSize: 9,
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
  sectionLabel: {
    marginBottom: 10,
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 10,
    color: Colors.slate500,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  clientList: {
    gap: 8,
    marginBottom: 18,
  },
  clientOption: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  clientOptionActive: {
    borderColor: '#85adff',
    backgroundColor: 'rgba(133,173,255,0.12)',
  },
  clientOptionText: {
    fontFamily: Fonts.Outfit_500Medium,
    fontSize: 14,
    color: '#cbd5e1',
  },
  clientOptionTextActive: {
    color: '#fff',
  },
  pickFileButton: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(133,173,255,0.25)',
    backgroundColor: 'rgba(133,173,255,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  pickFileText: {
    fontFamily: Fonts.Outfit_600SemiBold,
    fontSize: 14,
    color: '#85adff',
  },
  assetMeta: {
    marginTop: 10,
    marginBottom: 18,
    fontFamily: Fonts.Outfit_400Regular,
    fontSize: 12,
    color: Colors.slate500,
  },
  secureToggle: {
    minHeight: 46,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.24)',
    backgroundColor: 'rgba(167,139,250,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  secureToggleActive: {
    backgroundColor: '#a78bfa',
  },
  secureToggleText: {
    fontFamily: Fonts.Outfit_600SemiBold,
    fontSize: 13,
    color: '#d8b4fe',
  },
  secureToggleTextActive: {
    color: '#020617',
  },
  submitButton: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: '#85adff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.65,
  },
  submitButtonText: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 14,
    color: '#020617',
  },
});
