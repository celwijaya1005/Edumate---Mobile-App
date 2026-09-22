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
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants/brand';
import { DEFAULT_AVATAR_URI } from '../../constants/defaultAvatar';

const FALLBACK_MENTORS = [
  {
    id: 'mentor-1',
    name: 'Sarah Designer',
    role: 'Senior UI/UX Designer',
    avatar: DEFAULT_AVATAR_URI,
    rating: 4.9,
    reviews: 120,
    totalSessions: 45,
    ratePerSession: 75000,
    expertise: 'UI/UX Design • Figma • Design System',
    isVerified: true,
  },
  {
    id: 'mentor-2',
    name: 'Alex Pratama',
    role: 'Fullstack Web Engineer',
    avatar: DEFAULT_AVATAR_URI,
    rating: 4.8,
    reviews: 98,
    totalSessions: 38,
    ratePerSession: 90000,
    expertise: 'React • Node.js • TypeScript',
    isVerified: true,
  },
  {
    id: 'mentor-3',
    name: 'Chef Michael',
    role: 'Executive Chef & Culinary Mentor',
    avatar: DEFAULT_AVATAR_URI,
    rating: 5.0,
    reviews: 85,
    totalSessions: 52,
    ratePerSession: 85000,
    expertise: 'Western Cuisine • Pastry • Food Plating',
    isVerified: true,
  },
  {
    id: 'mentor-4',
    name: 'Dina Anggraini',
    role: 'Digital Marketing Strategist',
    avatar: DEFAULT_AVATAR_URI,
    rating: 4.9,
    reviews: 64,
    totalSessions: 30,
    ratePerSession: 80000,
    expertise: 'SEO • Content Marketing • Ads Strategy',
    isVerified: true,
  },
];

