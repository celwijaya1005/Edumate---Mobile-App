import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
  ReactNode,
} from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export interface Profile {
  id: string;
  name: string;
  phone: string | null;
  avatar_url: string | null;
  role: 'student' | 'mentor' | 'admin';
  exp_points: number;
  level: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface MentorProfile {
  id_mentor_profile: string;
  is_verified: boolean;
  rating_avg: number | null;
  total_sessions: number | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  mentorProfile: MentorProfile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  mentorProfile: null,
  loading: true,
  refreshProfile: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [mentorProfile, setMentorProfile] = useState<MentorProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string): Promise<Profile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.warn('Error fetching profile:', error.message);
        return null;
      }
      return data as Profile | null;
    } catch (err) {
      console.warn('Profile fetch exception:', err);
      return null;
    }
  };

  const fetchMentorProfile = async (userId: string): Promise<MentorProfile | null> => {
    try {
      const { data, error } = await supabase
        .from('mentor_profiles')
        .select('id_mentor_profile, is_verified, rating_avg, total_sessions')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.warn('Error fetching mentor_profiles:', error.message);
        return null;
      }
      return data as MentorProfile | null;
    } catch (err) {
      console.warn('Mentor profile fetch exception:', err);
      return null;
    }
  };

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const p = await fetchProfile(user.id);
    if (p) {
      setProfile(p);
      if (p.role === 'mentor') {
        const mp = await fetchMentorProfile(user.id);
        setMentorProfile(mp);
      } else {
        setMentorProfile(null);
      }
    }
  }, [user]);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Sign out error:', err);
    } finally {
      setUser(null);
      setSession(null);
      setProfile(null);
      setMentorProfile(null);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadProfileAndMentor(userId: string) {
      const p = await fetchProfile(userId);
      if (!isMounted) return;
      setProfile(p);

      if (p?.role === 'mentor') {
        const mp = await fetchMentorProfile(userId);
        if (isMounted) setMentorProfile(mp);
      } else {
        setMentorProfile(null);
      }
    }

    async function initAuth() {
      try {
        const {
          data: { session: initialSession },
        } = await supabase.auth.getSession();
        if (!isMounted) return;

        setSession(initialSession);
        setUser(initialSession?.user ?? null);

        if (initialSession?.user) {
          await loadProfileAndMentor(initialSession.user.id);
        }
      } catch (e) {
        console.warn('Init auth error:', e);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      if (!isMounted) return;
      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (currentSession?.user) {
        await loadProfileAndMentor(currentSession.user.id);
      } else {
        setProfile(null);
        setMentorProfile(null);
      }

      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      session,
      profile,
      mentorProfile,
      loading,
      refreshProfile,
      signOut,
    }),
    [user, session, profile, mentorProfile, loading, refreshProfile, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}