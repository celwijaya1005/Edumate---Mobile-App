import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { Link, router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { signInWithGoogle } from '@/lib/googleAuth';
import { COLORS, PRIMARY_BUTTON_SHADOW } from '@/constants/brand';

// Ilustrasi hero visual stabil (tidak melompat saat keyboard aktif)
function HeroIllustration({ topModulesLabel, topMentorLabel }: { topModulesLabel: string; topMentorLabel: string }) {
  return (
    <View style={styles.illustrationContainer}>
      <View style={styles.decorCircleLarge} />
      <View style={styles.decorCircleMedium} />

      {/* Kartu "100+ Modul" */}
      <View style={styles.bookCard}>
        <Ionicons name="book" size={18} color={COLORS.primary} />
        <Text style={styles.bookCardText}>{topModulesLabel}</Text>
      </View>

      {/* Avatar utama murid */}
      <View style={styles.mainAvatarWrap}>
        <View style={styles.mainAvatar}>
          <Ionicons name="person" size={38} color={COLORS.white} />
        </View>
        <View style={styles.laptopBadge}>
          <MaterialCommunityIcons name="laptop" size={16} color={COLORS.primary} />
        </View>
      </View>

      {/* Avatar mentor */}
      <View style={styles.mentorAvatarWrap}>
        <View style={styles.mentorAvatar}>
          <Ionicons name="person" size={24} color={COLORS.white} />
        </View>
        <View style={styles.mentorBadge}>
          <Ionicons name="star" size={10} color={COLORS.star} />
          <Text style={styles.mentorBadgeText}>4.9</Text>
        </View>
      </View>

      {/* Kartu status */}
      <View style={styles.ratingCard}>
        <Ionicons name="trophy" size={14} color={COLORS.star} />
        <Text style={styles.ratingCardText}>{topMentorLabel}</Text>
      </View>

      <Ionicons name="sparkles" size={14} color={COLORS.accent} style={styles.starDeco1} />
      <Ionicons name="star" size={10} color={COLORS.star} style={styles.starDeco2} />
    </View>
  );
}

export default function LoginScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const handleLogin = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      Alert.alert(t('common.attention'), t('common.fieldsRequired'));
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });
    setLoading(false);

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        Alert.alert(t('login.loginFailedTitle'), t('login.invalidCredentials'));
      } else if (error.message.includes('Email not confirmed')) {
        Alert.alert(t('login.emailNotConfirmedTitle'), t('login.emailNotConfirmedMsg'));
      } else {
        Alert.alert(t('login.loginFailedTitle'), error.message);
      }
    } else {
      router.replace('/(tabs)');
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const result = await signInWithGoogle();
      if (result?.session) {
        router.replace('/(tabs)');
      }
      // result null artinya user cancel di tengah jalan — tidak perlu alert.
    } catch (e: any) {
      console.log('Error signing in with Google:', e);
      Alert.alert(t('login.loginFailedTitle'), e?.message || t('common.fieldsRequired'));
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          {/* ── Area Atas: Ilustrasi (Tinggi Statis agar Tidak Melompat) ── */}
          <View style={styles.topArea}>
            <View style={styles.topBar}>
              <View style={styles.logoRow}>
                <Image source={require('@/assets/images/logo.png')} style={styles.logoImage} />
                <Text style={styles.logoText}>Edumate</Text>
              </View>
            </View>

            <HeroIllustration topModulesLabel={t('login.topModules')} topMentorLabel={t('login.topMentor')} />
          </View>

          {/* ── Area Bawah: Form Card ─────────────────────────── */}
          <View style={styles.bottomCard}>
            <View style={styles.pillHandle} />

            <Text style={styles.title}>{t('login.heroTitle')}</Text>
            <Text style={styles.subtitle}>
              {t('login.heroSubtitle')}
            </Text>

            {/* Input Email */}
            <View style={[styles.inputWrapper, emailFocused && styles.inputWrapperFocused]}>
              <Ionicons
                name="mail-outline"
                size={18}
                color={emailFocused ? COLORS.primary : COLORS.textLight}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder={t('login.emailPlaceholder')}
                placeholderTextColor={COLORS.textMuted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
              />
            </View>

            {/* Input Password */}
            <View style={[styles.inputWrapper, passwordFocused && styles.inputWrapperFocused]}>
              <Ionicons
                name="lock-closed-outline"
                size={18}
                color={passwordFocused ? COLORS.primary : COLORS.textLight}
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder={t('login.passwordPlaceholder')}
                placeholderTextColor={COLORS.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                  size={18}
                  color={COLORS.textLight}
                />
              </TouchableOpacity>
            </View>

            {/* Lupa Password */}
            <TouchableOpacity
              style={styles.forgotRow}
              onPress={() => Alert.alert(t('login.forgotPasswordTitle'), t('login.forgotPasswordMsg'))}
            >
              <Text style={styles.forgotText}>{t('login.forgotPassword')}</Text>
            </TouchableOpacity>

            {/* Tombol Lanjut / Masuk */}
            <TouchableOpacity
              style={[styles.primaryButton, loading && { opacity: 0.7 }]}
              activeOpacity={0.85}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <>
                  <Text style={styles.primaryButtonText}>{t('common.continue')}</Text>
                  <Ionicons
                    name="arrow-forward"
                    size={18}
                    color={COLORS.white}
                    style={{ marginLeft: 8 }}
                  />
                </>
              )}
            </TouchableOpacity>

            {/* Divider Sosial */}
            <View style={styles.socialDividerRow}>
              <View style={styles.socialDividerLine} />
              <Text style={styles.socialDividerText}>{t('common.orLoginWith')}</Text>
              <View style={styles.socialDividerLine} />
            </View>

            {/* Tombol Google */}
            <View style={styles.socialButtonsRow}>
              <TouchableOpacity
                style={styles.socialBtn}
                activeOpacity={0.75}
                onPress={handleGoogleLogin}
                disabled={googleLoading}
              >
                {googleLoading ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <>
                    <Ionicons name="logo-google" size={18} color="#EA4335" style={{ marginRight: 8 }} />
                    <Text style={styles.socialBtnText}>Google</Text>
                  </>
                )}
              </TouchableOpacity>

              
            </View>

            {/* Footer Daftar */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>{t('login.noAccount')}</Text>
              <Link href="/(auth)/register" asChild>
                <TouchableOpacity>
                  <Text style={styles.footerLink}>{t('login.registerNow')}</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#EDF3F8',
  },
  scrollContent: {
    flexGrow: 1,
    backgroundColor: '#EDF3F8',
  },

  /* ── TOP AREA (Tinggi Statis agar Tidak Melompat) ── */
  topArea: {
    backgroundColor: '#EDF3F8',
    height: 240,
    position: 'relative',
    overflow: 'hidden',
  },
  topBar: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 4,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoImage: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  logoText: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 0.3,
  },

  /* Ilustrasi */
  illustrationContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  decorCircleLarge: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(32, 78, 120, 0.08)',
    top: -20,
    right: -40,
  },
  decorCircleMedium: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    bottom: 0,
    left: -20,
  },
  mainAvatarWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  mainAvatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: COLORS.white,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  laptopBadge: {
    position: 'absolute',
    bottom: -2,
    right: -6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mentorAvatarWrap: {
    position: 'absolute',
    bottom: 16,
    right: 36,
    alignItems: 'center',
  },
  mentorAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#5B86A9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: COLORS.white,
  },
  mentorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginTop: 2,
    gap: 2,
  },
  mentorBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  bookCard: {
    position: 'absolute',
    top: 10,
    left: 24,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  bookCardText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  ratingCard: {
    position: 'absolute',
    bottom: 14,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  ratingCardText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  starDeco1: { position: 'absolute', top: 20, right: 70 },
  starDeco2: { position: 'absolute', bottom: 30, right: 100 },

  /* ── BOTTOM CARD ── */
  bottomCard: {
    flex: 1,
    minHeight: 460,
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 36,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  pillHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.textDark,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textLight,
    lineHeight: 20,
    marginBottom: 20,
  },

  /* Input */
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 16,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 2,
  },
  inputWrapperFocused: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 13,
    color: COLORS.textDark,
    fontSize: 15,
  },
  eyeBtn: {
    padding: 6,
    marginLeft: 4,
  },

  forgotRow: {
    alignSelf: 'flex-end',
    marginBottom: 18,
    marginTop: 2,
  },
  forgotText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
  },

  /* Button */
  primaryButton: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    marginBottom: 18,
    ...PRIMARY_BUTTON_SHADOW,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  /* Social Login Buttons */
  socialDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 10,
  },
  socialDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  socialDividerText: {
    fontSize: 12,
    color: COLORS.textLight,
    fontWeight: '600',
  },
  socialButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  socialBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
  },
  socialBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textDark,
  },

  /* Footer */
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: { color: COLORS.textLight, fontSize: 14 },
  footerLink: { color: COLORS.primary, fontSize: 14, fontWeight: '700' },
});