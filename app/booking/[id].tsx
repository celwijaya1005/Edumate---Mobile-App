import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { COLORS, PRIMARY_BUTTON_SHADOW } from '../../constants/brand';
import { DEFAULT_AVATAR_URI } from '../../constants/defaultAvatar';

// Sesi mentoring difix 60 menit (belum ada opsi durasi lain di desain/skema saat ini)
const DURATION_MINUTES = 60;

const FALLBACK_MENTOR = {
  name: 'Mentor Edumate',
  avatar: DEFAULT_AVATAR_URI,
  rating: 0,
  totalSessions: 0,
  ratePerSession: 0,
};

// Tanggal dibuat dinamis (7 hari ke depan dari hari ini), bukan hardcode
// tanggal tetap yang lama-lama jadi kadaluarsa.
function buildUpcomingDates() {
  const dates = [];
  for (let i = 1; i <= 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    dates.push({ dayIndex: d.getDay(), date: d.getDate(), fullDate: d });
  }
  return dates;
}

// Slot waktu umum. Skema DB belum punya tabel ketersediaan mentor per-jam,
// jadi ini masih daftar tetap (bukan data yang di-fake-kan, cuma pilihan UI).
const TIME_SLOTS = ['09:00', '10:30', '13:00', '14:30', '16:00', '19:00'];

