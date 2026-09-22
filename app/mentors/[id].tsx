import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Share
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { COLORS, PRIMARY_BUTTON_SHADOW } from '../../constants/brand';
import { DEFAULT_AVATAR_URI } from '../../constants/defaultAvatar';

const FALLBACK_MENTOR_DETAIL = {
  id: 'mentor-1',
  name: 'Sarah Designer',
  role: 'Senior UI/UX & Product Designer',
  avatar: DEFAULT_AVATAR_URI,
  isVerified: true,
  rating: 4.9,
  reviewsCount: 120,
  ratePerSession: 75000,
  bio: 'Pendidik & praktisi berpengalaman lebih dari 8 tahun di bidang Digital Product Design. Fokus mendampingi pemula untuk memahami konsep Auto Layout, Design System, hingga pembuatan portofolio yang siap kerja.',
  stats: [
    { labelKey: 'mentorProfile.statSessionsLabel', valueKey: 'mentorProfile.statSessionsValue', value: 45, bg: '#EDE9FE', color: '#7C3AED', icon: 'calendar' },
    { labelKey: 'mentorProfile.statModulesLabel', valueKey: 'mentorProfile.statModulesValue', value: 12, bg: '#E0F2FE', color: '#0284C7', icon: 'book' },
    { labelKey: 'mentorProfile.statRatingLabel', valueKey: 'mentorProfile.statRatingValue', value: 4.9, bg: '#FEF3C7', color: '#D97706', icon: 'star' },
    { labelKey: 'mentorProfile.statStudentsLabel', valueKey: 'mentorProfile.statStudentsValue', value: 120, bg: '#DCFCE7', color: '#16A34A', icon: 'users' },
  ],
  modules: [
    {
      id: 'mod-1',
      title: 'Belajar Auto Layout & Desain Responsif',
      category: 'UI/UX Design',
      categoryBg: '#EDE9FE',
      categoryColor: '#7C3AED',
      lessons: 8,
      durationMinutes: 25,
      image: 'https://images.unsplash.com/photo-1542744094-3a31f272c490?w=400',
    },
    {
      id: 'mod-2',
      title: 'Dasar Pembuatan Design System di Figma',
      category: 'UI/UX Design',
      categoryBg: '#E0F2FE',
      categoryColor: '#0284C7',
      lessons: 10,
      durationMinutes: 40,
      image: 'https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?w=400',
    },
  ],
  reviews: [
    {
      id: 'rev-1',
      userName: 'Rian Pratama',
      userAvatar: DEFAULT_AVATAR_URI,
      rating: 5,
      date: '3 hari yang lalu',
      comment: 'Sangat puas mentoring sama Kak Sarah! Penjelasan tentang Auto Layout langsung nempel dan portofolioku jadi jauh lebih rapi.',
    },
    {
      id: 'rev-2',
      userName: 'Nadia Syafira',
      userAvatar: DEFAULT_AVATAR_URI,
      rating: 5,
      date: '1 minggu yang lalu',
      comment: 'Kak Sarah sabar banget ngejelasin dari nol. Sesi 1 jam berasa padat ilmu dan sangat solutif buat kendala desainku.',
    },
  ],
};