export default function MentorListScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [mentors, setMentors] = useState<any[]>(FALLBACK_MENTORS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');

  const CATEGORY_OPTIONS = [
    { id: 'all',      label: t('mentor.categoryAll') },
    { id: 'uiux',     label: t('mentor.categoryUiUx') },
    { id: 'coding',   label: t('mentor.categoryCoding') },
    { id: 'culinary', label: t('mentor.categoryCulinary') },
    { id: 'business', label: t('mentor.categoryBusiness') },
  ];

  const fetchMentors = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('mentor_profiles')
        .select(`
          user_id,
          expertise,
          rate_per_session,
          rating_avg,
          total_sessions,
          is_verified,
          profile:profiles!user_id(name, avatar_url)
        `)
        .eq('is_verified', true);

      if (error) console.log('Error fetching mentors:', error);

      if (data && data.length > 0) {
        const mapped = data.map((item: any, idx: number) => {
          const prof = item.profile as any;
          const fallback = FALLBACK_MENTORS[idx % FALLBACK_MENTORS.length];
          return {
            id: item.user_id,
            name: prof?.name || fallback.name,
            role: t('mentor.verifiedMentor'),
            avatar: prof?.avatar_url || fallback.avatar,
            rating: item.rating_avg != null ? Number(item.rating_avg) : 0,
            reviews: item.total_sessions ?? 0,
            totalSessions: item.total_sessions ?? 0,
            ratePerSession: item.rate_per_session != null ? Number(item.rate_per_session) : fallback.ratePerSession,
            expertise: item.expertise || fallback.expertise,
            isVerified: item.is_verified,
          };
        });
        setMentors(mapped);
      } else {
        setMentors([]);
      }
    } catch (e) {
      console.log('Error fetching mentors:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount pattern; setState runs after the async call resolves, not synchronously in the effect body
    fetchMentors();
  }, [fetchMentors]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchMentors();
  };

  const filtered = mentors.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.expertise.toLowerCase().includes(search.toLowerCase()) ||
      m.role.toLowerCase().includes(search.toLowerCase());

    const matchesCategory =
      activeCategory === 'all' ||
      m.expertise.toLowerCase().includes(activeCategory === 'uiux' ? 'ui' : activeCategory.toLowerCase()) ||
      m.role.toLowerCase().includes(activeCategory.toLowerCase());

    return matchesSearch && matchesCategory;
  });

  return (
    <SafeAreaView style={styles.safe}>
      {/* ── Top Header ────────────────────────────────────────── */}
      <View style={styles.topHeader}>
        <Text style={styles.headerTitle}>{t('mentor.headerTitle')}</Text>
        <Text style={styles.headerSubtitle}>{t('mentor.headerSubtitle')}</Text>
      </View>

      {/* ── Search Bar ────────────────────────────────────────── */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={COLORS.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('mentor.searchPlaceholder')}
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

        {/* Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryChips}
        >
          {CATEGORY_OPTIONS.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.chip, isActive && styles.chipActive]}
                activeOpacity={0.8}
                onPress={() => setActiveCategory(cat.id)}
              >
                <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Mentor List ───────────────────────────────────────── */}
      <ScrollView
        contentContainerStyle={styles.list}
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
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.loadingText}>{t('mentor.loadingMentors')}</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="search" size={40} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>{t('mentor.notFoundTitle')}</Text>
            <Text style={styles.emptySubtitle}>{t('mentor.notFoundSubtitle')}</Text>
          </View>
        ) : (
          filtered.map((m) => (
            <TouchableOpacity
              key={m.id}
              style={styles.mentorCard}
              activeOpacity={0.9}
              onPress={() => router.push(`/mentors/${m.id}`)}
            >
              {/* Header Kartu: Avatar + Nama + Harga */}
              <View style={styles.cardHeader}>
                <View style={styles.avatarWrap}>
                  <Image source={{ uri: m.avatar }} style={styles.avatar} />
                  {m.isVerified && (
                    <View style={styles.verifiedBadge}>
                      <MaterialCommunityIcons name="check-decagram" size={14} color={COLORS.primary} />
                    </View>
                  )}
                </View>

                <View style={styles.mentorMeta}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name}>{m.name}</Text>
                  </View>
                  <Text style={styles.role} numberOfLines={1}>{m.role}</Text>

                  <View style={styles.ratingRow}>
                    <Ionicons name="star" size={13} color={COLORS.star} />
                    <Text style={styles.ratingValue}>{m.rating}</Text>
                    <Text style={styles.reviewsCount}>{t('mentor.sessions', { count: m.reviews })}</Text>
                  </View>
                </View>

                {/* Price Tag */}
                <View style={styles.priceContainer}>
                  <Text style={styles.priceText}>
                    Rp{m.ratePerSession.toLocaleString('id-ID')}
                  </Text>
                  <Text style={styles.priceUnit}>{t('mentor.perSession')}</Text>
                </View>
              </View>

              {/* Keahlian Tags */}
              <View style={styles.expertiseRow}>
                <Text style={styles.expertiseText} numberOfLines={1}>
                  💡 {m.expertise}
                </Text>
              </View>

              {/* Action Footer */}
              <View style={styles.cardFooter}>
                <View style={styles.sessionCountBadge}>
                  <Feather name="calendar" size={12} color={COLORS.primary} />
                  <Text style={styles.sessionCountText}>{t('mentor.sessionsCompleted', { count: m.totalSessions })}</Text>
                </View>

                <View style={styles.bookAction}>
                  <Text style={styles.bookActionText}>{t('mentor.viewProfile')}</Text>
                  <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
                </View>
              </View>
            </TouchableOpacity>
          ))
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
    paddingTop: 18,
    paddingBottom: 16,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textDark,
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    fontSize: 13,
    color: COLORS.textLight,
    marginTop: 4,
    lineHeight: 18,
  },

  /* Search Section */
  searchSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  searchIcon: { marginRight: 2 },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textDark,
    padding: 0,
  },

  /* Category Chips */
  categoryChips: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 2,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 99,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: COLORS.textDark,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },

  /* List */
  list: {
    padding: 16,
    gap: 12,
  },
  loadingBox: {
    paddingTop: 60,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: COLORS.textLight,
  },
  emptyBox: {
    paddingTop: 60,
    alignItems: 'center',
    gap: 10,
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
    paddingHorizontal: 30,
  },

  /* Mentor Card */
  mentorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: COLORS.track,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  mentorMeta: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  role: {
    fontSize: 12,
    color: COLORS.textLight,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  ratingValue: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  reviewsCount: {
    fontSize: 11,
    color: COLORS.textLight,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  priceText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primary,
  },
  priceUnit: {
    fontSize: 10,
    color: COLORS.textLight,
    marginTop: 1,
  },

  /* Expertise */
  expertiseRow: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  expertiseText: {
    fontSize: 12,
    color: COLORS.textDark,
    fontWeight: '500',
  },

  /* Footer */
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sessionCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 99,
  },
  sessionCountText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.primary,
  },
  bookAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bookActionText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.primary,
  },
});