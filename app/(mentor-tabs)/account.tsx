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
  Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { setAppLanguage } from '@/lib/i18n';
import { useAuth } from '@/context/auth';
import { supabase } from '@/lib/supabase';
import { COLORS } from '@/constants/brand';
import { DEFAULT_AVATAR_URI as DEFAULT_AVATAR } from '@/constants/defaultAvatar';

const BG = '#FCF9F1';

export default function MentorAccountScreen() {
  const { t, i18n } = useTranslation();
  const { profile, mentorProfile, signOut, refreshProfile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [expertise, setExpertise] = useState('');
  const [bio, setBio] = useState('');
  const [ratePerSession, setRatePerSession] = useState('');
  const [balance, setBalance] = useState(0);
  const [completedSessions, setCompletedSessions] = useState(0);

  const loadAccountData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { setLoading(false); return; }

      const { data: profileRow } = await supabase
        .from('profiles')
        .select('name, phone')
        .eq('id', session.user.id)
        .single();

      if (profileRow) {
        setName(profileRow.name || '');
        setPhone(profileRow.phone || '');
      }

      const { data: mentorRow } = await supabase
        .from('mentor_profiles')
        .select('expertise, curriculum_vitae, rate_per_session')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (mentorRow) {
        setExpertise(mentorRow.expertise || '');
        setBio(mentorRow.curriculum_vitae || '');
        setRatePerSession(mentorRow.rate_per_session != null ? String(mentorRow.rate_per_session) : '');
      }

      // Saldo dihitung asli dari total_amount sesi yang sudah selesai
      // (belum ada tabel wallet/transaksi terpisah, jadi dihitung langsung
      // dari mentor_bookings — bukan angka fiktif).
      const { data: completedRows, error: completedError } = await supabase
        .from('mentor_bookings')
        .select('total_amount')
        .eq('id_mentor', session.user.id)
        .eq('status', 'completed');

      if (completedError) console.log('Error fetching completed bookings for balance:', completedError);

      const totalBalance = (completedRows || []).reduce((sum: number, b: any) => sum + Number(b.total_amount || 0), 0);
      setBalance(totalBalance);
      setCompletedSessions((completedRows || []).length);
    } catch (e) {
      console.log('Error loading mentor account data:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAccountData();
    }, [loadAccountData])
  );

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(t('mentorAccount.emptyNameTitle'), t('mentorAccount.emptyNameMsg'));
      return;
    }
    const rateNumber = Number(ratePerSession);
    if (ratePerSession && (isNaN(rateNumber) || rateNumber < 0)) {
      Alert.alert(t('mentorAccount.invalidRateTitle'), t('mentorAccount.invalidRateMsg'));
      return;
    }

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ name: name.trim(), phone: phone.trim() || null })
        .eq('id', session.user.id);

      if (profileError) console.log('Error updating profile:', profileError);

      const { error: mentorError } = await supabase
        .from('mentor_profiles')
        .update({
          expertise: expertise.trim() || null,
          curriculum_vitae: bio.trim() || null,
          rate_per_session: ratePerSession ? rateNumber : null,
        })
        .eq('user_id', session.user.id);

      if (mentorError) console.log('Error updating mentor profile:', mentorError);

      await refreshProfile();
      setEditing(false);
      Alert.alert(t('mentorAccount.savedTitle'), t('mentorAccount.savedMsg'));
    } catch (e) {
      console.log('Error saving mentor account:', e);
      Alert.alert(t('mentorAccount.saveFailedTitle'), t('mentorDashboard.respondFailedMsg'));
    } finally {
      setSaving(false);
    }
  };

  const handleWithdraw = () => {
    Alert.alert(t('mentorAccount.withdrawTitle'), t('mentorAccount.withdrawMsg'));
  };

  const handleLogout = () => {
    Alert.alert(t('mentorAccount.logoutConfirmTitle'), t('mentorAccount.logoutConfirmMsg'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('mentorAccount.logout'), style: 'destructive', onPress: signOut },
    ]);
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
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.logoRow}>
          <Image source={require('@/assets/images/logo.png')} style={styles.logoImage} />
          <Text style={styles.logoText}>{t('common.appName')}</Text>
        </View>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('mentorAccount.headerTitle')}</Text>
          <TouchableOpacity onPress={() => (editing ? handleSave() : setEditing(true))} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <Text style={styles.editLink}>{editing ? t('common.save') : t('mentorAccount.edit')}</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <Image source={{ uri: profile?.avatar_url || DEFAULT_AVATAR }} style={styles.avatar} />
          <View style={{ flex: 1 }}>
            {editing ? (
              <TextInput style={styles.nameInput} value={name} onChangeText={setName} placeholder={t('mentorAccount.namePlaceholder')} />
            ) : (
              <Text style={styles.name}>{name || t('moduleDetail.defaultMentorName')}</Text>
            )}
            <Text style={styles.badge}>{t('mentorAccount.verifiedBadge')}</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="star" size={16} color={COLORS.star} />
            <Text style={styles.statValue}>
              {mentorProfile?.rating_avg != null ? Number(mentorProfile.rating_avg).toFixed(1) : '0.0'}
            </Text>
            <Text style={styles.statLabel}>{t('mentorDashboard.statRating')}</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="checkmark-done" size={16} color="#16A34A" />
            <Text style={styles.statValue}>{mentorProfile?.total_sessions ?? 0}</Text>
            <Text style={styles.statLabel}>{t('mentorProfile.statSessionsLabel')}</Text>
          </View>
        </View>

        {/* Form Info */}
        <Text style={styles.sectionTitle}>{t('mentorAccount.contactInfoTitle')}</Text>
        <View style={styles.formCard}>
          <Text style={styles.fieldLabel}>{t('mentorAccount.phoneLabel')}</Text>
          {editing ? (
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="08xxxxxxxxxx"
              keyboardType="phone-pad"
            />
          ) : (
            <Text style={styles.fieldValue}>{phone || '-'}</Text>
          )}
        </View>

        <Text style={styles.sectionTitle}>{t('mentorAccount.mentorInfoTitle')}</Text>
        <View style={styles.formCard}>
          <Text style={styles.fieldLabel}>{t('mentorAccount.expertiseLabel')}</Text>
          {editing ? (
            <TextInput
              style={styles.input}
              value={expertise}
              onChangeText={setExpertise}
              placeholder={t('mentorAccount.expertisePlaceholder')}
            />
          ) : (
            <Text style={styles.fieldValue}>{expertise || '-'}</Text>
          )}

          <Text style={[styles.fieldLabel, { marginTop: 14 }]}>{t('mentorAccount.bioLabel')}</Text>
          {editing ? (
            <TextInput
              style={[styles.input, styles.textArea]}
              value={bio}
              onChangeText={setBio}
              placeholder={t('mentorAccount.bioPlaceholder')}
              multiline
            />
          ) : (
            <Text style={styles.fieldValue}>{bio || '-'}</Text>
          )}

          <Text style={[styles.fieldLabel, { marginTop: 14 }]}>{t('mentorAccount.rateLabel')}</Text>
          {editing ? (
            <TextInput
              style={styles.input}
              value={ratePerSession}
              onChangeText={setRatePerSession}
              placeholder={t('mentorAccount.ratePlaceholder')}
              keyboardType="number-pad"
            />
          ) : (
            <Text style={styles.fieldValue}>
              {ratePerSession ? `Rp${Number(ratePerSession).toLocaleString('id-ID')}` : '-'}
            </Text>
          )}
        </View>

        {/* Saldo & Penarikan Dana */}
        <Text style={styles.sectionTitle}>{t('mentorAccount.walletSectionTitle')}</Text>
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>{t('mentorAccount.currentBalance')}</Text>
          <Text style={styles.balanceValue}>Rp{balance.toLocaleString('id-ID')}</Text>
          <Text style={styles.balanceSubtext}>
            {t('mentorAccount.fromSessionsCount', { count: completedSessions })}
          </Text>

          <TouchableOpacity style={styles.withdrawButton} onPress={handleWithdraw}>
            <Feather name="arrow-down-circle" size={16} color="#FFFFFF" />
            <Text style={styles.withdrawButtonText}>{t('mentorAccount.withdraw')}</Text>
          </TouchableOpacity>

          <View style={styles.withdrawNoteBox}>
            <Feather name="info" size={12} color={COLORS.textMuted} />
            <Text style={styles.withdrawNoteText}>{t('mentorAccount.withdrawNote')}</Text>
          </View>
        </View>

        {/* Bahasa / Language */}
        <View style={styles.langCard}>
          <View style={styles.langLabelRow}>
            <Feather name="globe" size={16} color={COLORS.textDark} />
            <Text style={styles.langLabel}>{t('profile.language')}</Text>
          </View>
          <View style={styles.langToggleRow}>
            <TouchableOpacity
              style={[styles.langOption, i18n.language === 'id' && styles.langOptionActive]}
              onPress={() => setAppLanguage('id')}
            >
              <Text style={[styles.langOptionText, i18n.language === 'id' && styles.langOptionTextActive]}>
                🇮🇩 {t('profile.languageIndonesian')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.langOption, i18n.language === 'en' && styles.langOptionActive]}
              onPress={() => setAppLanguage('en')}
            >
              <Text style={[styles.langOptionText, i18n.language === 'en' && styles.langOptionTextActive]}>
                🇬🇧 {t('profile.languageEnglish')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={18} color="#DC2626" />
          <Text style={styles.logoutText}>{t('mentorAccount.logoutButton')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  centerBox: { justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 20, paddingBottom: 40 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  logoImage: { width: 20, height: 20, resizeMode: 'contain' },
  logoText: { fontSize: 15, fontWeight: '800', color: COLORS.primary, letterSpacing: 0.2 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textDark },
  editLink: { fontSize: 14, fontWeight: '700', color: COLORS.primary },

  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: '#F1F5F9',
  },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: COLORS.track },
  name: { fontSize: 17, fontWeight: '800', color: COLORS.textDark },
  nameInput: {
    fontSize: 16, fontWeight: '700', color: COLORS.textDark,
    borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingVertical: 4,
  },
  badge: { fontSize: 11.5, color: '#16A34A', fontWeight: '600', marginTop: 4 },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statCard: {
    flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, paddingVertical: 14,
    alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#F1F5F9',
  },
  statValue: { fontSize: 17, fontWeight: '800', color: COLORS.textDark },
  statLabel: { fontSize: 10.5, color: COLORS.textLight, fontWeight: '600' },

  sectionTitle: { fontSize: 14, fontWeight: '800', color: COLORS.textDark, marginBottom: 10 },
  formCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 20,
    borderWidth: 1, borderColor: '#F1F5F9',
  },
  fieldLabel: { fontSize: 11.5, fontWeight: '700', color: COLORS.textMuted, marginBottom: 6 },
  fieldValue: { fontSize: 14, color: COLORS.textDark },
  input: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: COLORS.textDark,
  },
  textArea: { minHeight: 70, textAlignVertical: 'top' },

  balanceCard: {
    backgroundColor: COLORS.primary, borderRadius: 18, padding: 20,
    alignItems: 'center', marginBottom: 24,
  },
  balanceLabel: { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  balanceValue: { fontSize: 28, color: '#FFFFFF', fontWeight: '800', marginTop: 4 },
  balanceSubtext: { fontSize: 11.5, color: 'rgba(255,255,255,0.75)', marginTop: 4, marginBottom: 16 },
  withdrawButton: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 20, paddingVertical: 11,
    borderRadius: 99, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  withdrawButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  withdrawNoteBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    marginTop: 14, paddingHorizontal: 8,
  },
  withdrawNoteText: { flex: 1, fontSize: 10.5, color: 'rgba(255,255,255,0.7)', lineHeight: 14 },

  langCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  langLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  langLabel: { fontSize: 13, fontWeight: '700', color: COLORS.textDark },
  langToggleRow: { flexDirection: 'row', gap: 10 },
  langOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderWidth: 1.5,
    borderColor: '#F1F5F9',
  },
  langOptionActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  langOptionText: { fontSize: 13, fontWeight: '600', color: COLORS.textLight },
  langOptionTextActive: { color: COLORS.primary, fontWeight: '700' },

  logoutButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA',
    paddingVertical: 14, borderRadius: 14,
  },
  logoutText: { color: '#DC2626', fontWeight: '700', fontSize: 14 },
});