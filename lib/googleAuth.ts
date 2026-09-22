// Helper Google Sign-In lewat Supabase OAuth, buat dipakai di Expo (React Native).
//
// Alurnya: buka browser OAuth Google → user login/pilih akun → Google redirect
// balik ke app (deep link) → kita ambil access_token/refresh_token dari URL
// hasil redirect itu → set jadi session Supabase.
//
// SETUP YANG WAJIB DILAKUKAN SEBELUM INI BISA JALAN:
// 1. Google Cloud Console: buat OAuth Client ID (tipe "Web application"),
//    redirect URI diisi: https://<project-ref>.supabase.co/auth/v1/callback
// 2. Supabase Dashboard → Authentication → Providers → Google: aktifkan,
//    isi Client ID & Client Secret dari langkah 1.
// 3. app.json: pastikan ada "scheme" (misal "scheme": "edumate") di root
//    config, supaya Google bisa redirect balik ke app ini.
// 4. Install package yang dibutuhkan:
//    npx expo install expo-web-browser expo-auth-session

import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

// Wajib dipanggil sekali di level atas app (misal di app/_layout.tsx) supaya
// browser OAuth otomatis ke-dismiss dengan benar setelah redirect selesai.
WebBrowser.maybeCompleteAuthSession();

export type GoogleSignInResult = {
  session: Session;
  isNewUser: boolean;
};

async function createSessionFromUrl(url: string): Promise<GoogleSignInResult | null> {
  const { params, errorCode } = QueryParams.getQueryParams(url);

  if (errorCode) throw new Error(errorCode);

  const { access_token, refresh_token } = params;
  if (!access_token || !refresh_token) return null;

  const { data, error } = await supabase.auth.setSession({
    access_token,
    refresh_token,
  });
  if (error) throw error;
  if (!data.session) return null;

  // Trik deteksi "user baru pertama kali login": Supabase mengisi created_at
  // dan last_sign_in_at dengan nilai (hampir) sama persis pas akun baru dibuat.
  const user = data.session.user;
  const isNewUser =
    !!user.created_at &&
    !!user.last_sign_in_at &&
    Math.abs(new Date(user.created_at).getTime() - new Date(user.last_sign_in_at).getTime()) < 5000;

  return { session: data.session, isNewUser };
}

/**
 * Trigger alur login Google. Buka browser OAuth, tunggu user selesai login,
 * lalu set session Supabase-nya. Return null kalau user membatalkan (cancel)
 * di tengah jalan.
 */
export async function signInWithGoogle(): Promise<GoogleSignInResult | null> {
  const redirectTo = Linking.createURL('auth-callback');
  console.log('[googleAuth] redirectTo:', redirectTo);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });
  if (error) throw error;
  if (!data?.url) throw new Error('Gagal mendapatkan URL login Google.');
  console.log('[googleAuth] OAuth URL:', data.url);

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  console.log('[googleAuth] WebBrowser result:', result.type, (result as any).url);

  if (result.type === 'success' && result.url) {
    return createSessionFromUrl(result.url);
  }
  if (result.type === 'cancel' || result.type === 'dismiss') {
    return null; // user membatalkan, bukan error
  }
  throw new Error('Login Google gagal, coba lagi.');
}