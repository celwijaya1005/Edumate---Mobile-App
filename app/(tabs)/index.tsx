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
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants/brand';
import { DEFAULT_AVATAR_URI } from '../../constants/defaultAvatar';

const BG = '#FCF9F1';

const CATEGORY_META = [
  { id: 'all',      nameKey: 'home.categoryAll',      icon: 'apps',           bg: '#E8E0FF', color: '#7C3AED' },
  { id: 'uiux',     nameKey: 'home.categoryUiUx',     icon: 'color-palette',  bg: '#DBEAFE', color: '#1D4ED8' },
  { id: 'code',     nameKey: 'home.categoryCoding',   icon: 'code-slash',     bg: '#FCE7F3', color: '#DB2777' },
  { id: 'business', nameKey: 'home.categoryBusiness', icon: 'trending-up',    bg: '#FEF3C7', color: '#D97706' },
  { id: 'music',    nameKey: 'home.categoryMusic',    icon: 'musical-notes',  bg: '#DCFCE7', color: '#16A34A' },
];

const FALLBACK_MODULES = [
  {
    id: 'mod-1',
    title: 'Belajar Auto Layout dari Nol untuk Pemula',
    category: 'UI/UX',
    mentorName: 'Sarah Designer',
    mentorAvatar: DEFAULT_AVATAR_URI,
    mentorId: 'mentor-1',
    rating: 4.9,
    reviews: 120,
    lessons: 8,
    durationMinutes: 25,
  },
  {
    id: 'mod-2',
    title: 'Teknik Memasak Western Fine Dining di Rumah',
    category: 'Kuliner',
    mentorName: 'Chef Michael',
    mentorAvatar: DEFAULT_AVATAR_URI,
    mentorId: 'mentor-2',
    rating: 4.8,
    reviews: 95,
    lessons: 10,
    durationMinutes: 35,
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [userName, setUserName] = useState<string>('Pelajar');
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const categories = CATEGORY_META.map((c) => ({ ...c, name: t(c.nameKey) }));
  const [modules, setModules] = useState<any[]>(FALLBACK_MODULES);
  const [continueModule, setContinueModule] = useState<{ id: string; title: string; category: string; progressPct: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('name, avatar_url')
          .eq('id', session.user.id)
          .single();

        if (profile?.name) {
          setUserName(profile.name.split(' ')[0]);
        } else if (session.user.user_metadata?.name) {
          setUserName(session.user.user_metadata.name.split(' ')[0]);
        }
        if (profile?.avatar_url) setUserAvatar(profile.avatar_url);

        const { data: progressRows, error: progressError } = await supabase
          .from('module_content_progress')
          .select(`
            opened_at,
            content:module_contents(
              module:modules(id_module, title, category:categories(name))
            )
          `)
          .eq('id_user', session.user.id)
          .order('opened_at', { ascending: false });

        if (progressError) console.log('Error fetching progress:', progressError);

        const seenModuleIds = new Set<string>();
        const recentModules: { id: string; title: string; category: string }[] = [];
        (progressRows || []).forEach((row: any) => {
          const mod = row.content?.module;
          if (mod && !seenModuleIds.has(mod.id_module)) {
            seenModuleIds.add(mod.id_module);
            recentModules.push({ id: mod.id_module, title: mod.title, category: mod.category?.name || 'Umum' });
          }
        });

        for (const mod of recentModules) {
          const { count: totalCount } = await supabase
            .from('module_contents')
            .select('id_content', { count: 'exact', head: true })
            .eq('module_id', mod.id);

          const openedCount = (progressRows || []).filter(
            (r: any) => r.content?.module?.id_module === mod.id
          ).length;

          const total = totalCount || 0;
          if (total === 0) continue;

          let isQuizPassed = false;
          const { data: quizRow } = await supabase
            .from('quizzes')
            .select('id_quiz')
            .eq('id_module', mod.id)
            .maybeSingle();

          if (quizRow) {
            const { data: bestAttempt } = await supabase
              .from('quiz_attempts')
              .select('score')
              .eq('id_quiz', quizRow.id_quiz)
              .eq('id_user', session.user.id)
              .order('score', { ascending: false })
              .limit(1)
              .maybeSingle();
            if (bestAttempt && Number(bestAttempt.score) >= 70) isQuizPassed = true;
          }

          const isFullyDone = openedCount >= total && isQuizPassed;
          if (!isFullyDone) {
            setContinueModule({
              id: mod.id,
              title: mod.title,
              category: mod.category,
              progressPct: Math.round((openedCount / total) * 100),
            });
            break;
          }
        }
      }

      const { data: dbModules, error: modulesError } = await supabase
        .from('modules')
        .select(`
          id_module, title,
          category:categories(name),
          mentor:profiles!id_mentor(name, avatar_url)
        `)
        .eq('status', 'published')
        .limit(10);

      if (modulesError) {
        console.log('Error fetching modules:', modulesError);
      }

      if (dbModules && dbModules.length > 0) {
        setModules(
          dbModules.map((m, i) => {
            const mentorProfile = m.mentor as any;
            return {
              id: m.id_module,
              title: m.title,
              category: (m.category as any)?.name || 'Umum',
              mentorName: mentorProfile?.name || 'Mentor Edumate',
              mentorAvatar: mentorProfile?.avatar_url || FALLBACK_MODULES[0].mentorAvatar,
              lessons: 6 + i,
              durationMinutes: 20 + i * 5,
            };
          })
        );
      }
    } catch (e) {
      console.log('Error loading home data:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // fetchData stabil (useCallback, deps kosong) jadi effect ini cuma jalan
  // sekali saat layar pertama dibuka.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => { fetchData(); }, [fetchData]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const filteredModules = modules.filter((m) => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      m.title.toLowerCase().includes(q) ||
      m.category.toLowerCase().includes(q) ||
      m.mentorName.toLowerCase().includes(q);
    const matchCat =
      selectedCategory === 'all' ||
      m.category.toLowerCase() === selectedCategory.toLowerCase();
    return matchSearch && matchCat;
  });

  return (
    <SafeAreaView style={styles.safe}>
      {/* ── Header ── */}
      <View style={styles.topHeader}>
        <View style={styles.logoRow}>
          <Image source={require('../../assets/images/logo.png')} style={styles.logoImage} />
          <Text style={styles.logoText}>{t('common.appName')}</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.iconBtn}
            activeOpacity={0.8}
            onPress={() => router.push('/notifications')}
          >
            <Ionicons name="notifications-outline" size={22} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.avatarButton}
            activeOpacity={0.8}
            onPress={() => router.push('/(tabs)/profile')}
          >
            <Image
              source={{ uri: userAvatar || DEFAULT_AVATAR_URI }}
              style={styles.avatarImg}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
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
        {/* ── Greeting ── */}
        <View style={styles.greetingWrap}>
          <Text style={styles.greetingTitle}>
            {t('home.greeting', { name: userName })} <Text style={styles.waveHand}>👋</Text>
          </Text>
          <Text style={styles.greetingSubtitle}>{t('home.greetingSubtitle')}</Text>
        </View>

        {/* ── Search Bar ── */}
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color={COLORS.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('home.searchPlaceholder')}
            placeholderTextColor={COLORS.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* ── Lanjutkan Belajar ── */}
        {continueModule && (
          <TouchableOpacity
            style={styles.continueCard}
            activeOpacity={0.9}
            onPress={() => router.push(`/modules/${continueModule.id}` as any)}
          >
            <View style={styles.continueIconWrap}>
              <Ionicons name="play-circle" size={28} color="#FFFFFF" />
            </View>
            <View style={styles.continueRight}>
              <Text style={styles.continueTag}>{t('home.continueLearning')}</Text>
              <Text style={styles.continueTitle} numberOfLines={1}>
                {continueModule.title}
              </Text>
              <View style={styles.progressRow}>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${continueModule.progressPct}%` }]} />
                </View>
                <Text style={styles.progressPct}>{continueModule.progressPct}%</Text>
              </View>
            </View>
            <View style={styles.continueArrow}>
              <Ionicons name="chevron-forward" size={20} color={COLORS.primary} />
            </View>
          </TouchableOpacity>
        )}

        {/* ── Kategori Populer ── */}
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionHeading}>{t('home.popularCategories')}</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/explore')}>
            <Text style={styles.seeAllText}>{t('home.seeAll')}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesScroll}
        >
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={styles.categoryItem}
                activeOpacity={0.75}
                onPress={() => setSelectedCategory(isSelected ? 'all' : cat.id)}
              >
                <View
                  style={[
                    styles.categoryIconWrap,
                    { backgroundColor: isSelected ? COLORS.primary : cat.bg },
                  ]}
                >
                  <Ionicons
                    name={cat.icon as any}
                    size={22}
                    color={isSelected ? '#FFFFFF' : cat.color}
                  />
                </View>
                <Text style={[styles.categoryLabel, isSelected && styles.categoryLabelActive]}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Modul Pilihan ── */}
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionHeading}>{t('home.chosenModules')}</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/explore')}>
            <Text style={styles.seeAllText}>{t('home.seeAll')}</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.loadingText}>{t('home.loadingModules')}</Text>
          </View>
        ) : (
          <View style={styles.modulesList}>
            {filteredModules.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.moduleCard}
                activeOpacity={0.9}
                onPress={() => router.push(`/modules/${item.id}` as any)}
              >
                {/* Cover Image Placeholder (Ikon Gambar Polos) */}
                <View style={styles.coverPlaceholderWrap}>
                  <Ionicons name="image-outline" size={40} color="#94A3B8" />
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryBadgeText}>{item.category}</Text>
                  </View>
                  <View style={styles.freeBadge}>
                    <Ionicons name="gift-outline" size={11} color="#16A34A" />
                    <Text style={styles.freeBadgeText}>{t('home.free')}</Text>
                  </View>
                </View>

                {/* Card Content */}
                <View style={styles.moduleContent}>
                  <Text style={styles.moduleTitle} numberOfLines={2}>
                    {item.title}
                  </Text>

                  {/* Mentor */}
                  <View style={styles.mentorRow}>
                    <Image source={{ uri: item.mentorAvatar }} style={styles.mentorAvatar} />
                    <Text style={styles.mentorName} numberOfLines={1}>{item.mentorName}</Text>
                  </View>

                  {/* Footer: lessons + duration */}
                  <View style={styles.moduleFooter}>
                    <View style={styles.footerItem}>
                      <Ionicons name="book-outline" size={14} color={COLORS.textLight} />
                      <Text style={styles.footerText}>{t('home.lessons', { count: item.lessons })}</Text>
                    </View>
                    <View style={styles.footerDivider} />
                    <View style={styles.footerItem}>
                      <Ionicons name="time-outline" size={14} color={COLORS.textLight} />
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
  safe: { flex: 1, backgroundColor: BG },

  /* ── HEADER ── */
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: BG,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoImage: { width: 22, height: 22, resizeMode: 'contain' },
  logoText: { fontSize: 18, fontWeight: '800', color: COLORS.primary, letterSpacing: 0.2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  avatarButton: { padding: 0 },
  avatarImg: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: '#FFFFFF' },

  /* ── SCROLL ── */
  scrollContent: { paddingHorizontal: 20, paddingBottom: 48, paddingTop: 4 },

  /* ── GREETING ── */
  greetingWrap: { marginBottom: 16, marginTop: 4 },
  greetingTitle: { fontSize: 24, fontWeight: '800', color: COLORS.primary, marginBottom: 2 },
  waveHand: { fontSize: 22 },
  greetingSubtitle: { fontSize: 14, color: COLORS.textLight },

  /* ── SEARCH ── */
  searchContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 99,
    paddingHorizontal: 18, paddingVertical: 12, marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.textDark },

  /* ── LANJUTKAN BELAJAR ── */
  continueCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, marginBottom: 28,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07, shadowRadius: 12, elevation: 3,
  },
  continueIconWrap: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: '#7C6FF7',
    justifyContent: 'center', alignItems: 'center', marginRight: 14, flexShrink: 0,
  },
  continueRight: { flex: 1 },
  continueTag: {
    fontSize: 10, fontWeight: '700', color: COLORS.textLight,
    marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.6,
  },
  continueTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textDark, marginBottom: 10 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#EDE9FE' },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: '#7C6FF7' },
  progressPct: { fontSize: 11, fontWeight: '700', color: '#7C6FF7' },
  continueArrow: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center', alignItems: 'center', marginLeft: 8, flexShrink: 0,
  },

  /* ── SECTION HEADINGS ── */
  sectionTitleRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16,
  },
  sectionHeading: { fontSize: 17, fontWeight: '800', color: COLORS.textDark },
  seeAllText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },

  /* ── KATEGORI ── */
  categoriesScroll: { gap: 14, paddingBottom: 24, paddingRight: 4 },
  categoryItem: { alignItems: 'center', gap: 7, width: 64 },
  categoryIconWrap: { width: 52, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  categoryLabel: { fontSize: 11, fontWeight: '600', color: COLORS.textLight, textAlign: 'center' },
  categoryLabelActive: { color: COLORS.primary, fontWeight: '700' },

  /* ── MODUL CARDS ── */
  modulesList: { gap: 18 },
  moduleCard: {
    backgroundColor: '#FFFFFF', borderRadius: 20, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07, shadowRadius: 12, elevation: 3,
  },
  coverPlaceholderWrap: {
    width: '100%', height: 130, position: 'relative',
    backgroundColor: '#F1F5F9',
    justifyContent: 'center', alignItems: 'center',
  },
  categoryBadge: {
    position: 'absolute', top: 12, left: 12,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 99,
  },
  categoryBadgeText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },
  freeBadge: {
    position: 'absolute', top: 12, right: 12,
    backgroundColor: '#DCFCE7',
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99,
  },
  freeBadgeText: { fontSize: 11, fontWeight: '700', color: '#16A34A' },
  moduleContent: { padding: 16 },
  moduleTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textDark, marginBottom: 10, lineHeight: 22 },
  mentorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  mentorAvatar: { width: 26, height: 26, borderRadius: 13, marginRight: 8 },
  mentorName: { fontSize: 13, fontWeight: '600', color: COLORS.textLight, flex: 1 },
  moduleFooter: {
    flexDirection: 'row', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 12,
    gap: 10,
  },
  footerItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  footerText: { fontSize: 12, color: COLORS.textLight, fontWeight: '500' },
  footerDivider: { width: 1, height: 14, backgroundColor: '#E2E8F0' },

  /* ── LOADING ── */
  loadingBox: { paddingVertical: 32, alignItems: 'center', gap: 8 },
  loadingText: { fontSize: 13, color: COLORS.textLight },
});