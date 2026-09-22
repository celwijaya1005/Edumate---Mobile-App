import { DarkTheme, DefaultTheme, ThemeProvider } from "expo-router/react-navigation";
import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import 'react-native-reanimated';
import '@/lib/i18n';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/context/auth';
import { COLORS } from '@/constants/brand';

export const unstable_settings = {
  anchor: '(auth)',
};

function AuthGate() {
  const { session, profile, mentorProfile, loading } = useAuth();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;

    const currentGroup = segments[0] as string | undefined;
    const inAuthGroup = currentGroup === '(auth)';
    const inStudentTabsGroup = currentGroup === '(tabs)';
    const inMentorTabsGroup = currentGroup === '(mentor-tabs)';

    // Mentor terverifikasi -> punya akses ke layar mentor.
    const isVerifiedMentor = profile?.role === 'mentor' && mentorProfile?.is_verified === true;
    // Mentor yang daftar tapi belum (atau ditolak) verifikasi -> dikunci ke
    // halaman status verifikasi, tidak boleh akses tab murid maupun mentor.
    const isPendingMentor = profile?.role === 'mentor' && !isVerifiedMentor;
    const allowedForPendingMentor = currentGroup === 'mentor-processing' || currentGroup === 'mentor-registration';

    if (!session && !inAuthGroup) {
      // Belum login & mencoba akses halaman dalam -> redirect ke login
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      // Sudah login tapi masih di halaman auth -> redirect sesuai role
      if (isVerifiedMentor) router.replace('/(mentor-tabs)' as any);
      else if (isPendingMentor) router.replace('/mentor-processing' as any);
      else router.replace('/(tabs)' as any);
    } else if (session && isPendingMentor && !allowedForPendingMentor) {
      // Mentor belum/tidak terverifikasi mencoba akses halaman lain -> kunci ke status verifikasi
      router.replace('/mentor-processing' as any);
    } else if (session && isVerifiedMentor && inStudentTabsGroup) {
      // Mentor terverifikasi nyasar ke tab murid -> alihkan ke tab mentor
      router.replace('/(mentor-tabs)' as any);
    } else if (session && !isVerifiedMentor && !isPendingMentor && inMentorTabsGroup) {
      // Murid biasa coba akses tab mentor -> alihkan ke tab murid
      router.replace('/(tabs)' as any);
    }
  }, [session, profile, mentorProfile, loading, segments]);

  return null;
}

function RootNavigation() {
  const colorScheme = useColorScheme();
  const { loading } = useAuth();

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: COLORS.background,
        }}
      >
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(mentor-tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modules/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="quiz/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="mentors/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="booking/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="notifications" options={{ headerShown: false }} />
        <Stack.Screen name="mentor-registration" options={{ headerShown: false }} />
        <Stack.Screen name="mentor-processing" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal', headerShown: true }} />
      </Stack>

      <AuthGate />
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigation />
    </AuthProvider>
  );
}