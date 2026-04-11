import React, { useMemo, useState } from 'react';
import {
  type DimensionValue,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Bot,
  ChevronRight,
  MessageSquare,
  Download,
  Eye,
  FileArchive,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Star,
  LayoutDashboard,
  Menu,
  MoreVertical,
  Plus,
  Rocket,
  Search,
  Upload,
  Users,
  ExternalLink,
  History,
  FileImage,
} from 'lucide-react-native';
import { Colors, Fonts } from '../../lib/theme';
import LiveDocumentsScreen from '../../components/documents/LiveDocumentsScreen';

type FilterKey = 'all' | 'pdfs' | 'designs' | 'contracts' | 'assets';
type FileKind = 'image' | 'pdf' | 'doc' | 'zip' | 'link' | 'xls';

type FileCard = {
  id: string;
  title: string;
  meta: string;
  kind: FileKind;
  image?: string;
  accent: string;
};

type CollaborationItem = {
  id: string;
  title: string;
  time: string;
  accent: string;
  icon: any;
};

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All Files' },
  { key: 'pdfs', label: 'PDFs' },
  { key: 'designs', label: 'Designs' },
  { key: 'contracts', label: 'Contracts' },
  { key: 'assets', label: 'Assets' },
];

const FILES: FileCard[] = [
  {
    id: 'brand-hero',
    title: 'Brand_Hero_V2.png',
    meta: '2.4 MB • Oct 12, 2023',
    kind: 'image',
    accent: '#85adff',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuA9Aev7CyhKds6sj_BA2vel35bgbJ5zU8iOogWc2f5S9Z9IPFaRR6UbtLgmp4mbmEfmSj-I46BxsJvf1WrbBDuHuDjTOKxg4cL0H9JK6yQGqCwBk7K13LWBzrp8GttZcQKsBOrLiJwjigPvmuqRYgr_V39a5aic--Ohx1g4fT-VKx0EVohq4RW-BS1X3lhxM582bDm-TnnGPAVW7xTRa4XtvdQn8aLSCJ-qfGinV9TnjYjmBr_SQa_OUDpoi55oGzbX8etniV18lArR',
  },
  {
    id: 'marketing-strategy',
    title: 'Marketing_Strategy_2024.pdf',
    meta: '8.1 MB • Oct 15, 2023',
    kind: 'pdf',
    accent: '#ff716c',
  },
  {
    id: 'service-agreement',
    title: 'Service_Agreement_v4.docx',
    meta: '156 KB • Nov 02, 2023',
    kind: 'doc',
    accent: '#85adff',
  },
  {
    id: 'ui-kit',
    title: 'UI_Kit_Assets_Final.zip',
    meta: '45.8 MB • Nov 10, 2023',
    kind: 'zip',
    accent: '#9093ff',
  },
  {
    id: 'figma-link',
    title: 'App_Design_Prototype',
    meta: 'Figma Project • Oct 28, 2023',
    kind: 'link',
    accent: '#85adff',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuA8zhb2NTvkq_heHJ4zp7Ir1mgjMEEIHBgDnOMVKKKAwQRi9HsrRZTBz11LiKJ1N04MHnvkgvlyttj3j55FSeKG0tt8psctcyM-pstIDyeafc3J1RGfYgFwpBgMdb0GC38db05TwbZfxL9D_UcZVWaFIsE30DbP_FfPMqry_nb_na0GpAnxj14DrG5xtOHkGHvhm--3OE6MYCWNjDjqae8Ywkub54gux3oAVu5qmhsmQXg5myIkdUpCQCNnlPQ8-HLEaaCHAOmgCMYh',
  },
  {
    id: 'forecast',
    title: 'Financial_Forecast_v2.xlsx',
    meta: '1.2 MB • Today',
    kind: 'xls',
    accent: '#22c55e',
  },
];

const RECENT_ITEMS: CollaborationItem[] = [
  {
    id: 'edit-agreement',
    title: 'Alex Sterling edited Service_Agreement_v4',
    time: '2 hours ago',
    accent: '#85adff',
    icon: History,
  },
  {
    id: 'comment-figma',
    title: 'New comment on App_Design_Prototype',
    time: '5 hours ago',
    accent: '#9093ff',
    icon: MessageSquare,
  },
];

const SIDEBAR_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'clients', label: 'Clients', icon: Users },
  { key: 'projects', label: 'Projects', icon: Rocket },
  { key: 'messages', label: 'Messages', icon: MessageSquare },
  { key: 'assets', label: 'Assets', icon: FolderOpen, active: true },
];

