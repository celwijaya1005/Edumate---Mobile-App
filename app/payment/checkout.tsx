import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import {
  View,
  Text,
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

type PaymentMethod = 'bank_transfer' | 'e_wallet' | 'credit_card';

const PAYMENT_METHODS: { key: PaymentMethod; icon: keyof typeof Ionicons.glyphMap; labelKey: string }[] = [
  { key: 'bank_transfer', icon: 'business-outline', labelKey: 'payment.bankTransfer' },
  { key: 'e_wallet', icon: 'wallet-outline', labelKey: 'payment.eWallet' },
  { key: 'credit_card', icon: 'card-outline', labelKey: 'payment.creditCard' },
];

export default function PaymentCheckoutScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{
    mentorId: string;
    mentorName: string;
    mentorAvatar: string;
    moduleId?: string;
    scheduledAt: string;
    durationMinutes: string;
    notes?: string;
    ratePerSession: string;
    voucherCode?: string;
    discountAmount: string;
    totalAmount: string;
  }>();

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('bank_transfer');
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);

  const ratePerSession = Number(params.ratePerSession || 0);
  const discountAmount = Number(params.discountAmount || 0);
  const totalAmount = Number(params.totalAmount || 0);
  const durationMinutes = Number(params.durationMinutes || 60);

  const scheduledDate = params.scheduledAt ? new Date(params.scheduledAt) : null;
  const formattedDate = scheduledDate
    ? scheduledDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : '-';
  const formattedTime = scheduledDate
    ? scheduledDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    : '-';

  // ⚠️ Catatan: ini SIMULASI pembayaran (UI saja). Belum ada integrasi payment
  // gateway beneran (Midtrans/Xendit/dsb) — begitu tombol "Bayar" ditekan,
  // dianggap otomatis berhasil lalu booking langsung dibuat di database.
  const handlePay = async () => {
    setPaying(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        Alert.alert(t('bookingScreen.notLoggedInTitle'), t('bookingScreen.notLoggedInMsg'));
        return;
      }

      // Jeda sebentar biar terasa seperti proses pembayaran beneran.
      await new Promise((resolve) => setTimeout(resolve, 1200));

      const { error } = await supabase.from('mentor_bookings').insert({
        id_student: session.user.id,
        id_mentor: params.mentorId,
        id_module: params.moduleId || null,
        status: 'pending',
        scheduled_at: params.scheduledAt,
        duration_minutes: durationMinutes,
        price: ratePerSession,
        total_amount: totalAmount,
        notes: params.notes || null,
      });

      if (error) {
        console.log('Error creating booking after payment:', error);
        Alert.alert(t('bookingScreen.bookingFailedTitle'), t('bookingScreen.bookingFailedMsg'));
        return;
      }

      setPaid(true);
    } catch (e) {
      console.log('Error processing payment:', e);
      Alert.alert(t('bookingScreen.bookingFailedTitle'), t('bookingScreen.bookingFailedMsg'));
    } finally {
      setPaying(false);
    }
  };

  if (paid) {
    return (
      <SafeAreaView style={[styles.safe, styles.centerBox]}>
        <View style={styles.successIconWrap}>
          <Ionicons name="checkmark" size={40} color="#FFFFFF" />
        </View>
        <Text style={styles.successTitle}>{t('payment.successTitle')}</Text>
        <Text style={styles.successMsg}>
          {t('bookingScreen.bookingSentMsg', { name: params.mentorName })}
        </Text>
        <TouchableOpacity
          style={styles.successButton}
          onPress={() => router.replace(`/mentors/${params.mentorId}` as any)}
        >
          <Text style={styles.successButtonText}>{t('payment.backToMentor')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} disabled={paying}>
          <Ionicons name="chevron-back" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('payment.headerTitle')}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Ringkasan sesi */}
        <View style={styles.summaryCard}>
          <View style={styles.mentorRow}>
            <Image source={{ uri: params.mentorAvatar }} style={styles.avatar} />
            <View style={{ flex: 1 }}>
              <Text style={styles.mentorName}>{params.mentorName}</Text>
              <Text style={styles.sessionMeta}>{formattedDate}</Text>
              <Text style={styles.sessionMeta}>{formattedTime} · {t('bookingHistory.minutes', { count: durationMinutes })}</Text>
            </View>
          </View>
        </View>

        {/* Pilih metode pembayaran (mock) */}
        <Text style={styles.sectionLabel}>{t('payment.selectMethod')}</Text>
        <View style={styles.methodList}>
          {PAYMENT_METHODS.map((m) => {
            const isActive = selectedMethod === m.key;
            return (
              <TouchableOpacity
                key={m.key}
                style={[styles.methodItem, isActive && styles.methodItemActive]}
                onPress={() => setSelectedMethod(m.key)}
                activeOpacity={0.8}
              >
                <Ionicons name={m.icon} size={20} color={isActive ? COLORS.primary : COLORS.textLight} />
                <Text style={[styles.methodLabel, isActive && styles.methodLabelActive]}>{t(m.labelKey)}</Text>
                <View style={[styles.radioOuter, isActive && styles.radioOuterActive]}>
                  {isActive && <View style={styles.radioInner} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={styles.mockNote}>{t('payment.mockNote')}</Text>

        {/* Rincian biaya */}
        <Text style={styles.sectionLabel}>{t('payment.priceDetails')}</Text>
        <View style={styles.priceCard}>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>{t('bookingScreen.sessionOneHour')}</Text>
            <Text style={styles.priceValue}>Rp{ratePerSession.toLocaleString('id-ID')}</Text>
          </View>
          {discountAmount > 0 && (
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>{t('bookingScreen.voucherDiscount')} ({params.voucherCode})</Text>
              <Text style={styles.priceValueDiscount}>-Rp{discountAmount.toLocaleString('id-ID')}</Text>
            </View>
          )}
          <View style={styles.priceDivider} />
          <View style={styles.priceRow}>
            <Text style={styles.priceTotalLabel}>{t('bookingScreen.total')}</Text>
            <Text style={styles.priceTotalValue}>Rp{totalAmount.toLocaleString('id-ID')}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.payButton, paying && styles.payButtonDisabled]}
          activeOpacity={0.85}
          onPress={handlePay}
          disabled={paying}
        >
          {paying ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Text style={styles.payButtonText}>{t('payment.payNow', { amount: totalAmount.toLocaleString('id-ID') })}</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  centerBox: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30 },

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

  scrollContent: { paddingHorizontal: 20, paddingBottom: 20 },

  summaryCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, marginBottom: 22,
    borderWidth: 1, borderColor: '#F1F5F9',
  },
  mentorRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#F1F5F9' },
  mentorName: { fontSize: 14, fontWeight: '700', color: COLORS.textDark },
  sessionMeta: { fontSize: 11.5, color: COLORS.textLight, marginTop: 2 },

  sectionLabel: { fontSize: 13, fontWeight: '700', color: COLORS.textDark, marginBottom: 10 },

  methodList: { gap: 10, marginBottom: 8 },
  methodItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14,
    borderWidth: 1.5, borderColor: '#E2E8F0',
  },
  methodItemActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  methodLabel: { flex: 1, fontSize: 13.5, fontWeight: '600', color: COLORS.textDark },
  methodLabelActive: { color: COLORS.primary },
  radioOuter: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#CBD5E1',
    alignItems: 'center', justifyContent: 'center',
  },
  radioOuterActive: { borderColor: COLORS.primary },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },

  mockNote: {
    fontSize: 11, color: COLORS.textMuted, fontStyle: 'italic',
    marginBottom: 22, marginTop: 2,
  },

  priceCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#F1F5F9',
  },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  priceLabel: { fontSize: 12.5, color: COLORS.textLight, flexShrink: 1, paddingRight: 8 },
  priceValue: { fontSize: 12.5, color: COLORS.textDark, fontWeight: '600' },
  priceValueDiscount: { fontSize: 12.5, color: '#16A34A', fontWeight: '600' },
  priceDivider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 6 },
  priceTotalLabel: { fontSize: 14, fontWeight: '800', color: COLORS.textDark },
  priceTotalValue: { fontSize: 16, fontWeight: '800', color: COLORS.primary },

  footer: {
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20,
    backgroundColor: COLORS.background, borderTopWidth: 1, borderTopColor: '#F1F5F9',
  },
  payButton: {
    backgroundColor: COLORS.primary, borderRadius: 99, paddingVertical: 15,
    alignItems: 'center', justifyContent: 'center', ...PRIMARY_BUTTON_SHADOW,
  },
  payButtonDisabled: { opacity: 0.7 },
  payButtonText: { color: COLORS.white, fontWeight: 'bold', fontSize: 15 },

  successIconWrap: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: '#16A34A',
    alignItems: 'center', justifyContent: 'center', marginBottom: 18,
  },
  successTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textDark, marginBottom: 8 },
  successMsg: { fontSize: 13, color: COLORS.textLight, textAlign: 'center', marginBottom: 24, lineHeight: 19 },
  successButton: {
    backgroundColor: COLORS.primary, borderRadius: 99, paddingVertical: 13, paddingHorizontal: 32,
    ...PRIMARY_BUTTON_SHADOW,
  },
  successButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});