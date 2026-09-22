import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { COLORS, PRIMARY_BUTTON_SHADOW } from '../constants/brand';

const BG = '#FCF9F1';

type ClaimedVoucher = {
  idUserVoucher: string;
  code: string;
  discountPercent: number;
  description: string;
  status: 'claimed' | 'used' | 'expired';
  expiresAt: string | null;
};

type AvailableVoucher = {
  idVoucher: string;
  code: string;
  discountPercent: number;
  description: string;
  minLevel: number;
  expiresAt: string | null;
};

export default function VouchersScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
    claimed: { label: t('vouchers.statusReady'),   color: '#16A34A', bg: '#F0FDF4' },
    used:    { label: t('vouchers.statusUsed'),    color: '#64748B', bg: '#F1F5F9' },
    expired: { label: t('vouchers.statusExpired'), color: '#DC2626', bg: '#FEF2F2' },
  };
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [userLevel, setUserLevel] = useState(1);
  const [claimedVouchers, setClaimedVouchers] = useState<ClaimedVoucher[]>([]);
  const [availableVouchers, setAvailableVouchers] = useState<AvailableVoucher[]>([]);

  const loadData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { setLoading(false); return; }

      const { data: profile } = await supabase
        .from('profiles')
        .select('level')
        .eq('id', session.user.id)
        .single();
      const level = profile?.level ?? 1;
      setUserLevel(level);

      const { data: userVoucherRows, error: uvError } = await supabase
        .from('user_vouchers')
        .select('id_user_voucher, id_voucher, status, voucher:vouchers(code, discount_percent, description, expires_at)')
        .eq('id_user', session.user.id)
        .order('redeemed_at', { ascending: false });

      if (uvError) console.log('Error fetching user_vouchers:', uvError);

      const claimedIds = new Set<string>();
      const mappedClaimed: ClaimedVoucher[] = (userVoucherRows || []).map((row: any) => {
        claimedIds.add(row.id_voucher);
        const v = row.voucher;
        return {
          idUserVoucher: row.id_user_voucher,
          code: v?.code || '-',
          discountPercent: Number(v?.discount_percent ?? 0),
          description: v?.description || '',
          status: row.status,
          expiresAt: v?.expires_at || null,
        };
      });
      setClaimedVouchers(mappedClaimed);

      const { data: voucherRows, error: vError } = await supabase
        .from('vouchers')
        .select('id_voucher, code, discount_percent, description, min_level, expires_at')
        .eq('is_active', true);

      if (vError) console.log('Error fetching vouchers:', vError);

      const now = new Date();
      const mappedAvailable: AvailableVoucher[] = (voucherRows || [])
        .filter((v: any) => !claimedIds.has(v.id_voucher))
        .filter((v: any) => !v.expires_at || new Date(v.expires_at) > now)
        .filter((v: any) => level >= (v.min_level ?? 1))
        .map((v: any) => ({
          idVoucher: v.id_voucher,
          code: v.code,
          discountPercent: Number(v.discount_percent),
          description: v.description || '',
          minLevel: v.min_level ?? 1,
          expiresAt: v.expires_at,
        }));
      setAvailableVouchers(mappedAvailable);
    } catch (e) {
      console.log('Error loading vouchers:', e);
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

  const handleClaim = async (voucher: AvailableVoucher) => {
    setClaiming(voucher.idVoucher);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { error } = await supabase.from('user_vouchers').insert({
        id_user: session.user.id,
        id_voucher: voucher.idVoucher,
        status: 'claimed',
        redeemed_at: new Date().toISOString(),
      });

      if (error) {
        console.log('Error claiming voucher:', error);
        Alert.alert(t('vouchers.claimFailedTitle'), t('vouchers.claimFailedMsg'));
        return;
      }

      await loadData();
      Alert.alert(t('vouchers.claimSuccessTitle'), t('vouchers.claimSuccessMsg', { code: voucher.code }));
    } catch (e) {
      console.log('Error claiming voucher:', e);
    } finally {
      setClaiming(null);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
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
        <Text style={styles.headerTitle}>{t('vouchers.headerTitle')}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {/* ── Voucher yang sudah diklaim ── */}
        <Text style={styles.sectionTitle}>{t('vouchers.yourVouchers', { count: claimedVouchers.length })}</Text>
        {claimedVouchers.length === 0 ? (
          <View style={styles.emptyBox}>
            <Feather name="gift" size={26} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>{t('vouchers.noClaimedVouchers')}</Text>
          </View>
        ) : (
          <View style={{ gap: 10, marginBottom: 28 }}>
            {claimedVouchers.map((v) => {
              const meta = STATUS_META[v.status] || STATUS_META.claimed;
              return (
                <View key={v.idUserVoucher} style={styles.voucherCard}>
                  <View style={styles.voucherIconWrap}>
                    <Feather name="tag" size={18} color={COLORS.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.voucherCode}>{v.code}</Text>
                    <Text style={styles.voucherDesc} numberOfLines={2}>
                    {v.description || t('vouchers.discount', { percent: v.discountPercent })}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
                    <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Voucher yang bisa diklaim ── */}
        <Text style={styles.sectionTitle}>{t('vouchers.availableToClaim')}</Text>
        {availableVouchers.length === 0 ? (
          <View style={styles.emptyBox}>
            <Feather name="lock" size={26} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>
              {t('vouchers.noAvailableVouchers', { level: userLevel })}
            </Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {availableVouchers.map((v) => (
              <View key={v.idVoucher} style={styles.voucherCard}>
                <View style={[styles.voucherIconWrap, { backgroundColor: '#FEF3C7' }]}>
                  <Feather name="gift" size={18} color="#D97706" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.voucherCode}>{v.code}</Text>
                  <Text style={styles.voucherDesc} numberOfLines={2}>
                  {v.description || t('vouchers.discount', { percent: v.discountPercent })} · {t('vouchers.minLevel', { level: v.minLevel })}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.claimButton}
                  onPress={() => handleClaim(v)}
                  disabled={claiming === v.idVoucher}
                >
                  {claiming === v.idVoucher ? (
                    <ActivityIndicator size="small" color={COLORS.white} />
                  ) : (
                    <Text style={styles.claimButtonText}>{t('vouchers.claim')}</Text>
                  )}
                </TouchableOpacity>
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

  sectionTitle: { fontSize: 15, fontWeight: '800', color: COLORS.textDark, marginBottom: 12, marginTop: 4 },

  emptyBox: {
    alignItems: 'center', gap: 8, paddingVertical: 28,
    backgroundColor: '#FFFFFF', borderRadius: 16, marginBottom: 28,
  },
  emptyText: { fontSize: 12.5, color: COLORS.textLight, textAlign: 'center', paddingHorizontal: 24 },

  voucherCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: '#F1F5F9',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  voucherIconWrap: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.primaryLight,
    justifyContent: 'center', alignItems: 'center',
  },
  voucherCode: { fontSize: 14, fontWeight: '800', color: COLORS.textDark, letterSpacing: 0.5 },
  voucherDesc: { fontSize: 11.5, color: COLORS.textLight, marginTop: 2 },

  statusBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 99 },
  statusText: { fontSize: 10.5, fontWeight: '700' },

  claimButton: {
    backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 9,
    borderRadius: 99, minWidth: 70, alignItems: 'center', ...PRIMARY_BUTTON_SHADOW,
  },
  claimButtonText: { color: COLORS.white, fontSize: 12, fontWeight: '700' },
});