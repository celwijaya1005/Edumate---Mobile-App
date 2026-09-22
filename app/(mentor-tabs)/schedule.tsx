import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useCallback } from 'react';
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
  Alert,
  Linking,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { COLORS } from '@/constants/brand';
import { DEFAULT_AVATAR_URI as DEFAULT_AVATAR } from '@/constants/defaultAvatar';

const BG = '#FCF9F1';

type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

type BookingItem = {
  id: string;
  studentName: string;
  studentAvatar: string;
  status: BookingStatus;
  scheduledAt: string;
  durationMinutes: number;
  totalAmount: number;
  meetingLink: string | null;
};

const STATUS_META: Record<BookingStatus, { labelKey: string; color: string; bg: string }> = {
  pending: { labelKey: 'mentorSchedule.statusPending', color: '#D97706', bg: '#FFFBEB' },
  confirmed: { labelKey: 'mentorSchedule.statusConfirmed', color: '#0284C7', bg: '#E0F2FE' },
  completed: { labelKey: 'mentorSchedule.statusCompleted', color: '#16A34A', bg: '#F0FDF4' },
  cancelled: { labelKey: 'mentorSchedule.statusCancelled', color: '#DC2626', bg: '#FEF2F2' },
};

const FILTERS: { key: 'all' | BookingStatus; labelKey: string }[] = [
  { key: 'all', labelKey: 'myModules.filterAll' },
  { key: 'confirmed', labelKey: 'mentorSchedule.statusConfirmed' },
  { key: 'completed', labelKey: 'mentorSchedule.statusCompleted' },
  { key: 'cancelled', labelKey: 'mentorSchedule.statusCancelled' },
];

