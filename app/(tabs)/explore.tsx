import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants/brand';
import { DEFAULT_AVATAR_URI } from '../../constants/defaultAvatar';

// `dbName` dipakai buat cocokin ke nama kategori ASLI di database (selalu
// Bahasa Indonesia, jangan diterjemahkan). `nameKey` cuma buat label tampilan.
const CATEGORY_META = [
  { id: 'all', dbName: 'Semua', nameKey: 'explore.categoryAll', icon: 'apps-outline' },
  { id: 'design', dbName: 'Desain UI/UX', nameKey: 'explore.categoryDesign', icon: 'color-palette-outline' },
  { id: 'code', dbName: 'Pemrograman', nameKey: 'explore.categoryCode', icon: 'code-slash-outline' },
  { id: 'culinary', dbName: 'Kuliner', nameKey: 'explore.categoryCulinary', icon: 'restaurant-outline' },
  { id: 'business', dbName: 'Bisnis & Karir', nameKey: 'explore.categoryBusiness', icon: 'trending-up-outline' },
  { id: 'music', dbName: 'Musik', nameKey: 'explore.categoryMusic', icon: 'musical-notes-outline' },
  { id: 'language', dbName: 'Bahasa', nameKey: 'explore.categoryLanguage', icon: 'globe-outline' },
];

const FALLBACK_EXPLORE_MODULES = [
  {
    id: 'mod-1',
    title: 'Belajar Auto Layout & Desain Responsif',
    category: 'Desain UI/UX',
    categoryBg: '#EDE9FE',
    categoryColor: '#7C3AED',
    mentorName: 'Sarah Designer',
    mentorAvatar: DEFAULT_AVATAR_URI,
    rating: 4.9,
    reviews: 128,
    totalLessons: 8,
    durationMinutes: 25,
    isPopular: true,
  },
  {
    id: 'mod-2',
    title: 'Teknik Memasak Western Fine Dining di Rumah',
    category: 'Kuliner',
    categoryBg: '#FEF3C7',
    categoryColor: '#D97706',
    mentorName: 'Chef Michael',
    mentorAvatar: DEFAULT_AVATAR_URI,
    rating: 4.8,
    reviews: 95,
    totalLessons: 10,
    durationMinutes: 35,
    isPopular: false,
  },
  {
    id: 'mod-3',
    title: 'Dasar Pemrograman Web Modern (React & TS)',
    category: 'Pemrograman',
    categoryBg: '#E0F2FE',
    categoryColor: '#0284C7',
    mentorName: 'Alex Pratama',
    mentorAvatar: DEFAULT_AVATAR_URI,
    rating: 4.9,
    reviews: 240,
    totalLessons: 12,
    durationMinutes: 45,
    isPopular: true,
  },
  {
    id: 'mod-4',
    title: 'Strategi Digital Marketing & Social Media Ads',
    category: 'Bisnis & Karir',
    categoryBg: '#DCFCE7',
    categoryColor: '#16A34A',
    mentorName: 'Dina Anggraini',
    mentorAvatar: DEFAULT_AVATAR_URI,
    rating: 4.9,
    reviews: 86,
    totalLessons: 6,
    durationMinutes: 20,
    isPopular: false,
  },
  {
    id: 'mod-5',
    title: 'Dasar Bermain Gitar Akustik untuk Pemula',
    category: 'Musik',
    categoryBg: '#FEF9C3',
    categoryColor: '#CA8A04',
    mentorName: 'Rendy Music',
    mentorAvatar: DEFAULT_AVATAR_URI,
    rating: 4.7,
    reviews: 54,
    totalLessons: 8,
    durationMinutes: 30,
    isPopular: false,
  },
];

