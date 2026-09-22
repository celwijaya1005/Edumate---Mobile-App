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
  Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { setAppLanguage } from '../../lib/i18n';
import { COLORS, PRIMARY_BUTTON_SHADOW } from '../../constants/brand';
import { DEFAULT_AVATAR_URI } from '../../constants/defaultAvatar';

export default function ProfileScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const [userName, setUserName] = useState('Sang Juara');
  const [userEmail, setUserEmail] = useState('');
  const [userRole, setUserRole] = useState('Murid');
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [expPoints, setExpPoints] = useState(0);
  const [level, setLevel] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    async function loadUserProfile() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUserEmail(session.user.email || '');

          const { data: profile, error } = await supabase
            .from('profiles')
            .select('name, avatar_url, role, exp_points, level')
            .eq('id', session.user.id)
            .single();

          if (error) console.log('Error loading profile:', error);

          if (profile) {
            if (profile.name) setUserName(profile.name);
            if (profile.avatar_url) setUserAvatar(profile.avatar_url);
            if (profile.role) {
              setUserRole(profile.role === 'mentor' ? 'Mentor' : profile.role === 'admin' ? 'Admin' : t('common.uncategorized'));
            }
            setExpPoints(profile.exp_points ?? 0);
            setLevel(profile.level ?? 1);
          } else if (session.user.user_metadata?.name) {
            setUserName(session.user.user_metadata.name);
          }
        }
      } catch (e) {
        console.log('Error loading profile:', e);
      } finally {
        setLoading(false);
      }
    }

    loadUserProfile();
  }, [t]);

  const handleLogout = () => {
    Alert.alert(
      t('profile.logoutConfirmTitle'),
      t('profile.logoutConfirmMsg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.logout'),
          style: 'destructive',
          onPress: async () => {
            setLoggingOut(true);
            await supabase.auth.signOut();
            setLoggingOut(false);
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* ── Top Header ────────────────────────────────────────── */}
      <View style={styles.topHeader}>
        <Image
          source={{ uri: userAvatar || DEFAULT_AVATAR_URI }}
          style={styles.headerAvatar}
        />
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{t('profile.greeting', { name: userName })}</Text>
          <Text style={styles.headerSubtitle}>{t('profile.greetingSubtitle')}</Text>
        </View>

        {/* EXP Badge Pill */}
        <View style={styles.expBadge}>
          <Feather name="zap" size={14} color={COLORS.primary} style={{ marginRight: 4 }} />
          <Text style={styles.expText}>{expPoints} EXP</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Level & Gamification Card ────────────────────────── */}
        <View style={styles.levelCard}>
          <View style={styles.levelHeader}>
            <View style={styles.levelIconWrap}>
              <Ionicons name="trophy" size={24} color={COLORS.primary} />
            </View>
            <View style={styles.levelTitleWrap}>
              <View style={styles.levelPillRow}>
                <Text style={styles.levelTitle}>Level {level}</Text>
                <View style={styles.roleTag}>
                  <Text style={styles.roleTagText}>{userRole}</Text>
                </View>
              </View>
              <Text style={styles.levelDesc}>{t('profile.expDesc', { exp: expPoints })}</Text>
            </View>
          </View>
        </View>

        {/* ── Menu & Riwayat Akun ──────────────────────────────── */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeading}>{t('profile.accountAndHistory')}</Text>
        </View>

        <View style={styles.menuContainer}>
          {/* Voucher Saya */}
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={() => router.push('/vouchers' as any)}
          >
            <View style={[styles.menuIconWrap, { backgroundColor: '#EDE9FE' }]}>
              <Feather name="gift" size={18} color="#7C3AED" />
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>{t('profile.myVouchers')}</Text>
              <Text style={styles.menuSubtitle}>{t('profile.myVouchersSubtitle')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textLight} />
          </TouchableOpacity>

          {/* Riwayat Sesi Mentor */}
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={() => router.push('/booking-history' as any)}
          >
            <View style={[styles.menuIconWrap, { backgroundColor: '#E0F2FE' }]}>
              <Feather name="calendar" size={18} color="#0284C7" />
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>{t('profile.mentorSessionHistory')}</Text>
              <Text style={styles.menuSubtitle}>{t('profile.mentorSessionSubtitle')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textLight} />
          </TouchableOpacity>

          {/* Riwayat Kuis & Sertifikat */}
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={() => router.push('/quiz-history' as any)}
          >
            <View style={[styles.menuIconWrap, { backgroundColor: '#FEF3C7' }]}>
              <Feather name="award" size={18} color="#D97706" />
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>{t('profile.quizAndCertificate')}</Text>
              <Text style={styles.menuSubtitle}>{t('profile.quizAndCertificateSubtitle')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textLight} />
          </TouchableOpacity>

          {/* Pengaturan Akun */}
          <TouchableOpacity
            style={[styles.menuItem, { borderBottomWidth: 0 }]}
            activeOpacity={0.7}
            onPress={() => router.push('/account-settings' as any)}
          >
            <View style={[styles.menuIconWrap, { backgroundColor: '#F1F5F9' }]}>
              <Feather name="settings" size={18} color="#475569" />
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>{t('profile.accountSettings')}</Text>
              <Text style={styles.menuSubtitle}>{userEmail || t('profile.accountSettingsSubtitle')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textLight} />
          </TouchableOpacity>
        </View>

        {/* ── Bahasa / Language ────────────────────────────────── */}
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

        {/* ── Tombol Keluar (Logout) ───────────────────────────── */}
        <TouchableOpacity
          style={styles.logoutButton}
          activeOpacity={0.85}
          onPress={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut ? (
            <ActivityIndicator size="small" color="#DC2626" />
          ) : (
            <>
              <Feather name="log-out" size={18} color="#DC2626" style={{ marginRight: 8 }} />
              <Text style={styles.logoutText}>{t('profile.logoutFromAccount')}</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  /* ── TOP HEADER ── */
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: COLORS.background,
  },
  headerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    backgroundColor: COLORS.track,
  },
  headerInfo: {
    flex: 1,
    paddingRight: 10,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    fontSize: 13,
    color: COLORS.textLight,
    marginTop: 2,
  },
  expBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDF3F8',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D0DFEE',
  },
  expText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primary,
  },

  /* ── SCROLL CONTENT ── */
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
  },

  /* ── LEVEL CARD ── */
  levelCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  levelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  levelIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EDF3F8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  levelTitleWrap: {
    flex: 1,
  },
  levelPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  levelTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  roleTag: {
    backgroundColor: '#EDF3F8',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.primary,
  },
  levelDesc: {
    fontSize: 12,
    color: COLORS.textLight,
    lineHeight: 16,
  },
  progressBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E2E8F0',
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },

  /* ── SECTION HEADINGS ── */
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionHeading: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },

  /* ── BADGES GRID ── */
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  badgeCard: {
    width: '22.8%',
    aspectRatio: 1,
    borderRadius: 16,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  badgeCardLocked: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    opacity: 0.6,
  },
  badgeIconBox: {
    marginBottom: 4,
  },
  badgeName: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textDark,
    textAlign: 'center',
  },
  badgeNameLocked: {
    color: '#94A3B8',
  },

  /* ── PROMO BANNER ── */
  promoBanner: {
    backgroundColor: COLORS.primary,
    borderRadius: 22,
    padding: 20,
    marginBottom: 26,
    ...PRIMARY_BUTTON_SHADOW,
  },
  promoTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.white,
    marginBottom: 6,
  },
  promoSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: 19,
    marginBottom: 16,
  },
  promoButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
  },
  promoButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primary,
  },

  /* ── MENU LIST ── */
  menuContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  menuIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textDark,
    marginBottom: 2,
  },
  menuSubtitle: {
    fontSize: 12,
    color: COLORS.textLight,
  },

  /* ── LOGOUT BUTTON ── */
  langCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
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
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingVertical: 15,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    marginBottom: 10,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#DC2626',
  },
});