export default function MentorProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [mentor, setMentor] = useState<any>(FALLBACK_MENTOR_DETAIL);
  const [loading, setLoading] = useState(true);
  const [isBookmarked, setIsBookmarked] = useState(false);

  useEffect(() => {
    async function loadMentor() {
      if (!id) {
        setLoading(false);
        return;
      }

      try {
        // `id` di route ini adalah profiles.id (mentor), supaya konsisten
        // dengan modules.id_mentor & mentor_bookings.id_mentor yang juga
        // nunjuk ke profiles.id. mentor_profiles diambil lewat user_id.
        const { data, error } = await supabase
          .from('mentor_profiles')
          .select(`
            id_mentor_profile,
            user_id,
            curriculum_vitae,
            rating_avg,
            total_sessions,
            rate_per_session,
            is_verified,
            profile:profiles!user_id(name, avatar_url)
          `)
          .eq('user_id', id)
          .single();

        if (error) console.log('Error fetching mentor detail:', error);

        if (data) {
          const prof = data.profile as any;

          // Query 2: modul milik mentor ini.
          const { data: moduleRows } = await supabase
            .from('modules')
            .select('id_module, title, category:categories(name)')
            .eq('id_mentor', id)
            .eq('status', 'published');

          const mappedModules = (moduleRows || []).map((m: any, i: number) => ({
            id: m.id_module,
            title: m.title,
            category: (m.category as any)?.name || t('common.uncategorized'),
            categoryBg: i % 2 === 0 ? '#EDE9FE' : '#E0F2FE',
            categoryColor: i % 2 === 0 ? '#7C3AED' : '#0284C7',
            lessons: 8,
            durationMinutes: 25,
            image: FALLBACK_MENTOR_DETAIL.modules[i % FALLBACK_MENTOR_DETAIL.modules.length].image,
          }));

          // Query 3: jumlah siswa unik yang sudah menyelesaikan sesi
          // dengan mentor ini (dihitung asli dari mentor_bookings).
          const { data: completedBookings } = await supabase
            .from('mentor_bookings')
            .select('id_student')
            .eq('id_mentor', id)
            .eq('status', 'completed');

          const uniqueStudents = new Set((completedBookings || []).map((b: any) => b.id_student)).size;

          setMentor({
            id,
            name: prof?.name || t('mentorProfile.defaultName'),
            role: t('mentorProfile.verifiedRole'),
            avatar: prof?.avatar_url || FALLBACK_MENTOR_DETAIL.avatar,
            isVerified: data.is_verified,
            rating: data.rating_avg != null ? Number(data.rating_avg) : 0,
            ratePerSession: data.rate_per_session != null ? Number(data.rate_per_session) : FALLBACK_MENTOR_DETAIL.ratePerSession,
            bio: data.curriculum_vitae || FALLBACK_MENTOR_DETAIL.bio,
            stats: [
              { ...FALLBACK_MENTOR_DETAIL.stats[0], value: data.total_sessions ?? 0 },
              { ...FALLBACK_MENTOR_DETAIL.stats[1], value: mappedModules.length },
              { ...FALLBACK_MENTOR_DETAIL.stats[2], value: data.rating_avg ?? 0 },
              { ...FALLBACK_MENTOR_DETAIL.stats[3], value: uniqueStudents },
            ],
            modules: mappedModules,
          });
        }
      } catch (e) {
        console.log('Error fetching mentor detail:', e);
      } finally {
        setLoading(false);
      }
    }

    loadMentor();
  }, [id, t]);

  const handleShare = async () => {
    try {
      await Share.share({
        message: t('mentorProfile.shareMessage', { name: mentor.name }),
      });
    } catch (e) {
      console.log('Share error:', e);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, styles.centerBox]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>{t('mentorProfile.loading')}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* ── Top Header (Fixed di luar ScrollView) ─────────────── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.headerButton}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={20} color={COLORS.textDark} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>{t('mentorProfile.headerTitle')}</Text>

        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={() => setIsBookmarked(!isBookmarked)}
            style={styles.headerButton}
            activeOpacity={0.8}
          >
            <Ionicons
              name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
              size={18}
              color={isBookmarked ? COLORS.primary : COLORS.textDark}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleShare}
            style={styles.headerButton}
            activeOpacity={0.8}
          >
            <Ionicons name="share-social-outline" size={18} color={COLORS.textDark} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Main Scroll Content ───────────────────────────────── */}
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Hero Section ────────────────────────────────────── */}
        <View style={styles.heroSection}>
          <View style={styles.avatarWrapper}>
            <Image source={{ uri: mentor.avatar }} style={styles.avatar} />
            {mentor.isVerified && (
              <View style={styles.verifiedBadge}>
                <MaterialCommunityIcons name="check-decagram" size={22} color={COLORS.primary} />
              </View>
            )}
          </View>

          <Text style={styles.name}>{mentor.name}</Text>
          <Text style={styles.roleTitle}>{mentor.role}</Text>

          {/* Rating Row */}
          <View style={styles.ratingRow}>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Ionicons key={s} name="star" size={14} color={COLORS.star} />
              ))}
            </View>
            <Text style={styles.ratingText}>
              {mentor.rating.toFixed(1)} ({t(mentor.stats?.[0]?.valueKey || 'mentorProfile.statSessionsValue', { count: mentor.stats?.[0]?.value ?? 0 })})
            </Text>
          </View>

          {/* Bio Box */}
          <Text style={styles.bioText}>{mentor.bio}</Text>

          {/* Price Pill Tag */}
          <View style={styles.pricePill}>
            <Text style={styles.pricePillText}>
              Rp {mentor.ratePerSession.toLocaleString('id-ID')}
            </Text>
            <Text style={styles.pricePillUnit}>{t('mentorProfile.perSessionUnit')}</Text>
          </View>
        </View>

        {/* ── 4 Stats Grid ─────────────────────────────────────── */}
        <View style={styles.statsGrid}>
          {mentor.stats.map((st: any, idx: number) => (
            <View key={idx} style={[styles.statBox, { backgroundColor: st.bg }]}>
              <Feather name={st.icon} size={16} color={st.color} style={{ marginBottom: 4 }} />
              <Text style={[styles.statBoxValue, { color: st.color }]}>{t(st.valueKey, { count: st.value })}</Text>
              <Text style={styles.statBoxLabel}>{t(st.labelKey)}</Text>
            </View>
          ))}
        </View>

        {/* ── Modul Pembelajaran ──────────────────────────────── */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>{t('mentorProfile.modulesSectionTitle')}</Text>
          <Text style={styles.sectionCount}>{t('mentorProfile.modulesCount', { count: mentor.modules.length })}</Text>
        </View>

        <View style={styles.modulesList}>
          {mentor.modules.map((m: any) => (
            <TouchableOpacity
              key={m.id}
              style={styles.moduleCard}
              activeOpacity={0.85}
              onPress={() => router.push(`/modules/${m.id}` as any)}
            >
              <Image source={{ uri: m.image }} style={styles.moduleThumbnail} />
              <View style={styles.moduleMeta}>
                <View style={[styles.moduleCatBadge, { backgroundColor: m.categoryBg }]}>
                  <Text style={[styles.moduleCatText, { color: m.categoryColor }]}>
                    {m.category}
                  </Text>
                </View>
                <Text style={styles.moduleCardTitle} numberOfLines={2}>
                  {m.title}
                </Text>
                <View style={styles.moduleDetailRow}>
                  <Feather name="book-open" size={12} color={COLORS.textLight} />
                  <Text style={styles.moduleDetailText}>{t('mentorProfile.lessonsCount', { count: m.lessons })}</Text>
                  <Text style={styles.dotSeparator}>•</Text>
                  <Feather name="clock" size={12} color={COLORS.textLight} />
                  <Text style={styles.moduleDetailText}>{t('mentorProfile.durationMinutes', { count: m.durationMinutes })}</Text>
                </View>
              </View>

              <Ionicons name="chevron-forward" size={18} color={COLORS.textLight} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* ── Sticky Bottom Action Bar (Di Luar ScrollView) ─────── */}
      <View style={styles.bottomBar}>
        <View style={styles.bottomPriceWrap}>
          <Text style={styles.bottomPriceLabel}>{t('mentorProfile.totalCost')}</Text>
          <Text style={styles.bottomPriceValue}>
            Rp {mentor.ratePerSession.toLocaleString('id-ID')}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.bookButton}
          activeOpacity={0.85}
          onPress={() => router.push(`/booking/${id}` as any)}
        >
          <Feather name="calendar" size={16} color={COLORS.white} style={{ marginRight: 6 }} />
          <Text style={styles.bookButtonText}>{t('mentorProfile.scheduleSession')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centerBox: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textLight,
  },

  /* ── HEADER ── */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F6',
  },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 0.3,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },

  /* ── SCROLL CONTENT ── */
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 110,
  },

  /* ── HERO SECTION ── */
  heroSection: {
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 12,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: '#EDF3F8',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.white,
    borderRadius: 12,
  },
  name: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textDark,
    marginBottom: 2,
  },
  roleTitle: {
    fontSize: 13,
    color: COLORS.textLight,
    marginBottom: 8,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 2,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  bioText: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  pricePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDF3F8',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D0DFEE',
  },
  pricePillText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primary,
  },
  pricePillUnit: {
    fontSize: 12,
    color: COLORS.textLight,
    fontWeight: '600',
  },

  /* ── 4 STATS GRID ── */
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 22,
  },
  statBox: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statBoxValue: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 2,
  },
  statBoxLabel: {
    fontSize: 10,
    color: COLORS.textLight,
    fontWeight: '600',
  },

  /* ── SECTION HEADER ── */
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  sectionCount: {
    fontSize: 12,
    color: COLORS.textLight,
    fontWeight: '600',
  },

  /* ── MODULES LIST ── */
  modulesList: {
    gap: 12,
    marginBottom: 24,
  },
  moduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  moduleThumbnail: {
    width: 68,
    height: 68,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
  },
  moduleMeta: {
    flex: 1,
    marginLeft: 12,
    marginRight: 6,
  },
  moduleCatBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 4,
  },
  moduleCatText: {
    fontSize: 9,
    fontWeight: '800',
  },
  moduleCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textDark,
    lineHeight: 18,
    marginBottom: 4,
  },
  moduleDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  moduleDetailText: {
    fontSize: 11,
    color: COLORS.textLight,
  },
  dotSeparator: {
    color: COLORS.textLight,
    fontSize: 10,
  },

  /* ── REVIEWS ── */
  reviewsList: {
    gap: 12,
    marginBottom: 16,
  },
  reviewCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E2E8F0',
  },
  reviewUserMeta: {
    flex: 1,
    marginLeft: 10,
  },
  reviewUserName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  reviewDate: {
    fontSize: 11,
    color: COLORS.textLight,
  },
  reviewStars: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewComment: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 19,
  },

  /* ── STICKY BOTTOM BAR ── */
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 8,
  },
  bottomPriceWrap: {
    flex: 1,
  },
  bottomPriceLabel: {
    fontSize: 11,
    color: COLORS.textLight,
  },
  bottomPriceValue: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.primary,
  },
  bookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    ...PRIMARY_BUTTON_SHADOW,
  },
  bookButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
});