export default function MentorBookingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id, moduleId } = useLocalSearchParams<{ id: string; moduleId?: string }>();

  const [loading, setLoading] = useState(true);
  const [mentor, setMentor] = useState(FALLBACK_MENTOR);

  const [dates] = useState(buildUpcomingDates);
  const [selectedDateIndex, setSelectedDateIndex] = useState(0);
  const [selectedTime, setSelectedTime] = useState(TIME_SLOTS[0]);

  const [voucherCode, setVoucherCode] = useState('');
  const [checkingVoucher, setCheckingVoucher] = useState(false);
  const [appliedVoucher, setAppliedVoucher] = useState<{ code: string; discountPercent: number } | null>(null);
  const [voucherError, setVoucherError] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [notes, setNotes] = useState('');

  // Ambil data mentor asli
  useEffect(() => {
    async function loadMentor() {
      if (!id) { setLoading(false); return; }
      try {
        const { data, error } = await supabase
          .from('mentor_profiles')
          .select('rate_per_session, rating_avg, total_sessions, profile:profiles!user_id(name, avatar_url)')
          .eq('user_id', id)
          .single();

        if (error) console.log('Error fetching mentor for booking:', error);

        if (data) {
          const prof = data.profile as any;
          setMentor({
            name: prof?.name || t('moduleDetail.defaultMentorName'),
            avatar: prof?.avatar_url || FALLBACK_MENTOR.avatar,
            rating: data.rating_avg != null ? Number(data.rating_avg) : 0,
            totalSessions: data.total_sessions ?? 0,
            ratePerSession: data.rate_per_session != null ? Number(data.rate_per_session) : 0,
          });
        }
      } catch (e) {
        console.log('Error fetching mentor for booking:', e);
      } finally {
        setLoading(false);
      }
    }
    loadMentor();
  }, [id, t]);

  const discountAmount = appliedVoucher
    ? Math.round((mentor.ratePerSession * appliedVoucher.discountPercent) / 100)
    : 0;
  const totalAmount = Math.max(0, mentor.ratePerSession - discountAmount);

  const handleApplyVoucher = async () => {
    const code = voucherCode.trim().toUpperCase();
    if (!code) return;
    setCheckingVoucher(true);
    setVoucherError('');
    try {
      const { data, error } = await supabase
        .from('vouchers')
        .select('code, discount_percent, is_active, expires_at')
        .eq('code', code)
        .maybeSingle();

      if (error) console.log('Error checking voucher:', error);

      if (!data) {
        setVoucherError(t('bookingScreen.voucherNotFound'));
        setAppliedVoucher(null);
        return;
      }
      if (!data.is_active) {
        setVoucherError(t('bookingScreen.voucherInactive'));
        setAppliedVoucher(null);
        return;
      }
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        setVoucherError(t('bookingScreen.voucherExpired'));
        setAppliedVoucher(null);
        return;
      }

      setAppliedVoucher({ code: data.code, discountPercent: Number(data.discount_percent) });
    } catch (e) {
      console.log('Error checking voucher:', e);
      setVoucherError(t('bookingScreen.voucherCheckFailed'));
    } finally {
      setCheckingVoucher(false);
    }
  };

  const handleProceedToPayment = async () => {
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        Alert.alert(t('bookingScreen.notLoggedInTitle'), t('bookingScreen.notLoggedInMsg'));
        return;
      }

      const scheduledAt = new Date(dates[selectedDateIndex].fullDate);
      const [hh, mm] = selectedTime.split(':').map(Number);
      scheduledAt.setHours(hh, mm, 0, 0);

      router.push({
        pathname: '/payment/checkout',
        params: {
          mentorId: id || '',
          mentorName: mentor.name,
          mentorAvatar: mentor.avatar,
          moduleId: moduleId || '',
          scheduledAt: scheduledAt.toISOString(),
          durationMinutes: String(DURATION_MINUTES),
          notes: notes || '',
          ratePerSession: String(mentor.ratePerSession),
          voucherCode: appliedVoucher?.code || '',
          discountAmount: String(discountAmount),
          totalAmount: String(totalAmount),
        },
      } as any);
    } catch (e) {
      console.log('Error preparing payment:', e);
      Alert.alert(t('bookingScreen.bookingFailedTitle'), t('bookingScreen.bookingFailedMsg'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[{ flex: 1, backgroundColor: COLORS.background }, styles.centerBox]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={{ marginTop: 12, color: COLORS.textLight }}>{t('bookingScreen.loading')}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      {/* Header -- fixed, tidak ikut scroll */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Ionicons name="school" size={20} color={COLORS.primary} />
          <Text style={styles.headerTitle}>{t('bookingScreen.headerTitle')}</Text>
        </View>
        <TouchableOpacity onPress={() => router.back()}>
          <Image source={{ uri: mentor.avatar }} style={styles.headerAvatar} />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Mentor mini card */}
        <View style={styles.mentorCard}>
          <Image source={{ uri: mentor.avatar }} style={styles.mentorAvatar} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.mentorName}>{mentor.name}</Text>
            <Text style={styles.mentorRole}>{t('bookingScreen.verifiedMentor')}</Text>
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={12} color={COLORS.star} />
              <Text style={styles.ratingText}>
                {mentor.rating.toFixed(1)} ({t('mentorProfile.statSessionsValue', { count: mentor.totalSessions })})
              </Text>
            </View>
          </View>
        </View>

        {/* Pilih Tanggal */}
        <Text style={styles.sectionTitle}>{t('bookingScreen.selectDate')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
          <View style={styles.dateRow}>
            {dates.map((d, index) => {
              const isActive = index === selectedDateIndex;
              return (
                <TouchableOpacity
                  key={index}
                  style={[styles.dateChip, isActive && styles.dateChipActive]}
                  onPress={() => setSelectedDateIndex(index)}
                >
                  <Text style={[styles.dateDay, isActive && styles.dateTextActive]}>{t(`bookingScreen.dayLabel${d.dayIndex}`)}</Text>
                  <Text style={[styles.dateNumber, isActive && styles.dateTextActive]}>{d.date}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {/* Pilih Waktu */}
        <Text style={styles.sectionTitle}>{t('bookingScreen.selectTime')}</Text>
        <View style={styles.timeGrid}>
          {TIME_SLOTS.map((time) => {
            const isActive = time === selectedTime;
            return (
              <TouchableOpacity
                key={time}
                style={[styles.timeChip, isActive && styles.timeChipActive]}
                onPress={() => setSelectedTime(time)}
              >
                <Text style={[styles.timeText, isActive && styles.dateTextActive]}>{time}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Catatan untuk mentor */}
        <Text style={styles.sectionTitle}>{t('bookingScreen.notesLabel')}</Text>
        <TextInput
          style={styles.notesInput}
          placeholder={t('bookingScreen.notesPlaceholder')}
          placeholderTextColor={COLORS.textLight}
          value={notes}
          onChangeText={setNotes}
          multiline
        />

        {/* Kode diskon */}
        <View style={styles.voucherRow}>
          <View style={styles.voucherInputWrapper}>
            <Ionicons name="pricetag-outline" size={16} color={COLORS.textLight} />
            <TextInput
              style={styles.voucherInput}
              placeholder={t('bookingScreen.voucherPlaceholder')}
              placeholderTextColor={COLORS.textLight}
              value={voucherCode}
              onChangeText={(val) => { setVoucherCode(val); setVoucherError(''); }}
              autoCapitalize="characters"
              editable={!appliedVoucher}
            />
          </View>
          <TouchableOpacity
            style={styles.applyButton}
            onPress={appliedVoucher ? () => { setAppliedVoucher(null); setVoucherCode(''); } : handleApplyVoucher}
            disabled={checkingVoucher}
          >
            {checkingVoucher ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Text style={styles.applyButtonText}>{appliedVoucher ? t('bookingScreen.removeVoucher') : t('bookingScreen.applyVoucher')}</Text>
            )}
          </TouchableOpacity>
        </View>
        {!!voucherError && <Text style={styles.voucherErrorText}>{voucherError}</Text>}
        {!!appliedVoucher && (
          <Text style={styles.voucherSuccessText}>
            {t('bookingScreen.voucherApplied', { code: appliedVoucher.code, percent: appliedVoucher.discountPercent })}
          </Text>
        )}

        {/* Ringkasan */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('bookingScreen.sessionOneHour')}</Text>
            <Text style={styles.summaryValue}>Rp{mentor.ratePerSession.toLocaleString('id-ID')}</Text>
          </View>
          {!!appliedVoucher && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{t('bookingScreen.voucherDiscount')}</Text>
              <Text style={styles.summaryValueFree}>-Rp{discountAmount.toLocaleString('id-ID')}</Text>
            </View>
          )}
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryTotalLabel}>{t('bookingScreen.total')}</Text>
            <Text style={styles.summaryTotalValue}>Rp{totalAmount.toLocaleString('id-ID')}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Footer -- fixed */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.payButton, submitting && styles.payButtonDisabled]}
          activeOpacity={0.85}
          onPress={handleProceedToPayment}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <>
              <Text style={styles.payButtonText}>{t('bookingScreen.proceedToPayment')}</Text>
              <Ionicons name="arrow-forward" size={18} color={COLORS.white} style={{ marginLeft: 8 }} />
            </>
          )}
        </TouchableOpacity>
        <Text style={styles.footerNote}>
          {t('bookingScreen.footerNote')}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centerBox: { justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: 'bold', color: COLORS.primary, marginLeft: 8 },
  headerAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.track },

  scrollContent: { paddingHorizontal: 20, paddingBottom: 160 },

  mentorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 24,
  },
  mentorAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.track },
  mentorName: { fontSize: 14, fontWeight: 'bold', color: COLORS.textDark },
  mentorRole: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  ratingText: { fontSize: 11, color: COLORS.textLight, marginLeft: 4 },

  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: COLORS.textDark, marginBottom: 12 },

  dateRow: { flexDirection: 'row', gap: 10, marginBottom: 4, paddingRight: 4 },
  dateChip: {
    width: 64,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dateChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  dateDay: { fontSize: 11, color: COLORS.textLight, fontWeight: '600' },
  dateNumber: { fontSize: 16, color: COLORS.textDark, fontWeight: 'bold', marginTop: 2 },
  dateTextActive: { color: COLORS.white },

  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  timeChip: {
    width: '31%',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  timeChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  timeText: { fontSize: 13, color: COLORS.textDark, fontWeight: '600' },

  notesInput: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    minHeight: 80,
    textAlignVertical: 'top',
    color: COLORS.textDark,
    fontSize: 13,
    marginBottom: 24,
  },

  voucherRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  voucherInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
  },
  voucherInput: { flex: 1, marginLeft: 8, paddingVertical: 12, color: COLORS.textDark, fontSize: 13 },
  applyButton: {
    backgroundColor: COLORS.textDark,
    paddingHorizontal: 18,
    borderRadius: 14,
    justifyContent: 'center',
    minWidth: 92,
    alignItems: 'center',
  },
  applyButtonText: { color: COLORS.white, fontSize: 12, fontWeight: 'bold' },
  voucherErrorText: { color: '#DC2626', fontSize: 12, marginBottom: 16 },
  voucherSuccessText: { color: COLORS.success, fontSize: 12, marginBottom: 16, fontWeight: '600' },

  summaryCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  summaryLabel: { fontSize: 13, color: COLORS.textLight },
  summaryValue: { fontSize: 13, color: COLORS.textDark, fontWeight: '600' },
  summaryValueFree: { fontSize: 13, color: COLORS.success, fontWeight: 'bold' },
  summaryDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: 6 },
  summaryTotalLabel: { fontSize: 15, fontWeight: 'bold', color: COLORS.textDark },
  summaryTotalValue: { fontSize: 18, fontWeight: 'bold', color: COLORS.primary },

  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  payButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 16,
    ...PRIMARY_BUTTON_SHADOW,
  },
  payButtonDisabled: { opacity: 0.7 },
  payButtonText: { color: COLORS.white, fontWeight: 'bold', fontSize: 15 },
  footerNote: { textAlign: 'center', fontSize: 11, color: COLORS.textLight, marginTop: 10 },
});