export default function ExploreScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const CATEGORIES = CATEGORY_META.map((c) => ({ ...c, name: t(c.nameKey) }));
  const [modules, setModules] = useState<any[]>(FALLBACK_EXPLORE_MODULES);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchModules = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('modules')
        .select(`
          id_module,
          title,
          description,
          category:categories(name),
          mentor:profiles!id_mentor(name, avatar_url)
        `)
        .eq('status', 'published');

      if (error) {
        console.log('Error fetching modules:', error);
      }

      if (data && data.length > 0) {
        const mapped = data.map((m, idx) => {
          const categoryName = (m.category as any)?.name || t('common.uncategorized');
          const mentorProf = m.mentor as any;
          return {
            id: m.id_module,
            title: m.title,
            category: categoryName,
            categoryBg: idx % 2 === 0 ? '#EDE9FE' : '#E0F2FE',
            categoryColor: idx % 2 === 0 ? '#7C3AED' : '#0284C7',
            mentorName: mentorProf?.name || 'Mentor Edumate',
            mentorAvatar: mentorProf?.avatar_url || DEFAULT_AVATAR_URI,
            totalLessons: 8,
            durationMinutes: 25,
            isPopular: idx === 0,
          };
        });
        setModules(mapped);
      }
    } catch (e) {
      console.log('Error fetching explore modules:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  // Fetch data saat layar pertama dibuka. fetchModules stabil (useCallback)
  // jadi effect ini cuma jalan sekali kecuali bahasa (t) berubah.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    fetchModules();
  }, [fetchModules]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const onRefresh = () => {
    setRefreshing(true);
    fetchModules();
  };

  const filteredModules = modules.filter((m) => {
    const matchesSearch =
      m.title.toLowerCase().includes(search.toLowerCase()) ||
      m.category.toLowerCase().includes(search.toLowerCase()) ||
      m.mentorName.toLowerCase().includes(search.toLowerCase());

    const matchesCategory =
      activeCategory === 'all' ||
      m.category.toLowerCase().includes(
        CATEGORY_META.find((c) => c.id === activeCategory)?.dbName.toLowerCase() || ''
      );

    return matchesSearch && matchesCategory;
  });

  return (
    <SafeAreaView style={styles.safe}>
      {/* ── Top Header ────────────────────────────────────────── */}
      <View style={styles.topHeader}>
        <Text style={styles.headerTitle}>{t('explore.headerTitle')}</Text>
        <Text style={styles.headerSubtitle}>
          {t('explore.headerSubtitle')}
        </Text>
      </View>

      {/* ── Search Bar ────────────────────────────────────────── */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={COLORS.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('explore.searchPlaceholder')}
            placeholderTextColor={COLORS.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={COLORS.textLight} />
            </TouchableOpacity>
          )}
        </View>

        {/* Category Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryChips}
        >
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.chip, isActive && styles.chipActive]}
                activeOpacity={0.8}
                onPress={() => setActiveCategory(cat.id)}
              >
                <Ionicons
                  name={cat.icon as any}
                  size={14}
                  color={isActive ? COLORS.white : COLORS.textLight}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Modules List ──────────────────────────────────────── */}
      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      >
        <View style={styles.resultHeader}>
          <Text style={styles.resultCount}>
            {t('explore.showingCount', { count: filteredModules.length })}
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.loadingText}>{t('explore.loadingModules')}</Text>
          </View>
        ) : filteredModules.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="book-outline" size={44} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>{t('explore.notFoundTitle')}</Text>
            <Text style={styles.emptySubtitle}>
              {t('explore.notFoundSubtitle')}
            </Text>
          </View>
        ) : (
          <View style={styles.modulesGrid}>
            {filteredModules.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.moduleCard}
                activeOpacity={0.9}
                onPress={() => router.push(`/modules/${item.id}` as any)}
              >
                {/* Placeholder Gambar Polos */}
                <View style={styles.coverPlaceholderWrap}>
                  <Ionicons name="image-outline" size={42} color="#94A3B8" />
                  <View style={[styles.categoryBadge, { backgroundColor: item.categoryBg }]}>
                    <Text style={[styles.categoryBadgeText, { color: item.categoryColor }]}>
                      {item.category}
                    </Text>
                  </View>
                  {item.isPopular && (
                    <View style={styles.popularBadge}>
                      <Text style={styles.popularText}>{t('explore.popular')}</Text>
                    </View>
                  )}
                </View>

                {/* Content */}
                <View style={styles.cardContent}>
                  <Text style={styles.moduleTitle} numberOfLines={2}>
                    {item.title}
                  </Text>

                  {/* Mentor Info */}
                  <View style={styles.mentorRow}>
                    <Image source={{ uri: item.mentorAvatar }} style={styles.mentorAvatar} />
                    <Text style={styles.mentorName} numberOfLines={1}>
                      {item.mentorName}
                    </Text>
                  </View>

                  {/* Footer Meta */}
                  <View style={styles.cardFooter}>
                    <View style={styles.footerItem}>
                      <Feather name="book-open" size={12} color={COLORS.textLight} />
                      <Text style={styles.footerText}>{t('explore.materials', { count: item.totalLessons })}</Text>
                    </View>
                    <View style={styles.metaDot} />
                    <View style={styles.footerItem}>
                      <Feather name="clock" size={12} color={COLORS.textLight} />
                      <Text style={styles.footerText}>{t('home.minutes', { count: item.durationMinutes })}</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  /* Top Header */
  topHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    fontSize: 13,
    color: COLORS.textLight,
    marginTop: 2,
  },

  /* Search & Filter Section */
  searchSection: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 6,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textDark,
  },
  categoryChips: {
    gap: 8,
    paddingBottom: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textLight,
  },
  chipTextActive: {
    color: COLORS.white,
    fontWeight: '700',
  },

  /* List */
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 32,
  },
  resultHeader: {
    marginBottom: 12,
  },
  resultCount: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textLight,
  },
  modulesGrid: {
    gap: 16,
  },
  moduleCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  coverPlaceholderWrap: {
    width: '100%',
    height: 135,
    position: 'relative',
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  popularBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  popularText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '800',
  },

  /* Card Content */
  cardContent: {
    padding: 14,
  },
  moduleTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textDark,
    lineHeight: 21,
    marginBottom: 10,
  },
  mentorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  mentorAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  mentorName: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textLight,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerText: {
    fontSize: 11,
    color: COLORS.textLight,
    fontWeight: '600',
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#CBD5E1',
    marginHorizontal: 8,
  },

  /* Loading & Empty */
  loadingBox: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: COLORS.textLight,
  },
  emptyBox: {
    paddingVertical: 50,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.textLight,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});