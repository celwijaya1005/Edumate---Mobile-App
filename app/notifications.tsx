import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  Linking,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { COLORS, PRIMARY_BUTTON_SHADOW } from '../constants/brand';
import { DEFAULT_AVATAR_URI } from '../constants/defaultAvatar';

const BG = '#FCF9F1';

const VOUCHER_COLORS = [
  { color: '#7C3AED', bg: '#EDE9FE' },
  { color: '#0284C7', bg: '#E0F2FE' },
  { color: '#D97706', bg: '#FEF3C7' },
  { color: '#16A34A', bg: '#DCFCE7' },
];

function detectPlatform(link: string | null) {
  if (!link) return 'Online';
  if (link.includes('meet.google')) return 'Google Meet';
  if (link.includes('zoom.us')) return 'Zoom';
  if (link.includes('teams.microsoft')) return 'Microsoft Teams';
  return 'Online Meeting';
}

function formatSessionDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' });
}

function formatSessionTime(dateStr: string, durationMinutes: number) {
  const start = new Date(dateStr);
  const end = new Date(start.getTime() + durationMinutes * 60000);
  const fmt = (d: Date) => d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  return `${fmt(start)} - ${fmt(end)} WIB`;
}

type UpcomingSession = {
  id: string;
  mentorId: string;
  mentorName: string;
  mentorAvatar: string;
  topic: string;
  date: string;
  time: string;
  minutesRemaining: number;
  meetingPlatform: string;
  meetingLink: string | null;
};

type ActiveVoucher = {
  id: string;
  code: string;
  discountPercent: number;
  description: string;
  expiresAt: string | null;
  color: string;
  bg: string;
};

type ActivityItem = {
  id: string;
  type: 'session' | 'voucher' | 'quiz';
  title: string;
  desc: string;
  timestamp: string;
  icon: string;
  iconColor: string;
  iconBg: string;
};

