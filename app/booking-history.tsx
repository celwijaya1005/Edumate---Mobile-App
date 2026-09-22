import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { COLORS } from '../constants/brand';
import { DEFAULT_AVATAR_URI as DEFAULT_AVATAR } from '../constants/defaultAvatar';

const BG = '#FCF9F1';

type BookingItem = {
  id: string;
  mentorId: string;
  mentorName: string;
  mentorAvatar: string;
  moduleTitle: string | null;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  scheduledAt: string;
  durationMinutes: number;
  totalAmount: number;
  meetingLink: string | null;
  notes: string | null;
  ratingStars: number | null;
};

export default function BookingHistoryScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
    pending:   { label: t('bookingHistory.statusPending'),   color: '#D97706', bg: '#FFFBEB', icon: 'time-outline' },
    confirmed: { label: t('bookingHistory.statusConfirmed'), color: '#0284C7', bg: '#E0F2FE', icon: 'checkmark-circle-outline' },
    completed: { label: t('bookingHistory.statusCompleted'), color: '#16A34A', bg: '#F0FDF4', icon: 'trophy-outline' },
    cancelled: { label: t('bookingHistory.statusCancelled'), color: '#DC2626', bg: '#FEF2F2', icon: 'close-circle-outline' },
  };
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bookings, setBookings] = useState<BookingItem[]>([]);

  const loadBookings = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { setLoading(false); return; }

      const { data, error } = await supabase
        .from('mentor_bookings')
        .select(`
          id_booking, status, scheduled_at, duration_minutes, total_amount, meeting_link, notes,
          mentor:profiles!id_mentor(id, name, avatar_url),
          module:modules(title)
        `)
        .eq('id_student', session.user.id)
        .order('scheduled_at', { ascending: false });

      if (error) console.log('Error fetching booking history:', error);

      const { data: ratingRows, error: ratingError } = await supabase
        .from('mentor_ratings')
        .select('id_booking, stars')
        .eq('id_student', session.user.id);

      if (ratingError) console.log('Error fetching ratings:', ratingError);
      const ratingMap = new Map((ratingRows || []).map((r: any) => [r.id_booking, r.stars]));

      const mapped: BookingItem[] = (data || []).map((b: any) => ({
        id: b.id_booking,
        mentorId: b.mentor?.id || '',
        mentorName: b.mentor?.name || 'Mentor',
        mentorAvatar: b.mentor?.avatar_url || DEFAULT_AVATAR,
        moduleTitle: b.module?.title || null,
        status: b.status,
        scheduledAt: b.scheduled_at,
        durationMinutes: b.duration_minutes,
        totalAmount: Number(b.total_amount || 0),
        meetingLink: b.meeting_link,
        notes: b.notes,
        ratingStars: ratingMap.get(b.id_booking) ?? null,
      }));

      setBookings(mapped);
    } catch (e) {
      console.log('Error loading booking history:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadBookings();
    }, [loadBookings])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadBookings();
  };

  const handleOpenMeeting = async (link: string) => {
    try {
      const canOpen = await Linking.canOpenURL(link);
      if (canOpen) await Linking.openURL(link);
      else Alert.alert(t('bookingHistory.cannotOpenLink'), link);
    } catch {
      Alert.alert(t('bookingHistory.failedOpenLink'), '');
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const locale = t('common.back') === 'Back' ? 'en-US' : 'id-ID';
    return d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) +
      ' · ' + d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  };

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
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('bookingHistory.headerTitle')}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {bookings.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="calendar-outline" size={32} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>{t('bookingHistory.emptyText')}</Text>
            <TouchableOpacity style={styles.emptyCta} onPress={() => router.push('/(tabs)/mentor')}>
              <Text style={styles.emptyCtaText}>{t('bookingHistory.findMentor')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {bookings.map((b) => {
              const meta = STATUS_META[b.status] || STATUS_META.pending;
              return (
                <TouchableOpacity
                  key={b.id}
                  style={styles.card}
                  activeOpacity={0.85}
                  onPress={() => b.mentorId && router.push(`/mentors/${b.mentorId}` as any)}
                >
                  <View style={styles.cardTopRow}>
                    <Image source={{ uri: b.mentorAvatar }} style={styles.avatar} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.mentorName}>{b.mentorName}</Text>
                      {!!b.moduleTitle && (
                        <Text style={styles.moduleTitle} numberOfLines={1}>{t('bookingHistory.relatedTo', { title: b.moduleTitle })}</Text>
                      )}
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
                      <Ionicons name={meta.icon} size={12} color={meta.color} />
                      <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
                    </View>
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.cardBottomRow}>
                    <View style={styles.infoItem}>
                      <Ionicons name="calendar-outline" size={13} color={COLORS.textLight} />
                      <Text style={styles.infoText}>{formatDate(b.scheduledAt)}</Text>
                    </View>
                    <View style={styles.infoItem}>
                      <Ionicons name="time-outline" size={13} color={COLORS.textLight} />
                      <Text style={styles.infoText}>{t('bookingHistory.minutes', { count: b.durationMinutes })}</Text>
                    </View>
                  </View>

                  <View style={styles.cardBottomRow}>
                    <Text style={styles.priceText}>Rp{b.totalAmount.toLocaleString('id-ID')}</Text>
                    {b.status === 'confirmed' && !!b.meetingLink && (
                      <TouchableOpacity
                        style={styles.joinButton}
                        onPress={() => handleOpenMeeting(b.meetingLink!)}
                      >
                        <Ionicons name="videocam-outline" size={14} color={COLORS.white} />
                         <Text style={styles.joinButtonText}>{t('bookingHistory.joinSession')}</Text>
                      </TouchableOpacity>
                    )}
                    {b.status === 'completed' && (
                      b.ratingStars ? (
                        <View style={styles.ratedBadge}>
                          <Ionicons name="star" size={13} color="#F59E0B" />
                          <Text style={styles.ratedBadgeText}>{b.ratingStars.toFixed(0)}/5</Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.rateButton}
                          onPress={() => router.push(`/rating/${b.id}` as any)}
                        >
                          <Ionicons name="star-outline" size={14} color={COLORS.primary} />
                          <Text style={styles.rateButtonText}>{t('bookingHistory.giveRating')}</Text>
                        </TouchableOpacity>
                      )
                    )}
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

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textDark },

  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },

  emptyBox: { alignItems: 'center', gap: 10, paddingVertical: 60 },
  emptyText: { fontSize: 13, color: COLORS.textLight, textAlign: 'center' },
  emptyCta: { backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 99, marginTop: 6 },
  emptyCtaText: { color: COLORS.white, fontWeight: '700', fontSize: 13 },

  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: '#F1F5F9',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.track },
  mentorName: { fontSize: 14, fontWeight: '700', color: COLORS.textDark },
  moduleTitle: { fontSize: 11, color: COLORS.textLight, marginTop: 2 },

  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 9, paddingVertical: 5, borderRadius: 99,
  },
  statusText: { fontSize: 10, fontWeight: '700' },

  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 12 },

  cardBottomRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6,
  },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  infoText: { fontSize: 11.5, color: COLORS.textLight },

  priceText: { fontSize: 14, fontWeight: '800', color: COLORS.primary },
  joinButton: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#16A34A', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99,
  },
  joinButtonText: { color: COLORS.white, fontSize: 11.5, fontWeight: '700' },

  rateButton: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: COLORS.primaryLight, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99,
  },
  rateButtonText: { color: COLORS.primary, fontSize: 11.5, fontWeight: '700' },
  ratedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FEF3C7', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 99,
  },
  ratedBadgeText: { color: '#D97706', fontSize: 11.5, fontWeight: '700' },
});