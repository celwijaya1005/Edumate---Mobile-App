import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
} from 'react-native';
import { Link, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { signInWithGoogle } from '@/lib/googleAuth';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { COLORS, PRIMARY_BUTTON_SHADOW } from '@/constants/brand';

export default function RegisterScreen() {
  const { t } = useTranslation();
  const [role, setRole] = useState<'student' | 'mentor'>('student');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const handleRegister = async () => {
    const cleanName = fullName.trim();
    const cleanEmail = email.trim();

    if (!cleanName || !cleanEmail || !password) {
      Alert.alert(t('common.attention'), t('register.validationRequired'));
      return;
    }
    if (password.length < 6) {
      Alert.alert(t('common.attention'), t('register.validationPasswordLength'));
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          name: cleanName,
          full_name: cleanName,
          role: role,
        },
      },
    });
    setLoading(false);

    if (error) {
      if (error.message.includes('User already registered') || error.message.includes('already exists')) {
        Alert.alert(t('register.accountExistsTitle'), t('register.accountExistsMsg'));
      } else {
        Alert.alert(t('register.registerFailedTitle'), error.message);
      }
      return;
    }

    // Jika Supabase langsung memberikan session (auto-confirm)
    if (data.session && data.user) {
      // Jaga-jaga kalau tidak ada trigger DB yang otomatis menyalin role
      // dari user_metadata ke tabel profiles — set eksplisit di sini.
      const { error: roleError } = await supabase
        .from('profiles')
        .update({ role, name: cleanName })
        .eq('id', data.user.id);

      if (roleError) console.log('Error setting profile role:', roleError);

      if (role === 'mentor') {
        router.replace('/mentor-registration');
      } else {
        Alert.alert(
          t('register.successTitle'),
          t('register.successStudentMsg', { name: cleanName }),
          [
            {
              text: t('register.startLearning'),
              onPress: () => router.replace('/(tabs)'),
            },
          ]
        );
      }
    } else {
      Alert.alert(
        t('register.successTitle'),
        t('register.successPendingConfirmMsg'),
        [
          {
            text: t('register.loginNowBtn'),
            onPress: () => router.replace('/(auth)/login'),
          },
        ]
      );
    }
  };

  const handleGoogleRegister = async () => {
    setGoogleLoading(true);
    try {
      const result = await signInWithGoogle();
      if (!result?.session) return; // user cancel, tidak perlu alert

      const user = result.session.user;
      const googleName = (user.user_metadata?.full_name || user.user_metadata?.name || '').trim();

      if (result.isNewUser) {
        // Akun baru dari Google: set role sesuai pilihan di kartu Murid/Mentor,
        // sama seperti alur registrasi email biasa.
        const { error: roleError } = await supabase
          .from('profiles')
          .update({ role, ...(googleName ? { name: googleName } : {}) })
          .eq('id', user.id);

        if (roleError) console.log('Error setting profile role after Google sign-up:', roleError);

        if (role === 'mentor') {
          router.replace('/mentor-registration');
          return;
        }
      }

      // User lama yang kebetulan pakai tombol daftar, atau murid baru: langsung masuk.
      router.replace('/(tabs)');
    } catch (e: any) {
      console.log('Error signing in with Google:', e);
      Alert.alert(t('register.registerFailedTitle'), e?.message || t('register.validationRequired'));
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
        {/* Header Tetap di Atas (Sibling di luar ScrollView) */}
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <Image source={require('@/assets/images/logo.png')} style={styles.logoImage} />
            <Text style={styles.logoText}>Edumate</Text>
          </View>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity style={styles.loginBadge} activeOpacity={0.8}>
              <Text style={styles.loginBadgeText}>{t('register.login')}</Text>
            </TouchableOpacity>
          </Link>
        </View>

        {/* Form ScrollView Stabil */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={false}
          overScrollMode="never"
        >
          {/* Sambutan */}
          <View style={styles.welcomeContainer}>
            <Text style={styles.welcomeTitle}>{t('register.welcomeTitle')}</Text>
            <Text style={styles.welcomeSubtitle}>
              {t('register.welcomeSubtitle')}
            </Text>
          </View>

          {/* Pilihan Role — Berdampingan (2 kolom) */}
          <View style={styles.cardsRow}>
            {/* Kartu Murid */}
            <TouchableOpacity
              style={[styles.roleCard, role === 'student' && styles.roleCardActive]}
              activeOpacity={0.85}
              onPress={() => setRole('student')}
            >
              <View style={styles.popularBadge}>
                <Text style={styles.popularBadgeText}>{t('register.mostPopular')}</Text>
              </View>

              {role === 'student' && (
                <View style={styles.checkBadge}>
                  <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />
                </View>
              )}

              <View style={[styles.roleIconWrap, { backgroundColor: COLORS.muridIconBg }]}>
                <Ionicons name="person-outline" size={26} color={COLORS.muridIconColor} />
              </View>
              <Text style={styles.roleCardTitle}>{t('register.roleStudentTitle')}</Text>
              <Text style={styles.roleCardSubtitle}>
                {t('register.roleStudentSubtitle')}
              </Text>
            </TouchableOpacity>

            {/* Kartu Mentor */}
            <TouchableOpacity
              style={[styles.roleCard, role === 'mentor' && styles.roleCardActive]}
              activeOpacity={0.85}
              onPress={() => setRole('mentor')}
            >
              {role === 'mentor' && (
                <View style={styles.checkBadge}>
                  <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />
                </View>
              )}

              <View style={[styles.roleIconWrap, { backgroundColor: COLORS.mentorIconBg }]}>
                <MaterialCommunityIcons name="lightbulb-on-outline" size={26} color={COLORS.mentorIconColor} />
              </View>
              <Text style={styles.roleCardTitle}>{t('register.roleMentorTitle')}</Text>
              <Text style={styles.roleCardSubtitle}>
                {t('register.roleMentorSubtitle')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerLabel}>{t('register.fillYourData')}</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Form Inputs (Struktur Stabil Bebas Jumping) */}
          <View style={styles.formContainer}>
            {/* Nama Lengkap */}
            <View style={[styles.inputWrapper, nameFocused && styles.inputWrapperFocused]}>
              <Ionicons
                name="person-outline"
                size={18}
                color={nameFocused ? COLORS.primary : COLORS.textLight}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder={t('register.namePlaceholder')}
                placeholderTextColor={COLORS.textMuted}
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(false)}
              />
            </View>

            {/* Email */}
            <View style={[styles.inputWrapper, emailFocused && styles.inputWrapperFocused]}>
              <Ionicons
                name="mail-outline"
                size={18}
                color={emailFocused ? COLORS.primary : COLORS.textLight}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder={t('register.emailPlaceholder')}
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

            {/* Password */}
            <View style={[styles.inputWrapper, passwordFocused && styles.inputWrapperFocused]}>
              <Ionicons
                name="lock-closed-outline"
                size={18}
                color={passwordFocused ? COLORS.primary : COLORS.textLight}
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder={t('register.passwordPlaceholder')}
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
          </View>

          {/* Info Box Khusus Mentor */}
          {role === 'mentor' && (
            <View style={styles.mentorInfoBox}>
              <Ionicons name="information-circle-outline" size={18} color="#2563EB" />
              <Text style={styles.mentorInfoText}>
                {t('register.mentorInfoBox')}
              </Text>
            </View>
          )}

          {/* Tombol Lanjutkan Pendaftaran */}
          <TouchableOpacity
            style={[styles.primaryButton, loading && { opacity: 0.7 }]}
            activeOpacity={0.85}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <>
                <Text style={styles.primaryButtonText}>{t('register.submitButton')}</Text>
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
            <Text style={styles.socialDividerText}>{t('common.orRegisterWith')}</Text>
            <View style={styles.socialDividerLine} />
          </View>

          {/* Tombol Google (ikut role yang dipilih di atas) */}
          <View style={styles.socialButtonsRow}>
            <TouchableOpacity
              style={styles.socialBtn}
              activeOpacity={0.75}
              onPress={handleGoogleRegister}
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

          {/* Footer Masuk */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>{t('register.haveAccount')}</Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity>
                <Text style={styles.footerLink}>{t('register.loginNow')}</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  /* Header */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 10,
    backgroundColor: COLORS.background,
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
  loginBadge: {
    backgroundColor: '#E2EAF2',
    paddingVertical: 7,
    paddingHorizontal: 18,
    borderRadius: 20,
  },
  loginBadgeText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 14,
  },

  /* ScrollView content */
  container: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 40,
    flexGrow: 1,
  },

  /* Sambutan */
  welcomeContainer: {
    marginBottom: 18,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.textDark,
    marginBottom: 6,
    lineHeight: 32,
  },
  welcomeSubtitle: {
    fontSize: 13,
    color: COLORS.textLight,
    lineHeight: 20,
  },

  /* Role Cards */
  cardsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  roleCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.border,
    position: 'relative',
    minHeight: 140,
  },
  roleCardActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#F5F9FD',
  },
  roleIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  roleCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textDark,
    textAlign: 'center',
    marginBottom: 4,
    lineHeight: 18,
  },
  roleCardSubtitle: {
    fontSize: 11,
    color: COLORS.textLight,
    textAlign: 'center',
    lineHeight: 15,
  },
  popularBadge: {
    position: 'absolute',
    top: -10,
    left: 10,
    backgroundColor: COLORS.primary,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
    zIndex: 10,
  },
  popularBadgeText: {
    color: COLORS.white,
    fontSize: 9,
    fontWeight: '700',
  },
  checkBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
  },

  /* Divider */
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerLabel: {
    fontSize: 12,
    color: COLORS.textLight,
    fontWeight: '600',
  },

  /* Form */
  formContainer: {
    marginBottom: 14,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 14,
    marginBottom: 12,
    paddingHorizontal: 14,
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

  /* Info Box */
  mentorInfoBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  mentorInfoText: {
    flex: 1,
    fontSize: 12,
    color: '#1E40AF',
    lineHeight: 18,
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