function timeAgo(dateStr: string, t: (k: string, o?: any) => string) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return t('notifications.justNow');
  if (diffMin < 60) return t('notifications.minutesAgo', { count: diffMin });
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return t('notifications.hoursAgo', { count: diffHour });
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay === 1) return t('notifications.yesterday');
  if (diffDay < 7) return t('notifications.daysAgo', { count: diffDay });
  return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'session' | 'voucher'>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [upcomingSession, setUpcomingSession] = useState<UpcomingSession | null>(null);
  const [activeVouchers, setActiveVouchers] = useState<ActiveVoucher[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  const loadData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { setLoading(false); setRefreshing(false); return; }
      const userId = session.user.id;

      // ── Sesi mentoring terdekat yang sudah dikonfirmasi mentor ──
      const { data: sessionRow, error: sessionError } = await supabase
        .from('mentor_bookings')
        .select(`
          id_booking, scheduled_at, duration_minutes, meeting_link, notes,
          mentor:profiles!id_mentor(id, name, avatar_url)
        `)
        .eq('id_student', userId)
        .eq('status', 'confirmed')
        .gte('scheduled_at', new Date().toISOString())
        .order('scheduled_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (sessionError) console.log('Error fetching upcoming session:', sessionError);

      if (sessionRow) {
        const mentorProf = sessionRow.mentor as any;
        const minutesRemaining = Math.max(
          0,
          Math.round((new Date(sessionRow.scheduled_at).getTime() - Date.now()) / 60000)
        );
        setUpcomingSession({
          id: sessionRow.id_booking,
          mentorId: mentorProf?.id || '',
          mentorName: mentorProf?.name || t('moduleDetail.defaultMentorName'),
          mentorAvatar: mentorProf?.avatar_url || DEFAULT_AVATAR_URI,
          topic: sessionRow.notes || t('notifications.noTopic'),
          date: formatSessionDate(sessionRow.scheduled_at),
          time: formatSessionTime(sessionRow.scheduled_at, sessionRow.duration_minutes || 60),
          minutesRemaining,
          meetingPlatform: detectPlatform(sessionRow.meeting_link),
          meetingLink: sessionRow.meeting_link,
        });
      } else {
        setUpcomingSession(null);
      }

      // ── Voucher yang sudah diklaim & masih siap dipakai ──
      const { data: voucherRows, error: voucherError } = await supabase
        .from('user_vouchers')
        .select('id_user_voucher, redeemed_at, voucher:vouchers(code, discount_percent, description, expires_at)')
        .eq('id_user', userId)
        .eq('status', 'claimed')
        .order('redeemed_at', { ascending: false });

      if (voucherError) console.log('Error fetching active vouchers:', voucherError);

      const mappedVouchers: ActiveVoucher[] = (voucherRows || []).map((row: any, idx: number) => {
        const v = row.voucher;
        const palette = VOUCHER_COLORS[idx % VOUCHER_COLORS.length];
        return {
          id: row.id_user_voucher,
          code: v?.code || '-',
          discountPercent: Number(v?.discount_percent ?? 0),
          description: v?.description || '',
          expiresAt: v?.expires_at || null,
          color: palette.color,
          bg: palette.bg,
        };
      });
      setActiveVouchers(mappedVouchers);

      // ── Rangkai aktivitas terbaru dari data asli (bukan tabel notifikasi
      // tersendiri — dirangkai dari sesi selesai, kuis lulus, & voucher
      // yang baru diklaim) ──
      const [completedSessionsRes, passedQuizzesRes, claimedVouchersRes] = await Promise.all([
        supabase
          .from('mentor_bookings')
          .select('id_booking, scheduled_at, mentor:profiles!id_mentor(name)')
          .eq('id_student', userId)
          .eq('status', 'completed')
          .order('scheduled_at', { ascending: false })
          .limit(5),
        supabase
          .from('quiz_attempts')
          .select('id_attempt, score, completed_at, quiz:quizzes(title)')
          .eq('id_user', userId)
          .gte('score', 70)
          .order('completed_at', { ascending: false })
          .limit(5),
        supabase
          .from('user_vouchers')
          .select('id_user_voucher, redeemed_at, voucher:vouchers(code)')
          .eq('id_user', userId)
          .order('redeemed_at', { ascending: false })
          .limit(5),
      ]);

      const items: ActivityItem[] = [];

      (completedSessionsRes.data || []).forEach((b: any) => {
        items.push({
          id: `session-${b.id_booking}`,
          type: 'session',
          title: t('notifications.sessionCompletedTitle'),
          desc: t('notifications.sessionCompletedDesc', { mentor: b.mentor?.name || t('moduleDetail.defaultMentorName') }),
          timestamp: b.scheduled_at,
          icon: 'calendar',
          iconColor: '#0284C7',
          iconBg: '#E0F2FE',
        });
      });

      (passedQuizzesRes.data || []).forEach((q: any) => {
        items.push({
          id: `quiz-${q.id_attempt}`,
          type: 'quiz',
          title: t('notifications.quizPassedTitle'),
          desc: t('notifications.quizPassedDesc', { quiz: q.quiz?.title || '-', score: q.score }),
          timestamp: q.completed_at,
          icon: 'check-circle',
          iconColor: '#16A34A',
          iconBg: '#DCFCE7',
        });
      });

      (claimedVouchersRes.data || []).forEach((v: any) => {
        items.push({
          id: `voucher-${v.id_user_voucher}`,
          type: 'voucher',
          title: t('notifications.voucherClaimedTitle'),
          desc: t('notifications.voucherClaimedDesc', { code: v.voucher?.code || '-' }),
          timestamp: v.redeemed_at,
          icon: 'gift',
          iconColor: '#D97706',
          iconBg: '#FEF3C7',
        });
      });

      items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setActivity(items.slice(0, 10));
    } catch (e) {
      console.log('Error loading notifications data:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleUseVoucher = (voucher: ActiveVoucher) => {
    Alert.alert(
      t('notifications.voucherUsedTitle'),
      t('notifications.voucherUsedMsg', { code: voucher.code, discount: t('vouchers.discount', { percent: voucher.discountPercent }) }),
      [
        {
          text: t('notifications.chooseMentor'),
          onPress: () => router.push('/(tabs)/mentor'),
        },
        { text: t('common.close'), style: 'cancel' },
      ]
    );
  };

  const handleJoinSession = async () => {
    if (!upcomingSession?.meetingLink) {
      Alert.alert(t('notifications.noMeetingLinkTitle'), t('notifications.noMeetingLinkMsg'));
      return;
    }
    try {
      const canOpen = await Linking.canOpenURL(upcomingSession.meetingLink);
      if (canOpen) await Linking.openURL(upcomingSession.meetingLink);
      else Alert.alert(t('moduleDetail.linkErrorTitle'), upcomingSession.meetingLink);
    } catch {
      Alert.alert(t('moduleDetail.linkErrorFailedTitle'), t('moduleDetail.linkErrorFailedMsg'));
    }
  };

  const filteredActivity = activity.filter((item) => {
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'session') return item.type === 'session';
    if (selectedFilter === 'voucher') return item.type === 'voucher';
    return true;
  });

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, styles.centerBox]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* ── Top Header ────────────────────────────────────────── */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.headerBackBtn}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-back" size={20} color={COLORS.primary} />
          <Text style={styles.headerBackText}>{t('notifications.back')}</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>{t('notifications.headerTitle')}</Text>

        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {/* ── Filter Chips ────────────────────────────────────── */}
        <View style={styles.filterRow}>
          {[
            { key: 'all',     label: t('notifications.filterAll') },
            { key: 'session', label: t('notifications.filterSession') },
            { key: 'voucher', label: t('notifications.filterVoucher') },
          ].map((tab) => {
            const isActive = selectedFilter === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                activeOpacity={0.75}
                onPress={() => setSelectedFilter(tab.key as any)}
              >
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── SECTION 1: SESI MENTORING AKAN BERJALAN ─────────── */}
        {(selectedFilter === 'all' || selectedFilter === 'session') && !!upcomingSession && (
          <View style={styles.sectionWrap}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.liveIndicatorRow}>
                <View style={styles.liveDot} />
                <Text style={styles.sectionHeading}>{t('notifications.upcomingSession')}</Text>
              </View>
              {upcomingSession.minutesRemaining < 24 * 60 && (
                <View style={styles.timeBadge}>
                  <Ionicons name="time-outline" size={12} color="#D97706" />
                  <Text style={styles.timeBadgeText}>
                    {upcomingSession.minutesRemaining < 60
                      ? t('notifications.timeRemainingMinutes', { count: upcomingSession.minutesRemaining })
                      : t('notifications.timeRemainingHours', { count: Math.round(upcomingSession.minutesRemaining / 60) })}
                  </Text>
                </View>
              )}
            </View>

            {/* Upcoming Session Card */}
            <View style={styles.sessionCard}>
              <View style={styles.sessionCardTop}>
                <Image
                  source={{ uri: upcomingSession.mentorAvatar }}
                  style={styles.mentorAvatar}
                />
                <View style={styles.sessionMentorInfo}>
                  <View style={styles.mentorNameRow}>
                    <Text style={styles.mentorName}>{upcomingSession.mentorName}</Text>
                    <Ionicons name="checkmark-circle" size={15} color="#0284C7" />
                  </View>
                  <Text style={styles.mentorRole} numberOfLines={1}>
                    {upcomingSession.meetingPlatform}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.viewMentorBtn}
                  onPress={() => router.push(`/mentors/${upcomingSession.mentorId}` as any)}
                >
                  <Text style={styles.viewMentorText}>{t('notifications.viewProfile')}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.topicBox}>
                <Text style={styles.topicLabel}>{t('notifications.topicLabel')}</Text>
                <Text style={styles.topicText}>{upcomingSession.topic}</Text>
              </View>

              <View style={styles.sessionDetailsRow}>
                <View style={styles.sessionDetailItem}>
                  <Ionicons name="calendar-outline" size={14} color={COLORS.primary} />
                  <Text style={styles.sessionDetailText}>{upcomingSession.date}</Text>
                </View>
                <View style={styles.sessionDetailDivider} />
                <View style={styles.sessionDetailItem}>
                  <Ionicons name="time-outline" size={14} color={COLORS.primary} />
                  <Text style={styles.sessionDetailText}>{upcomingSession.time}</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.joinSessionButton}
                activeOpacity={0.85}
                onPress={handleJoinSession}
              >
                <Ionicons name="videocam" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.joinSessionText}>{t('notifications.joinSession', { platform: upcomingSession.meetingPlatform })}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── SECTION 2: VOUCHER AKTIF ─────────────────────────── */}
        {(selectedFilter === 'all' || selectedFilter === 'voucher') && (
          <View style={styles.sectionWrap}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.voucherTitleRow}>
                <Ionicons name="gift-outline" size={18} color={COLORS.primary} />
                <Text style={styles.sectionHeading}>{t('notifications.activeVouchers')}</Text>
              </View>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{t('notifications.available', { count: activeVouchers.length })}</Text>
              </View>
            </View>

            {activeVouchers.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="gift-outline" size={24} color={COLORS.textMuted} />
                <Text style={styles.emptyBoxText}>{t('notifications.emptyVouchers')}</Text>
              </View>
            ) : (
              <View style={styles.voucherList}>
                {activeVouchers.map((voucher) => (
                  <View key={voucher.id} style={styles.voucherCard}>
                    <View style={[styles.voucherLeftStrip, { backgroundColor: voucher.color }]}>
                      <Ionicons name="ticket" size={20} color="#FFFFFF" />
                    </View>

                    <View style={styles.voucherContent}>
                      <View style={styles.voucherHeaderRow}>
                        <View style={[styles.voucherCategoryPill, { backgroundColor: voucher.bg }]}>
                          <Text style={[styles.voucherCategoryText, { color: voucher.color }]}>
                            {t('vouchers.discount', { percent: voucher.discountPercent })}
                          </Text>
                        </View>
                        <Text style={styles.voucherCodeText}>{voucher.code}</Text>
                      </View>

                      <Text style={styles.voucherTitle}>{t('vouchers.discount', { percent: voucher.discountPercent })}</Text>
                      {!!voucher.description && <Text style={styles.voucherSubtitle}>{voucher.description}</Text>}

                      <View style={styles.voucherFooterRow}>
                        <View style={styles.voucherExpiryRow}>
                          <Ionicons name="hourglass-outline" size={12} color={COLORS.textLight} />
                          <Text style={styles.voucherExpiryText}>
                            {voucher.expiresAt
                              ? new Date(voucher.expiresAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                              : '-'}
                          </Text>
                        </View>

                        <TouchableOpacity
                          style={styles.useVoucherBtn}
                          activeOpacity={0.8}
                          onPress={() => handleUseVoucher(voucher)}
                        >
                          <Text style={styles.useVoucherBtnText}>{t('notifications.useVoucher')}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ── SECTION 3: AKTIVITAS TERBARU ─────────────────────── */}
        <View style={styles.sectionWrap}>
          <View style={styles.sectionTitleRow}>
            <View style={styles.voucherTitleRow}>
              <Ionicons name="notifications-outline" size={18} color={COLORS.primary} />
              <Text style={styles.sectionHeading}>{t('notifications.historyAndNotif')}</Text>
            </View>
          </View>

          {filteredActivity.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="time-outline" size={24} color={COLORS.textMuted} />
              <Text style={styles.emptyBoxText}>{t('notifications.emptyHistory')}</Text>
            </View>
          ) : (
            <View style={styles.notificationsList}>
              {filteredActivity.map((item) => (
                <View key={item.id} style={styles.notificationItem}>
                  <View style={[styles.notifIconBox, { backgroundColor: item.iconBg }]}>
                    <Feather name={item.icon as any} size={18} color={item.iconColor} />
                  </View>

                  <View style={styles.notifContent}>
                    <Text style={styles.notifTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.notifDesc}>{item.desc}</Text>
                    <Text style={styles.notifTime}>{timeAgo(item.timestamp, t)}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BG,
  },
  centerBox: { justifyContent: 'center', alignItems: 'center' },

  /* ── HEADER ── */
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: BG,
    borderBottomWidth: 1,
    borderBottomColor: '#EDE9DF',
  },
  headerBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingRight: 14,
    paddingLeft: 8,
    paddingVertical: 8,
    borderRadius: 99,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  headerBackText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  headerActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },

  /* ── SCROLL CONTENT ── */
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 48,
  },

  /* ── FILTER CHIPS ── */
  filterRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 99,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textDark,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },

  /* ── SECTION STYLES ── */
  sectionWrap: {
    marginBottom: 26,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  liveIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
  },
  voucherTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
  },
  timeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#D97706',
  },
  countBadge: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },

  emptyBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  emptyBoxText: {
    fontSize: 12.5,
    color: COLORS.textLight,
    textAlign: 'center',
    paddingHorizontal: 24,
  },

  /* ── UPCOMING SESSION CARD ── */
  sessionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#C5D8EC',
    shadowColor: '#204E78',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  sessionCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  mentorAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    marginRight: 12,
  },
  sessionMentorInfo: {
    flex: 1,
  },
  mentorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  mentorName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  mentorRole: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 2,
  },
  viewMentorBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
    backgroundColor: COLORS.primaryLight,
  },
  viewMentorText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  topicBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  topicLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  topicText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textDark,
    lineHeight: 18,
  },
  sessionDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 16,
    justifyContent: 'space-around',
  },
  sessionDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sessionDetailText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  sessionDetailDivider: {
    width: 1,
    height: 16,
    backgroundColor: '#C5D8EC',
  },
  joinSessionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 99,
    ...PRIMARY_BUTTON_SHADOW,
  },
  joinSessionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /* ── VOUCHER CARDS ── */
  voucherList: {
    gap: 14,
  },
  voucherCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  voucherLeftStrip: {
    width: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  voucherContent: {
    flex: 1,
    padding: 14,
  },
  voucherHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  voucherCategoryPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  voucherCategoryText: {
    fontSize: 11,
    fontWeight: '700',
  },
  voucherCodeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.5,
  },
  voucherTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textDark,
    marginBottom: 2,
  },
  voucherSubtitle: {
    fontSize: 12,
    color: COLORS.textLight,
    marginBottom: 10,
  },
  voucherFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  voucherExpiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  voucherExpiryText: {
    fontSize: 11,
    color: COLORS.textLight,
  },
  useVoucherBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 99,
  },
  useVoucherBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /* ── NOTIFICATIONS LIST ── */
  notificationsList: {
    gap: 12,
  },
  notificationItem: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  notifIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  notifContent: {
    flex: 1,
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textDark,
    marginBottom: 4,
  },
  notifDesc: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 6,
  },
  notifTime: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
});