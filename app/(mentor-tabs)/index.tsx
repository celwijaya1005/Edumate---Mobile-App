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
  Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/auth';
import { supabase } from '@/lib/supabase';
import { COLORS } from '@/constants/brand';
import { DEFAULT_AVATAR_URI as DEFAULT_AVATAR } from '@/constants/defaultAvatar';

const BG = '#FCF9F1';

type PendingBooking = {
  id: string;
  studentName: string;
  studentAvatar: string;
  scheduledAt: string;
  durationMinutes: number;
  totalAmount: number;
  notes: string | null;
};

export default function MentorDashboardScreen() {
  const { t } = useTranslation();
  const { profile, mentorProfile, signOut } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [moduleCount, setModuleCount] = useState(0);
  const [pendingBookings, setPendingBookings] = useState<PendingBooking[]>([]);
  const [todaySessions, setTodaySessions] = useState<PendingBooking[]>([]);
  const [actingId, setActingId] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { setLoading(false); return; }
      const mentorId = session.user.id;

      const { count } = await supabase
        .from('modules')
        .select('id_module', { count: 'exact', head: true })
        .eq('id_mentor', mentorId);
      setModuleCount(count || 0);

      const { data: pendingRows, error: pendingError } = await supabase
        .from('mentor_bookings')
        .select('id_booking, scheduled_at, duration_minutes, total_amount, notes, student:profiles!id_student(name, avatar_url)')
        .eq('id_mentor', mentorId)
        .eq('status', 'pending')
        .order('scheduled_at', { ascending: true });

      if (pendingError) console.log('Error fetching pending bookings:', pendingError);

      setPendingBookings((pendingRows || []).map((b: any) => ({
        id: b.id_booking,
        studentName: b.student?.name || t('mentorDashboard.defaultStudentName'),
        studentAvatar: b.student?.avatar_url || DEFAULT_AVATAR,
        scheduledAt: b.scheduled_at,
        durationMinutes: b.duration_minutes,
        totalAmount: Number(b.total_amount || 0),
        notes: b.notes,
      })));

      const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(); endOfDay.setHours(23, 59, 59, 999);

      const { data: todayRows, error: todayError } = await supabase
        .from('mentor_bookings')
        .select('id_booking, scheduled_at, duration_minutes, total_amount, notes, student:profiles!id_student(name, avatar_url)')
        .eq('id_mentor', mentorId)
        .eq('status', 'confirmed')
        .gte('scheduled_at', startOfDay.toISOString())
        .lte('scheduled_at', endOfDay.toISOString())
        .order('scheduled_at', { ascending: true });

      if (todayError) console.log('Error fetching today sessions:', todayError);

      setTodaySessions((todayRows || []).map((b: any) => ({
        id: b.id_booking,
        studentName: b.student?.name || t('mentorDashboard.defaultStudentName'),
        studentAvatar: b.student?.avatar_url || DEFAULT_AVATAR,
        scheduledAt: b.scheduled_at,
        durationMinutes: b.duration_minutes,
        totalAmount: Number(b.total_amount || 0),
        notes: b.notes,
      })));
    } catch (e) {
      console.log('Error loading mentor dashboard:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [loadDashboard])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboard();
  };

  const handleRespond = async (bookingId: string, accept: boolean) => {
    setActingId(bookingId);
    try {
      const { error } = await supabase
        .from('mentor_bookings')
        .update({ status: accept ? 'confirmed' : 'cancelled' })
        .eq('id_booking', bookingId);

      if (error) {
        console.log('Error updating booking status:', error);
        Alert.alert(t('mentorDashboard.respondFailedTitle'), t('mentorDashboard.respondFailedMsg'));
        return;
      }
      await loadDashboard();
    } catch (e) {
      console.log('Error responding to booking:', e);
    } finally {
      setActingId(null);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) +
      ' · ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
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
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {/* Logo */}
        <View style={styles.logoRow}>
          <Image source={require('@/assets/images/logo.png')} style={styles.logoImage} />
          <Text style={styles.logoText}>{t('common.appName')}</Text>
        </View>

        {/* Header */}
        <View style={styles.headerRow}>
          <Image source={{ uri: profile?.avatar_url || DEFAULT_AVATAR }} style={styles.avatar} />
          <View style={styles.headerInfo}>
            <Text style={styles.greeting} numberOfLines={1}>{t('mentorDashboard.greeting', { name: profile?.name?.split(' ')[0] || '' })}</Text>
            <Text style={styles.subGreeting} numberOfLines={1}>{t('mentorDashboard.subGreeting')}</Text>
          </View>
          <TouchableOpacity onPress={signOut} style={styles.logoutBtn}>
            <Ionicons name="log-out-outline" size={20} color={COLORS.textDark} />
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="star" size={18} color={COLORS.star} />
            <Text style={styles.statValue}>{mentorProfile?.rating_avg != null ? Number(mentorProfile.rating_avg).toFixed(1) : '0.0'}</Text>
            <Text style={styles.statLabel}>{t('mentorDashboard.statRating')}</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="checkmark-done" size={18} color="#16A34A" />
            <Text style={styles.statValue}>{mentorProfile?.total_sessions ?? 0}</Text>
            <Text style={styles.statLabel}>{t('mentorProfile.statSessionsLabel')}</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="book" size={18} color={COLORS.primary} />
            <Text style={styles.statValue}>{moduleCount}</Text>
            <Text style={styles.statLabel}>{t('mentorDashboard.statModules')}</Text>
          </View>
        </View>

        {/* Booking Menunggu Konfirmasi */}
        <Text style={styles.sectionTitle}>{t('mentorDashboard.pendingSectionTitle', { count: pendingBookings.length })}</Text>
        {pendingBookings.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="checkmark-circle-outline" size={26} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>{t('mentorDashboard.noPendingBookings')}</Text>
          </View>
        ) : (
          <View style={{ gap: 10, marginBottom: 24 }}>
            {pendingBookings.map((b) => (
              <View key={b.id} style={styles.card}>
                <View style={styles.cardTopRow}>
                  <Image source={{ uri: b.studentAvatar }} style={styles.studentAvatar} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.studentName}>{b.studentName}</Text>
                    <Text style={styles.scheduleText}>{formatDate(b.scheduledAt)} · {t('mentorDashboard.durationMinutes', { count: b.durationMinutes })}</Text>
                  </View>
                  <Text style={styles.priceText}>Rp{b.totalAmount.toLocaleString('id-ID')}</Text>
                </View>
                {!!b.notes && <Text style={styles.notesText} numberOfLines={2}>&quot;{b.notes}&quot;</Text>}
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.rejectBtn]}
                    disabled={actingId === b.id}
                    onPress={() => handleRespond(b.id, false)}
                  >
                    {actingId === b.id ? <ActivityIndicator size="small" color="#DC2626" /> : (
                      <Text style={styles.rejectBtnText}>{t('mentorDashboard.reject')}</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.acceptBtn]}
                    disabled={actingId === b.id}
                    onPress={() => handleRespond(b.id, true)}
                  >
                    {actingId === b.id ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
                      <Text style={styles.acceptBtnText}>{t('mentorDashboard.accept')}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Sesi Hari Ini */}
        <Text style={styles.sectionTitle}>{t('mentorDashboard.todaySessionsTitle')}</Text>
        {todaySessions.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="calendar-outline" size={26} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>{t('mentorDashboard.noTodaySessions')}</Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {todaySessions.map((b) => (
              <View key={b.id} style={styles.card}>
                <View style={styles.cardTopRow}>
                  <Image source={{ uri: b.studentAvatar }} style={styles.studentAvatar} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.studentName}>{b.studentName}</Text>
                    <Text style={styles.scheduleText}>{formatDate(b.scheduledAt)} · {t('mentorDashboard.durationMinutes', { count: b.durationMinutes })}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  centerBox: { justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 20, paddingBottom: 40 },

  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  logoImage: { width: 22, height: 22, resizeMode: 'contain' },
  logoText: { fontSize: 18, fontWeight: '800', color: COLORS.primary, letterSpacing: 0.2 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: COLORS.track },
  headerInfo: { flex: 1, minWidth: 0 },
  greeting: { fontSize: 16, fontWeight: '800', color: COLORS.textDark },
  subGreeting: { fontSize: 11.5, color: COLORS.textLight, marginTop: 2 },
  logoutBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statCard: {
    flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, paddingVertical: 14,
    alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#F1F5F9',
  },
  statValue: { fontSize: 18, fontWeight: '800', color: COLORS.textDark },
  statLabel: { fontSize: 10.5, color: COLORS.textLight, fontWeight: '600' },

  sectionTitle: { fontSize: 15, fontWeight: '800', color: COLORS.textDark, marginBottom: 12 },

  emptyBox: { alignItems: 'center', gap: 8, paddingVertical: 24, backgroundColor: '#FFFFFF', borderRadius: 16, marginBottom: 24 },
  emptyText: { fontSize: 12.5, color: COLORS.textLight },

  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: '#F1F5F9',
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  studentAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.track },
  studentName: { fontSize: 14, fontWeight: '700', color: COLORS.textDark },
  scheduleText: { fontSize: 11.5, color: COLORS.textLight, marginTop: 2 },
  priceText: { fontSize: 13, fontWeight: '800', color: COLORS.primary },
  notesText: { fontSize: 12, color: COLORS.textLight, fontStyle: 'italic', marginTop: 10 },

  actionRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  actionBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  rejectBtn: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  rejectBtnText: { color: '#DC2626', fontWeight: '700', fontSize: 12.5 },
  acceptBtn: { backgroundColor: '#16A34A' },
  acceptBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12.5 },
});