import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/auth';
import { supabase } from '@/lib/supabase';
import { COLORS } from '@/constants/brand';
import { DEFAULT_AVATAR_URI as DEFAULT_AVATAR } from '@/constants/defaultAvatar';

const BG = '#FCF9F1';

export default function AccountSettingsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { profile, user, signOut, refreshProfile } = useAuth();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const [deleting, setDeleting] = useState(false);

  // Isi form dari data profil yang baru kebaca async dari context — pola ini
  // aman & umum dipakai, tapi tetap kena rule react-hooks/set-state-in-effect.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setPhone(profile.phone || '');
    }
  }, [profile]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      Alert.alert(t('accountSettings.emptyNameTitle'), t('accountSettings.emptyNameMsg'));
      return;
    }
    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ name: name.trim(), phone: phone.trim() || null })
        .eq('id', user?.id);

      if (error) throw error;

      await refreshProfile();
      setEditingProfile(false);
      Alert.alert(t('accountSettings.savedTitle'), t('accountSettings.profileSavedMsg'));
    } catch (e) {
      console.log('Error saving profile:', e);
      Alert.alert(t('accountSettings.saveFailedTitle'), t('accountSettings.saveFailedMsg'));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      Alert.alert(t('accountSettings.invalidPasswordTitle'), t('accountSettings.invalidPasswordMsg'));
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert(t('accountSettings.passwordMismatchTitle'), t('accountSettings.passwordMismatchMsg'));
      return;
    }
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      setNewPassword('');
      setConfirmPassword('');
      Alert.alert(t('accountSettings.savedTitle'), t('accountSettings.passwordSavedMsg'));
    } catch (e: any) {
      console.log('Error changing password:', e);
      Alert.alert(t('accountSettings.saveFailedTitle'), e?.message || t('accountSettings.saveFailedMsg'));
    } finally {
      setSavingPassword(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(t('accountSettings.logoutConfirmTitle'), t('accountSettings.logoutConfirmMsg'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('accountSettings.logout'), style: 'destructive', onPress: signOut },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t('accountSettings.deleteConfirmTitle'),
      t('accountSettings.deleteConfirmMsg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('accountSettings.deleteConfirmButton'),
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              // Penghapusan akun (auth.users) butuh hak admin (service_role),
              // jadi tidak bisa dilakukan langsung dari client. Di sini kita
              // tandai saja status profil jadi 'suspended' sebagai langkah
              // pertama, dan arahkan user menghubungi admin untuk penghapusan
              // permanen data.
              const { error } = await supabase
                .from('profiles')
                .update({ status: 'suspended' })
                .eq('id', user?.id);
              if (error) throw error;

              await signOut();
            } catch (e) {
              console.log('Error deactivating account:', e);
              Alert.alert(t('accountSettings.saveFailedTitle'), t('accountSettings.saveFailedMsg'));
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('accountSettings.headerTitle')}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Profil */}
        <View style={styles.profileCard}>
          <Image source={{ uri: profile?.avatar_url || DEFAULT_AVATAR }} style={styles.avatar} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{profile?.name || '-'}</Text>
            <Text style={styles.email}>{user?.email || '-'}</Text>
          </View>
        </View>

        {/* Edit Profil */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>{t('accountSettings.profileSectionTitle')}</Text>
          <TouchableOpacity onPress={() => (editingProfile ? handleSaveProfile() : setEditingProfile(true))} disabled={savingProfile}>
            {savingProfile ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <Text style={styles.editLink}>{editingProfile ? t('common.save') : t('accountSettings.edit')}</Text>
            )}
          </TouchableOpacity>
        </View>
        <View style={styles.formCard}>
          <Text style={styles.fieldLabel}>{t('accountSettings.nameLabel')}</Text>
          {editingProfile ? (
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder={t('accountSettings.nameLabel')} />
          ) : (
            <Text style={styles.fieldValue}>{name || '-'}</Text>
          )}

          <Text style={[styles.fieldLabel, { marginTop: 14 }]}>{t('accountSettings.phoneLabel')}</Text>
          {editingProfile ? (
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

          <Text style={[styles.fieldLabel, { marginTop: 14 }]}>{t('accountSettings.emailLabel')}</Text>
          <Text style={styles.fieldValue}>{user?.email || '-'}</Text>
          <Text style={styles.fieldHint}>{t('accountSettings.emailHint')}</Text>
        </View>

        {/* Ganti Kata Sandi */}
        <Text style={styles.sectionTitle}>{t('accountSettings.passwordSectionTitle')}</Text>
        <View style={styles.formCard}>
          <Text style={styles.fieldLabel}>{t('accountSettings.newPasswordLabel')}</Text>
          <TextInput
            style={styles.input}
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder={t('accountSettings.newPasswordPlaceholder')}
            secureTextEntry
          />

          <Text style={[styles.fieldLabel, { marginTop: 14 }]}>{t('accountSettings.confirmPasswordLabel')}</Text>
          <TextInput
            style={styles.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder={t('accountSettings.confirmPasswordPlaceholder')}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.primaryButton, savingPassword && { opacity: 0.7 }]}
            onPress={handleChangePassword}
            disabled={savingPassword}
          >
            {savingPassword ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>{t('accountSettings.changePassword')}</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={18} color="#DC2626" />
          <Text style={styles.logoutText}>{t('accountSettings.logout')}</Text>
        </TouchableOpacity>

        {/* Hapus Akun */}
        <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteAccount} disabled={deleting}>
          {deleting ? (
            <ActivityIndicator size="small" color="#991B1B" />
          ) : (
            <Text style={styles.deleteText}>{t('accountSettings.deleteAccount')}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },

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

  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 20,
  },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#F1F5F9' },
  name: { fontSize: 16, fontWeight: '800', color: COLORS.textDark },
  email: { fontSize: 12.5, color: COLORS.textLight, marginTop: 2 },

  sectionHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 10, marginTop: 4,
  },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textDark, marginBottom: 10, marginTop: 4 },
  editLink: { fontSize: 13, fontWeight: '700', color: COLORS.primary },

  formCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 20,
  },
  fieldLabel: { fontSize: 11.5, color: COLORS.textLight, fontWeight: '600', marginBottom: 6 },
  fieldValue: { fontSize: 14, color: COLORS.textDark, fontWeight: '600' },
  fieldHint: { fontSize: 11, color: COLORS.textLight, marginTop: 4 },
  input: {
    borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: COLORS.textDark,
  },

  primaryButton: {
    marginTop: 16, backgroundColor: COLORS.primary, borderRadius: 12,
    paddingVertical: 13, alignItems: 'center', justifyContent: 'center',
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  logoutButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#FEF2F2', borderRadius: 12, paddingVertical: 13, marginBottom: 12,
  },
  logoutText: { color: '#DC2626', fontSize: 14, fontWeight: '700' },

  deleteButton: { alignItems: 'center', paddingVertical: 10 },
  deleteText: { color: '#991B1B', fontSize: 12.5, fontWeight: '600', textDecorationLine: 'underline' },
});