import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { COLORS } from '@/constants/brand';

const BG = '#FCF9F1';

type ModuleStatus = 'draft' | 'pending_review' | 'published' | 'rejected' | 'banned';

type ModuleItem = {
  id: string;
  title: string;
  category: string;
  status: ModuleStatus;
  contentCount: number;
};

const STATUS_META: Record<ModuleStatus, { labelKey: string; color: string; bg: string }> = {
  draft: { labelKey: 'myModules.statusDraft', color: '#64748B', bg: '#F1F5F9' },
  pending_review: { labelKey: 'myModules.statusPendingReview', color: '#D97706', bg: '#FFFBEB' },
  published: { labelKey: 'myModules.statusPublished', color: '#16A34A', bg: '#F0FDF4' },
  rejected: { labelKey: 'myModules.statusRejected', color: '#DC2626', bg: '#FEF2F2' },
  banned: { labelKey: 'myModules.statusBanned', color: '#991B1B', bg: '#FEE2E2' },
};

const FILTERS: { key: 'all' | ModuleStatus; labelKey: string }[] = [
  { key: 'all', labelKey: 'myModules.filterAll' },
  { key: 'draft', labelKey: 'myModules.statusDraft' },
  { key: 'pending_review', labelKey: 'myModules.statusPendingReview' },
  { key: 'published', labelKey: 'myModules.statusPublished' },
  { key: 'rejected', labelKey: 'myModules.statusRejected' },
];

export default function MyModulesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [filter, setFilter] = useState<'all' | ModuleStatus>('all');

  const loadData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { setLoading(false); return; }

      const { data: moduleRows, error: moduleError } = await supabase
        .from('modules')
        .select('id_module, title, status, category:categories(name), contents:module_contents(id_content)')
        .eq('id_mentor', session.user.id)
        .order('created_at', { ascending: false });

      if (moduleError) console.log('Error fetching mentor modules:', moduleError);

      setModules((moduleRows || []).map((m: any) => ({
        id: m.id_module,
        title: m.title,
        category: m.category?.name || t('common.uncategorized'),
        status: m.status,
        contentCount: (m.contents || []).length,
      })));
    } catch (e) {
      console.log('Error loading mentor modules:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const filteredModules = filter === 'all' ? modules : modules.filter((m) => m.status === filter);

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, styles.centerBox]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <Image source={require('@/assets/images/logo.png')} style={styles.logoImage} />
          <Text style={styles.logoText}>{t('common.appName')}</Text>
        </View>
        <Text style={styles.headerTitle}>{t('myModules.headerTitle')}</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        <View style={styles.filterRow}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[styles.filterChipText, filter === f.key && styles.filterChipTextActive]}>{t(f.labelKey)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {filteredModules.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="book-outline" size={32} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>
              {modules.length === 0
                ? t('myModules.emptyNoModules')
                : t('myModules.emptyNoModulesInCategory')}
            </Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {filteredModules.map((m) => {
              const meta = STATUS_META[m.status];
              return (
                <TouchableOpacity
                  key={m.id}
                  style={styles.card}
                  activeOpacity={0.85}
                  onPress={() => router.push(`/modules/${m.id}` as any)}
                >
                  <View style={styles.cardTopRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.moduleTitle} numberOfLines={2}>{m.title}</Text>
                      <Text style={styles.moduleCategory}>{m.category}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
                      <Text style={[styles.statusText, { color: meta.color }]}>{t(meta.labelKey)}</Text>
                    </View>
                  </View>
                  <View style={styles.cardBottomRow}>
                    <Ionicons name="albums-outline" size={13} color={COLORS.textLight} />
                    <Text style={styles.contentCountText}>{t('myModules.contentCount', { count: m.contentCount })}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  centerBox: { justifyContent: 'center', alignItems: 'center' },

  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  logoImage: { width: 20, height: 20, resizeMode: 'contain' },
  logoText: { fontSize: 15, fontWeight: '800', color: COLORS.primary, letterSpacing: 0.2 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textDark },

  filterScroll: { flexGrow: 0, marginBottom: 12 },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99, backgroundColor: '#F1F5F9' },
  filterChipActive: { backgroundColor: COLORS.primary },
  filterChipText: { fontSize: 12.5, fontWeight: '600', color: COLORS.textLight },
  filterChipTextActive: { color: COLORS.white },

  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },

  emptyBox: { alignItems: 'center', gap: 10, paddingVertical: 60 },
  emptyText: { fontSize: 13, color: COLORS.textLight, textAlign: 'center', paddingHorizontal: 24 },

  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: '#F1F5F9',
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  moduleTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textDark },
  moduleCategory: { fontSize: 11.5, color: COLORS.textLight, marginTop: 3 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99 },
  statusText: { fontSize: 10, fontWeight: '700' },
  cardBottomRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  contentCountText: { fontSize: 11.5, color: COLORS.textLight },
});