const PROFILE_IMAGE = 'https://lh3.googleusercontent.com/aida-public/AB6AXuC17Xfb4EVNC6X3HpJ1RM3GBvRF35uOKhG27BiY3kFaQvj4qNIKvF4IkLzwi6wsavD1YFLSYTSwbTHw59q1kbAWEmafqIb9C3RWFPRlbJqgoumRZnJcplStrpF3wE7JwLZqjkwccE0AaI5tTpnH9-Z18xUkiA0A9jAfMX-W6R1CFJZaYb-QI7dN00sqIYnOA_06Zawpvl617H9k3C_JLJ5tev3LWbtQWLR0urq8vM0vSxXugvvpdhrF7-vlfbV6r69wwELVZMkPeaPq';
const DESKTOP_PROFILE = 'https://lh3.googleusercontent.com/aida-public/AB6AXuBZvM_alyaOwqpF4vxGx9EYe93BX1KlSjxh-d-ads6nyDxE2pwQvQJ4II9gxg54W8VU_thpXo_8NGPuwgrwRji5iYDnpDFSAgsf29_aBlzBbdG0-ot8-UAgY5QgY02zGPLqOdVIBEWbeKIhn4nuRsGRwszvtYSBOpv3ibRClIMOxyxEmw0HCIbwAzHwBnfBJmgaIByqoyB49ZW4ho8tUj4Ffo6B1LjfaRu1XPuZBPoVTjTGeqh57WzmCVv4GUBAVlJlrcDbZg6vve5E';

function LegacyDocsScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1100;
  const cardWidth: DimensionValue = width >= 1280 ? '31.8%' : width >= 720 ? '48.5%' : '100%';

  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');

  const filteredFiles = useMemo(() => {
    const term = search.trim().toLowerCase();
    return FILES.filter((file) => {
      const matchesSearch = !term || file.title.toLowerCase().includes(term) || file.meta.toLowerCase().includes(term);
      const matchesFilter =
        filter === 'all' ||
        (filter === 'pdfs' && file.kind === 'pdf') ||
        (filter === 'designs' && (file.kind === 'image' || file.kind === 'link')) ||
        (filter === 'contracts' && file.kind === 'doc') ||
        (filter === 'assets' && (file.kind === 'zip' || file.kind === 'xls'));
      return matchesSearch && matchesFilter;
    });
  }, [filter, search]);

  return (
    <SafeAreaView style={styles.container}>
      <View pointerEvents="none" style={styles.topGlow} />

      <View style={styles.headerShell}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity activeOpacity={0.85} style={styles.headerButton}>
              <Menu color="#85adff" size={20} />
            </TouchableOpacity>
            <Text style={styles.headerBrand}>Agency OS</Text>
          </View>

          {isDesktop ? (
            <View style={styles.headerNav}>
              <Text style={styles.headerNavItem}>Home</Text>
              <Text style={styles.headerNavItem}>Clients</Text>
              <Text style={styles.headerNavItemActive}>Docs</Text>
            </View>
          ) : null}

          <View style={styles.headerRight}>
            <TouchableOpacity activeOpacity={0.85} style={styles.headerButton}>
              <Bot color="#85adff" size={18} />
            </TouchableOpacity>
            <View style={styles.profileChip}>
              <Image source={{ uri: PROFILE_IMAGE }} style={styles.profileImage} />
            </View>
          </View>
        </View>
      </View>

      <View style={styles.layout}>
        {isDesktop ? <DesktopSidebar /> : null}

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop]}>
          <View style={styles.heroSection}>
            <View style={styles.heroTextWrap}>
              <Text style={styles.heroTitle}>Documentation Hub</Text>
              <Text style={styles.heroSubtitle}>
                Access your agency assets, project deliverables, and internal resources in one unified workspace.
              </Text>
            </View>

            <View style={styles.heroActions}>
              <TouchableOpacity activeOpacity={0.9} style={styles.secondaryAction}>
                <Upload color="#85adff" size={16} />
                <Text style={styles.secondaryActionText}>Upload</Text>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.9} style={styles.primaryActionWrap}>
                <LinearGradient colors={['#85adff', '#9093ff']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryAction}>
                  <Plus color="#000000" size={16} />
                  <Text style={styles.primaryActionText}>New Doc</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.searchFilterSection}>
            <View style={styles.searchWrap}>
              <Search color="#a6aabc" size={18} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search files, folders, and tags..."
                placeholderTextColor="rgba(166,170,188,0.55)"
                style={styles.searchInput}
              />
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              {FILTERS.map((item) => {
                const active = filter === item.key;
                return (
                  <TouchableOpacity
                    key={item.key}
                    activeOpacity={0.9}
                    onPress={() => setFilter(item.key)}
                    style={[styles.filterPill, active && styles.filterPillActive]}
                  >
                    <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>{item.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.mainGrid}>
            <View style={styles.sidebarColumn}>
              <StorageCard />
              <StarredFoldersCard />
            </View>

            <View style={styles.filesColumn}>
              <View style={styles.fileGrid}>
                {filteredFiles.map((file) => (
                  <FileCardView key={file.id} file={file} width={cardWidth} />
                ))}
              </View>

              <View style={styles.recentSection}>
                <Text style={styles.recentTitle}>Recent Collaborations</Text>
                <View style={styles.recentGrid}>
                  {RECENT_ITEMS.map((item) => (
                    <RecentCard key={item.id} item={item} />
                  ))}
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function DesktopSidebar() {
  return (
    <View style={styles.desktopSidebar}>
      <Text style={styles.desktopSidebarTitle}>Agency OS</Text>
      <View style={styles.desktopNav}>
        {SIDEBAR_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <TouchableOpacity key={item.key} activeOpacity={0.85} style={[styles.desktopNavItem, item.active && styles.desktopNavItemActive]}>
              <Icon color={item.active ? '#85adff' : '#94a3b8'} size={18} />
              <Text style={[styles.desktopNavText, item.active && styles.desktopNavTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={styles.desktopProfileRow}>
        <Image source={{ uri: DESKTOP_PROFILE }} style={styles.desktopProfileImage} />
        <View>
          <Text style={styles.desktopProfileName}>Alex Sterling</Text>
          <Text style={styles.desktopProfileRole}>Principal Partner</Text>
        </View>
      </View>
    </View>
  );
}

function StorageCard() {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricCardTitle}>Storage Metrics</Text>
      <View style={styles.storageMetaRow}>
        <Text style={styles.storageMainText}>12.4 GB used</Text>
        <Text style={styles.storageSubText}>20 GB total</Text>
      </View>
      <View style={styles.storageTrack}>
        <LinearGradient colors={['#85adff', '#9093ff']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.storageFill} />
      </View>
      <View style={styles.storageLegend}>
        <LegendRow color="#85adff" label="Images" value="4.2 GB" />
        <LegendRow color="#9093ff" label="Videos" value="6.8 GB" />
        <LegendRow color="#ccd4ee" label="Others" value="1.4 GB" />
      </View>
    </View>
  );
}

function StarredFoldersCard() {
  const folders = [
    { label: 'Q4 Deliverables', color: '#85adff' },
    { label: 'Brand Guidelines', color: '#9093ff' },
    { label: 'Client Archive', color: '#a6aabc' },
  ];

  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricCardTitle}>Starred Folders</Text>
      <View style={styles.starredList}>
        {folders.map((folder) => (
          <TouchableOpacity key={folder.label} activeOpacity={0.85} style={styles.starredRow}>
            <Star color={folder.color} size={18} />
            <Text style={styles.starredText}>{folder.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function LegendRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <View style={styles.legendRow}>
      <View style={styles.legendLabelWrap}>
        <View style={[styles.legendDot, { backgroundColor: color }]} />
        <Text style={styles.legendLabel}>{label}</Text>
      </View>
      <Text style={styles.legendValue}>{value}</Text>
    </View>
  );
}

function FileCardView({ file, width }: { file: FileCard; width: DimensionValue }) {
  const kindConfig = getKindConfig(file.kind, file.accent);

  return (
    <View style={[styles.fileCard, { width }]}> 
      <View style={styles.filePreview}>
        {file.kind === 'image' || file.kind === 'link' ? (
          <Image source={{ uri: file.image }} style={styles.filePreviewImage} />
        ) : (
          <View style={[styles.fileIconTile, { backgroundColor: kindConfig.tileBg, borderColor: kindConfig.tileBorder }]}>
            <kindConfig.Icon color={kindConfig.iconColor} size={34} />
          </View>
        )}

        <View style={styles.previewOverlay}>
          {file.kind === 'image' ? (
            <>
              <OverlayIconButton icon={Eye} />
              <OverlayIconButton icon={Download} />
            </>
          ) : file.kind === 'link' ? (
            <OverlayIconButton icon={ExternalLink} />
          ) : (
            <OverlayIconButton icon={Download} />
          )}
        </View>

        <View style={styles.fileKindBadge}>
          <Text style={styles.fileKindText}>{kindConfig.label}</Text>
        </View>
      </View>

      <View style={styles.fileBody}>
        <Text style={styles.fileTitle} numberOfLines={1}>{file.title}</Text>
        <View style={styles.fileMetaRow}>
          <Text style={styles.fileMeta} numberOfLines={1}>{file.meta}</Text>
          <MoreVertical color="#a6aabc" size={16} />
        </View>
      </View>
    </View>
  );
}

function OverlayIconButton({ icon: Icon }: { icon: any }) {
  return (
    <TouchableOpacity activeOpacity={0.85} style={styles.overlayIconButton}>
      <Icon color="#ffffff" size={16} />
    </TouchableOpacity>
  );
}

function RecentCard({ item }: { item: CollaborationItem }) {
  const Icon = item.icon;
  return (
    <View style={styles.recentCard}>
      <View style={[styles.recentIconWrap, { backgroundColor: `${item.accent}22` }]}> 
        <Icon color={item.accent} size={18} />
      </View>
      <View style={styles.recentTextWrap}>
        <Text style={styles.recentCardTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.recentCardTime}>{item.time}</Text>
      </View>
      <ChevronRight color="#a6aabc" size={18} />
    </View>
  );
}

function getKindConfig(kind: FileKind, accent: string) {
  switch (kind) {
    case 'pdf':
      return { label: 'PDF', Icon: FileText, tileBg: 'rgba(215,56,59,0.18)', tileBorder: 'rgba(215,56,59,0.28)', iconColor: '#ff716c' };
    case 'doc':
      return { label: 'DOC', Icon: FileText, tileBg: 'rgba(133,173,255,0.18)', tileBorder: 'rgba(133,173,255,0.28)', iconColor: '#85adff' };
    case 'zip':
      return { label: 'ZIP', Icon: FileArchive, tileBg: 'rgba(144,147,255,0.18)', tileBorder: 'rgba(144,147,255,0.28)', iconColor: '#9093ff' };
    case 'xls':
      return { label: 'XLS', Icon: FileSpreadsheet, tileBg: 'rgba(34,197,94,0.12)', tileBorder: 'rgba(34,197,94,0.24)', iconColor: '#22c55e' };
    case 'link':
      return { label: 'LINK', Icon: ExternalLink, tileBg: `${accent}20`, tileBorder: `${accent}33`, iconColor: accent };
    default:
      return { label: 'IMG', Icon: FileImage, tileBg: `${accent}20`, tileBorder: `${accent}33`, iconColor: accent };
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090e1b',
  },
  topGlow: {
    position: 'absolute',
    top: -60,
    right: -40,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: 'rgba(133,173,255,0.08)',
  },
  headerShell: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    backgroundColor: 'rgba(9,14,27,0.74)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.10)',
  },
  header: {
    height: 72,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  headerBrand: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 22,
    color: '#85adff',
    letterSpacing: -0.6,
  },
  headerNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  headerNavItem: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 16,
    color: '#94a3b8',
  },
  headerNavItemActive: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 16,
    color: '#85adff',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileChip: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1e2538',
    borderWidth: 1,
    borderColor: 'rgba(67,72,87,0.30)',
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  layout: {
    flex: 1,
    flexDirection: 'row',
  },
  desktopSidebar: {
    width: 248,
    paddingTop: 82,
    paddingHorizontal: 20,
    paddingBottom: 24,
    backgroundColor: '#090e1b',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: 'rgba(255,255,255,0.08)',
  },
  desktopSidebarTitle: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 26,
    color: '#ffffff',
    marginBottom: 24,
  },
  desktopNav: {
    flex: 1,
    gap: 6,
  },
  desktopNavItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
  },
  desktopNavItemActive: {
    backgroundColor: 'rgba(133,173,255,0.10)',
    borderLeftWidth: 2,
    borderLeftColor: '#85adff',
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
  desktopNavText: {
    fontFamily: Fonts.Outfit_500Medium,
    fontSize: 14,
    color: '#94a3b8',
  },
  desktopNavTextActive: {
    color: '#85adff',
  },
  desktopProfileRow: {
    marginTop: 12,
    paddingTop: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  desktopProfileImage: {
    width: 40,
    height: 40,
    borderRadius: 12,
  },
  desktopProfileName: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 14,
    color: '#ffffff',
  },
  desktopProfileRole: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 10,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  content: {
    flexGrow: 1,
    paddingTop: 96,
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  contentDesktop: {
    paddingHorizontal: 28,
  },
  heroSection: {
    marginBottom: 22,
    gap: 18,
  },
  heroTextWrap: {
    gap: 8,
  },
  heroTitle: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 34,
    color: '#e4e7fb',
    letterSpacing: -0.8,
  },
  heroSubtitle: {
    fontFamily: Fonts.Outfit_400Regular,
    fontSize: 14,
    color: '#a6aabc',
    maxWidth: 520,
    lineHeight: 21,
  },
  heroActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  secondaryAction: {
    height: 46,
    borderRadius: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1e2538',
    borderWidth: 1,
    borderColor: 'rgba(67,72,87,0.20)',
  },
  secondaryActionText: {
    fontFamily: Fonts.Outfit_600SemiBold,
    fontSize: 14,
    color: '#85adff',
  },
  primaryActionWrap: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  primaryAction: {
    height: 46,
    borderRadius: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryActionText: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 14,
    color: '#000000',
  },
  searchFilterSection: {
    marginBottom: 22,
    gap: 14,
  },
  searchWrap: {
    height: 52,
    borderRadius: 16,
    backgroundColor: '#0d1321',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
  },
  searchInput: {
    flex: 1,
    color: '#e4e7fb',
    fontFamily: Fonts.Outfit_400Regular,
    fontSize: 14,
  },
  filterRow: {
    gap: 8,
    paddingRight: 20,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#0d1321',
  },
  filterPillActive: {
    backgroundColor: '#191f31',
    borderWidth: 1,
    borderColor: 'rgba(133,173,255,0.20)',
  },
  filterPillText: {
    fontFamily: Fonts.Outfit_600SemiBold,
    fontSize: 13,
    color: '#a6aabc',
  },
  filterPillTextActive: {
    color: '#85adff',
  },
  mainGrid: {
    gap: 20,
  },
  sidebarColumn: {
    gap: 14,
  },
  filesColumn: {
    gap: 28,
  },
  metricCard: {
    backgroundColor: '#0d1321',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  metricCardTitle: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 11,
    color: '#a6aabc',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 14,
  },
  storageMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  storageMainText: {
    fontFamily: Fonts.Outfit_500Medium,
    fontSize: 12,
    color: '#e4e7fb',
  },
  storageSubText: {
    fontFamily: Fonts.Outfit_400Regular,
    fontSize: 12,
    color: '#a6aabc',
  },
  storageTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: '#1e2538',
    overflow: 'hidden',
    marginBottom: 14,
  },
  storageFill: {
    width: '62%',
    height: '100%',
    borderRadius: 999,
  },
  storageLegend: {
    gap: 10,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  legendLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  legendLabel: {
    fontFamily: Fonts.Outfit_400Regular,
    fontSize: 13,
    color: '#a6aabc',
  },
  legendValue: {
    fontFamily: Fonts.Outfit_500Medium,
    fontSize: 13,
    color: '#e4e7fb',
  },
  starredList: {
    gap: 8,
  },
  starredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 12,
  },
  starredText: {
    fontFamily: Fonts.Outfit_500Medium,
    fontSize: 14,
    color: '#e4e7fb',
  },
  fileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  fileCard: {
    backgroundColor: '#131929',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  filePreview: {
    height: 168,
    backgroundColor: '#1e2538',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  filePreviewImage: {
    width: '100%',
    height: '100%',
  },
  fileIconTile: {
    width: 68,
    height: 88,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewOverlay: {
    position: 'absolute',
    inset: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  overlayIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileKindBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  fileKindText: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 10,
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  fileBody: {
    padding: 14,
  },
  fileTitle: {
    fontFamily: Fonts.Outfit_600SemiBold,
    fontSize: 14,
    color: '#e4e7fb',
    marginBottom: 6,
  },
  fileMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  fileMeta: {
    flex: 1,
    fontFamily: Fonts.Outfit_400Regular,
    fontSize: 12,
    color: '#a6aabc',
  },
  recentSection: {
    gap: 14,
  },
  recentTitle: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 22,
    color: '#e4e7fb',
  },
  recentGrid: {
    gap: 12,
  },
  recentCard: {
    backgroundColor: '#0d1321',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  recentIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentTextWrap: {
    flex: 1,
  },
  recentCardTitle: {
    fontFamily: Fonts.Outfit_500Medium,
    fontSize: 14,
    color: '#e4e7fb',
    marginBottom: 2,
  },
  recentCardTime: {
    fontFamily: Fonts.Outfit_400Regular,
    fontSize: 12,
    color: '#a6aabc',
  },
});

export default LiveDocumentsScreen;

