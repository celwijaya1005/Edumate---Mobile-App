import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { COLORS, PRIMARY_BUTTON_SHADOW } from '../../constants/brand';
import { DEFAULT_AVATAR_URI } from '../../constants/defaultAvatar';

const BG = '#FCF9F1';

export default function RatingScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [mentorName, setMentorName] = useState('');
  const [mentorAvatar, setMentorAvatar] = useState(DEFAULT_AVATAR_URI);
  const [moduleTitle, setModuleTitle] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  // Kalau sesi ini sudah pernah dirating, tampilkan read-only.
  const [existingRating, setExistingRating] = useState<{ stars: number; comment: string | null } | null>(null);

  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');

  const loadBooking = useCallback(async () => {
    if (!bookingId) { setNotFound(true); setLoading(false); return; }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { setNotFound(true); setLoading(false); return; }

      const { data: booking, error: bookingError } = await supabase
        .from('mentor_bookings')
        .select(`
          id_booking, status, id_student,
          mentor:profiles!id_mentor(name, avatar_url),
          module:modules(title)
        `)
        .eq('id_booking', bookingId)
        .eq('id_student', session.user.id)
        .eq('status', 'completed')
        .maybeSingle();

      if (bookingError) console.log('Error fetching booking for rating:', bookingError);

      if (!booking) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const mentorProf = booking.mentor as any;
      setMentorName(mentorProf?.name || t('moduleDetail.defaultMentorName'));
      setMentorAvatar(mentorProf?.avatar_url || DEFAULT_AVATAR_URI);
      setModuleTitle((booking.module as any)?.title || null);

      const { data: ratingRow, error: ratingError } = await supabase
        .from('mentor_ratings')
        .select('stars, comment')
        .eq('id_booking', bookingId)
        .maybeSingle();

      if (ratingError) console.log('Error checking existing rating:', ratingError);

      if (ratingRow) {
        setExistingRating({ stars: ratingRow.stars, comment: ratingRow.comment });
        setStars(ratingRow.stars);
        setComment(ratingRow.comment || '');
      }
    } catch (e) {
      console.log('Error loading booking for rating:', e);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [bookingId, t]);

  useEffect(() => {
    let isMounted = true;

    const runLoad = async () => {
      if (!isMounted) return;
      await loadBooking();
    };

    void runLoad();

    return () => {
      isMounted = false;
    };
  }, [loadBooking]);

  const handleSubmit = async () => {
    if (stars < 1) {
      Alert.alert(t('rating.emptyStarsTitle'), t('rating.emptyStarsMsg'));
      return;
    }
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        Alert.alert(t('bookingScreen.notLoggedInTitle'), t('bookingScreen.notLoggedInMsg'));
        return;
      }

      const { data: booking, error: bookingError } = await supabase
        .from('mentor_bookings')
        .select('id_mentor')
        .eq('id_booking', bookingId)
        .single();

      if (bookingError || !booking) throw bookingError || new Error('Booking not found');

      const { error } = await supabase.from('mentor_ratings').insert({
        id_booking: bookingId,
        id_student: session.user.id,
        id_mentor: booking.id_mentor,
        stars,
        comment: comment.trim() || null,
      });

      if (error) throw error;

      Alert.alert(t('rating.savedTitle'), t('rating.savedMsg'), [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      console.log('Error submitting rating:', e);
      Alert.alert(t('rating.saveFailedTitle'), e?.message || t('rating.saveFailedMsg'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, styles.centerBox]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  if (notFound) {
    return (
      <SafeAreaView style={[styles.safe, styles.centerBox]}>
        <Ionicons name="alert-circle-outline" size={40} color={COLORS.textMuted} />
        <Text style={styles.notFoundText}>{t('rating.notFoundMsg')}</Text>
        <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
          <Text style={styles.backLinkText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const isReadOnly = !!existingRating;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('rating.headerTitle')}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.mentorCard}>
          <Image source={{ uri: mentorAvatar }} style={styles.avatar} />
          <Text style={styles.mentorName}>{mentorName}</Text>
          {!!moduleTitle && <Text style={styles.moduleTitle}>{moduleTitle}</Text>}
        </View>

        {isReadOnly && (
          <View style={styles.alreadyRatedBanner}>
            <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
            <Text style={styles.alreadyRatedText}>{t('rating.alreadyRated')}</Text>
          </View>
        )}

        <Text style={styles.sectionLabel}>{t('rating.starsLabel')}</Text>
        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((n) => (
            <TouchableOpacity
              key={n}
              disabled={isReadOnly}
              onPress={() => setStars(n)}
              activeOpacity={0.7}
              style={styles.starBtn}
            >
              <Ionicons
                name={n <= stars ? 'star' : 'star-outline'}
                size={38}
                color={n <= stars ? '#F59E0B' : '#CBD5E1'}
              />
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionLabel}>{t('rating.commentLabel')}</Text>
        <TextInput
          style={[styles.commentInput, isReadOnly && styles.commentInputDisabled]}
          value={comment}
          onChangeText={setComment}
          placeholder={t('rating.commentPlaceholder')}
          placeholderTextColor={COLORS.textLight}
          multiline
          editable={!isReadOnly}
        />

        {!isReadOnly && (
          <TouchableOpacity
            style={[styles.submitButton, submitting && { opacity: 0.7 }]}
            activeOpacity={0.85}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>{t('rating.submitButton')}</Text>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  centerBox: { justifyContent: 'center', alignItems: 'center', gap: 12, paddingHorizontal: 30 },

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

  scrollContent: { paddingHorizontal: 24, paddingBottom: 48, alignItems: 'center' },

  mentorCard: { alignItems: 'center', marginTop: 12, marginBottom: 20 },
  avatar: { width: 72, height: 72, borderRadius: 36, marginBottom: 10, backgroundColor: '#F1F5F9' },
  mentorName: { fontSize: 17, fontWeight: '800', color: COLORS.textDark },
  moduleTitle: { fontSize: 12.5, color: COLORS.textLight, marginTop: 2 },

  alreadyRatedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F0FDF4', paddingVertical: 10, paddingHorizontal: 14,
    borderRadius: 12, marginBottom: 18, alignSelf: 'stretch', justifyContent: 'center',
  },
  alreadyRatedText: { fontSize: 12.5, color: '#16A34A', fontWeight: '600' },

  sectionLabel: {
    fontSize: 13, fontWeight: '700', color: COLORS.textDark,
    alignSelf: 'flex-start', marginBottom: 10, marginTop: 6,
  },
  starsRow: { flexDirection: 'row', gap: 6, marginBottom: 22 },
  starBtn: { padding: 2 },

  commentInput: {
    alignSelf: 'stretch', backgroundColor: '#FFFFFF', borderRadius: 14,
    borderWidth: 1.5, borderColor: '#E2E8F0', padding: 14,
    minHeight: 110, textAlignVertical: 'top', fontSize: 13.5, color: COLORS.textDark,
    marginBottom: 26,
  },
  commentInputDisabled: { backgroundColor: '#F8FAFC', color: COLORS.textLight },

  submitButton: {
    alignSelf: 'stretch', backgroundColor: COLORS.primary,
    paddingVertical: 15, borderRadius: 99, alignItems: 'center', justifyContent: 'center',
    ...PRIMARY_BUTTON_SHADOW,
  },
  submitButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  notFoundText: { fontSize: 13.5, color: COLORS.textLight, textAlign: 'center' },
  backLink: { paddingVertical: 8, paddingHorizontal: 16 },
  backLinkText: { color: COLORS.primary, fontWeight: '700', fontSize: 13 },
});