export default function MentorScheduleScreen() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [filter, setFilter] = useState<'all' | BookingStatus>('all');
  const [linkDrafts, setLinkDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadBookings = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { setLoading(false); return; }

      const { data, error } = await supabase
        .from('mentor_bookings')
        .select(`
          id_booking, status, scheduled_at, duration_minutes, total_amount, meeting_link,
          student:profiles!id_student(name, avatar_url)
        `)
        .eq('id_mentor', session.user.id)
        .order('scheduled_at', { ascending: false });

      if (error) console.log('Error fetching mentor schedule:', error);

      setBookings((data || []).map((b: any) => ({
        id: b.id_booking,
        studentName: b.student?.name || t('mentorDashboard.defaultStudentName'),
        studentAvatar: b.student?.avatar_url || DEFAULT_AVATAR,
        status: b.status,
        scheduledAt: b.scheduled_at,
        durationMinutes: b.duration_minutes,
        totalAmount: Number(b.total_amount || 0),
        meetingLink: b.meeting_link,
      })));
    } catch (e) {
      console.log('Error loading mentor schedule:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      loadBookings();
    }, [loadBookings])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadBookings();
  };

  const handleSaveLink = async (bookingId: string) => {
    const link = (linkDrafts[bookingId] || '').trim();
    if (!link) {
      Alert.alert(t('mentorSchedule.emptyLinkTitle'), t('mentorSchedule.emptyLinkMsg'));
      return;
    }
    setSavingId(bookingId);
    try {
      const { error } = await supabase
        .from('mentor_bookings')
        .update({ meeting_link: link })
        .eq('id_booking', bookingId);

      if (error) {
        console.log('Error saving meeting link:', error);
        Alert.alert(t('mentorDashboard.respondFailedTitle'), t('mentorDashboard.respondFailedMsg'));
        return;
      }
      await loadBookings();
    } catch (e) {
      console.log('Error saving meeting link:', e);
    } finally {
      setSavingId(null);
    }
  };

  const handleMarkCompleted = async (booking: BookingItem) => {
    Alert.alert(
      t('mentorSchedule.markCompletedConfirmTitle'),
      t('mentorSchedule.markCompletedConfirmMsg', { name: booking.studentName }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('mentorSchedule.yesCompleted'),
          onPress: async () => {
            setSavingId(booking.id);
            try {
              const { error } = await supabase
                .from('mentor_bookings')
                .update({ status: 'completed' })
                .eq('id_booking', booking.id);

              if (error) {
                console.log('Error marking booking completed:', error);
                Alert.alert(t('mentorDashboard.respondFailedTitle'), t('mentorDashboard.respondFailedMsg'));
                return;
              }

              const { data: { session } } = await supabase.auth.getSession();
              if (session?.user) {
                const { data: mp } = await supabase
                  .from('mentor_profiles')
                  .select('id_mentor_profile, total_sessions')
                  .eq('user_id', session.user.id)
                  .maybeSingle();
                if (mp) {
                  await supabase
                    .from('mentor_profiles')
                    .update({ total_sessions: (mp.total_sessions ?? 0) + 1 })
                    .eq('id_mentor_profile', mp.id_mentor_profile);
                }
              }

              await loadBookings();
            } catch (e) {
              console.log('Error completing booking:', e);
            } finally {
              setSavingId(null);
            }
          },
        },
      ]
    );
  };

  const handleOpenMeeting = async (link: string) => {
    try {
      const canOpen = await Linking.canOpenURL(link);
      if (canOpen) await Linking.openURL(link);
      else Alert.alert(t('moduleDetail.linkErrorTitle'), link);
    } catch {
      Alert.alert(t('moduleDetail.linkErrorFailedTitle'), t('moduleDetail.linkErrorFailedMsg'));
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' }) +
      ' · ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  };

  const filteredBookings = filter === 'all' ? bookings : bookings.filter((b) => b.status === filter);

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
        <Text style={styles.headerTitle}>{t('mentorSchedule.headerTitle')}</Text>
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
        {filteredBookings.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="calendar-outline" size={30} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>{t('mentorSchedule.emptyNoSchedule')}</Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {filteredBookings.map((b) => {
              const meta = STATUS_META[b.status];
              return (
                <View key={b.id} style={styles.card}>
                  <View style={styles.cardTopRow}>
                    <Image source={{ uri: b.studentAvatar }} style={styles.avatar} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.studentName}>{b.studentName}</Text>
                      <Text style={styles.scheduleText}>{formatDate(b.scheduledAt)} · {t('mentorDashboard.durationMinutes', { count: b.durationMinutes })}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
                      <Text style={[styles.statusText, { color: meta.color }]}>{t(meta.labelKey)}</Text>
                    </View>
                  </View>

                  <Text style={styles.priceText}>Rp{b.totalAmount.toLocaleString('id-ID')}</Text>

                  {b.status === 'confirmed' && (
                    <View style={styles.actionsBlock}>
                      {b.meetingLink ? (
                        <TouchableOpacity style={styles.joinButton} onPress={() => handleOpenMeeting(b.meetingLink!)}>
                          <Ionicons name="videocam-outline" size={14} color={COLORS.white} />
                          <Text style={styles.joinButtonText}>{t('mentorSchedule.openMeetingLink')}</Text>
                        </TouchableOpacity>
                      ) : (
                        <View style={styles.linkInputRow}>
                          <TextInput
                            style={styles.linkInput}
                            placeholder={t('mentorSchedule.linkPlaceholder')}
                            placeholderTextColor={COLORS.textMuted}
                            value={linkDrafts[b.id] ?? ''}
                            onChangeText={(val) => setLinkDrafts((prev) => ({ ...prev, [b.id]: val }))}
                            autoCapitalize="none"
                          />
                          <TouchableOpacity
                            style={styles.saveLinkButton}
                            onPress={() => handleSaveLink(b.id)}
                            disabled={savingId === b.id}
                          >
                            {savingId === b.id ? (
                              <ActivityIndicator size="small" color={COLORS.white} />
                            ) : (
                              <Text style={styles.saveLinkButtonText}>{t('common.save')}</Text>
                            )}
                          </TouchableOpacity>
                        </View>
                      )}

                      <TouchableOpacity
                        style={styles.completeButton}
                        onPress={() => handleMarkCompleted(b)}
                        disabled={savingId === b.id}
                      >
                        <Ionicons name="checkmark-circle-outline" size={15} color="#16A34A" />
                        <Text style={styles.completeButtonText}>{t('mentorSchedule.markCompleted')}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
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

  emptyBox: { alignItems: 'center', gap: 8, paddingVertical: 50 },
  emptyText: { fontSize: 13, color: COLORS.textLight },

  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: '#F1F5F9',
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.track },
  studentName: { fontSize: 14, fontWeight: '700', color: COLORS.textDark },
  scheduleText: { fontSize: 11.5, color: COLORS.textLight, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99 },
  statusText: { fontSize: 10, fontWeight: '700' },
  priceText: { fontSize: 13, fontWeight: '800', color: COLORS.primary },

  actionsBlock: { marginTop: 12, gap: 8 },
  linkInputRow: { flexDirection: 'row', gap: 8 },
  linkInput: {
    flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 9, fontSize: 12.5, color: COLORS.textDark,
  },
  saveLinkButton: { backgroundColor: COLORS.primary, paddingHorizontal: 14, borderRadius: 10, justifyContent: 'center' },
  saveLinkButtonText: { color: COLORS.white, fontSize: 12, fontWeight: '700' },

  joinButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#16A34A', paddingVertical: 10, borderRadius: 10,
  },
  joinButtonText: { color: COLORS.white, fontSize: 12.5, fontWeight: '700' },

  completeButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0', paddingVertical: 10, borderRadius: 10,
  },
  completeButtonText: { color: '#16A34A', fontSize: 12.5, fontWeight: '700' },
});