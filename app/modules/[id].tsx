import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Share,
  Linking,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { COLORS, PRIMARY_BUTTON_SHADOW } from '../../constants/brand';
import { DEFAULT_AVATAR_URI } from '../../constants/defaultAvatar';

const BG = '#FCF9F1';

// Skor minimum dianggap lulus kuis.
// CATATAN: tabel `quizzes` belum punya kolom passing_score, jadi nilai ini
// hardcode sementara. Kalau nanti mau bisa diatur per-kuis, perlu tambah
// kolom baru di tabel `quizzes` (butuh konfirmasi user dulu).
const PASSING_SCORE = 70;

const CONTENT_TYPE_META: Record<string, { icon: keyof typeof Ionicons.glyphMap; labelKey: string; color: string; bg: string }> = {
  video: { icon: 'play-circle', labelKey: 'moduleDetail.contentTypeVideo', color: '#DC2626', bg: '#FEE2E2' },
  artikel: { icon: 'document-text-outline', labelKey: 'moduleDetail.contentTypeArticle', color: '#2563EB', bg: '#DBEAFE' },
  dokumen: { icon: 'document-attach-outline', labelKey: 'moduleDetail.contentTypeDocument', color: '#7C3AED', bg: '#EDE9FE' },
};

const FALLBACK_MODULE = {
  id: '',
  title: 'Memuat modul...',
  category: 'Umum',
  level: '-',
  lessons: 0,
  mentorId: '',
  mentor: {
    name: 'Mentor Edumate',
    avatar: DEFAULT_AVATAR_URI,
  },
  description: '',
  contents: [] as { id: string; title: string; contentType: string; url: string }[],
};

export default function ModuleDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [moduleData, setModuleData] = useState<any>(FALLBACK_MODULE);
  const [loading, setLoading] = useState(true);
  const [isBookmarked, setIsBookmarked] = useState(false);

  // id item konten yang sudah pernah ditap/dibuka user
  const [openedIds, setOpenedIds] = useState<Set<string>>(new Set());

  // Info kuis untuk modul ini (null kalau modul belum punya kuis)
  const [quizId, setQuizId] = useState<string | null>(null);

  // Status kuis: 'locked' | 'unlocked' | 'done'
  const [quizStatus, setQuizStatus] = useState<'locked' | 'unlocked' | 'done'>('locked');
  const [checkingQuizStatus, setCheckingQuizStatus] = useState(false);

  const totalContents = moduleData.contents.length;
  const isComplete = totalContents > 0 && openedIds.size >= totalContents;

  // Buka kuis otomatis kalau semua item konten sudah pernah ditap
  useEffect(() => {
    if (isComplete && quizStatus === 'locked') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- transisi status satu arah (locked -> unlocked) dipicu oleh perubahan data eksternal (openedIds), bukan render loop
      setQuizStatus('unlocked');
    }
  }, [isComplete, quizStatus]);

  // Fetch detail modul dari Supabase
  useEffect(() => {
    async function loadModule() {
      if (!id) { setLoading(false); return; }
      try {
        const { data, error } = await supabase
          .from('modules')
          .select(`
            id_module, title, description, difficulty_level,
            category:categories(name),
            mentor:profiles!id_mentor(id, name, avatar_url),
            contents:module_contents(id_content, title, content_type, url, order_index)
          `)
          .eq('id_module', id)
          .single();

        if (error) {
          console.log('Error fetching module:', error);
        }

        if (data) {
          const mentorProfile = data.mentor as any;
          const sortedContents = ((data.contents as any[]) || [])
            .slice()
            .sort((a, b) => a.order_index - b.order_index)
            .map((c: any) => ({
              id: c.id_content,
              title: c.title,
              contentType: c.content_type,
              url: c.url,
            }));

          setModuleData({
            id: data.id_module,
            title: data.title,
            category: (data.category as any)?.name || t('common.uncategorized'),
            level: data.difficulty_level || '-',
            lessons: sortedContents.length,
            mentorId: mentorProfile?.id || '',
            mentor: {
              name: mentorProfile?.name || t('moduleDetail.defaultMentorName'),
              avatar: mentorProfile?.avatar_url || FALLBACK_MODULE.mentor.avatar,
            },
            description: data.description || '',
            contents: sortedContents,
          });

          // Muat progress yang sudah tersimpan sebelumnya (kalau user pernah
          // buka modul ini di sesi lain), biar openedIds & status kuis
          // langsung sinkron, bukan mulai dari kosong lagi.
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user && sortedContents.length > 0) {
            const { data: progressRows, error: progressError } = await supabase
              .from('module_content_progress')
              .select('id_content')
              .eq('id_user', session.user.id)
              .in('id_content', sortedContents.map((c: any) => c.id));

            if (progressError) console.log('Error fetching content progress:', progressError);
            if (progressRows) {
              setOpenedIds(new Set(progressRows.map((p: any) => p.id_content)));
            }
          }
        }
      } catch (e) {
        console.log('Error fetching module:', e);
      } finally {
        setLoading(false);
      }
    }
    loadModule();
  }, [id, t]);

  // Cek apakah modul ini punya kuis, dan apakah user sudah pernah lulus.
  // Dijalankan tiap layar ini fokus lagi (misal: balik dari layar kuis),
  // supaya status "done" langsung ke-update tanpa perlu buka-tutup app.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function checkQuiz() {
        if (!id) return;
        setCheckingQuizStatus(true);
        try {
          const { data: quizRow, error: quizError } = await supabase
            .from('quizzes')
            .select('id_quiz')
            .eq('id_module', id)
            .maybeSingle();

          if (quizError) console.log('Error fetching quiz for module:', quizError);
          if (cancelled) return;

          if (!quizRow) {
            setQuizId(null);
            return;
          }
          setQuizId(quizRow.id_quiz);

          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.user) return;

          const { data: bestAttempt, error: attemptError } = await supabase
            .from('quiz_attempts')
            .select('score')
            .eq('id_quiz', quizRow.id_quiz)
            .eq('id_user', session.user.id)
            .order('score', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (attemptError) console.log('Error fetching quiz attempt:', attemptError);
          if (cancelled) return;

          if (bestAttempt && Number(bestAttempt.score) >= PASSING_SCORE) {
            setQuizStatus('done');
          }
        } catch (e) {
          console.log('Error checking quiz status:', e);
        } finally {
          if (!cancelled) setCheckingQuizStatus(false);
        }
      }

      checkQuiz();
      return () => { cancelled = true; };
    }, [id])
  );

  const handleShare = async () => {
    try {
      await Share.share({ message: t('moduleDetail.shareMessage', { title: moduleData.title }) });
    } catch {}
  };

  const handleOpenContent = async (item: { id: string; title: string; url: string }) => {
    setOpenedIds((prev) => {
      const next = new Set(prev);
      next.add(item.id);
      return next;
    });

    // Simpan progress ke DB biar nggak ilang kalau keluar-masuk halaman
    // atau buka lagi di lain waktu. onConflict biar aman ditap berkali-kali.
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { error: progressError } = await supabase
          .from('module_content_progress')
          .upsert(
            { id_user: session.user.id, id_content: item.id },
            { onConflict: 'id_user,id_content', ignoreDuplicates: true }
          );
        if (progressError) console.log('Error saving content progress:', progressError);
      }
    } catch (e) {
      console.log('Error saving content progress:', e);
    }

    try {
      const canOpen = await Linking.canOpenURL(item.url);
      if (canOpen) {
        await Linking.openURL(item.url);
      } else {
        Alert.alert(t('moduleDetail.linkErrorTitle'), item.url);
      }
    } catch {
      Alert.alert(t('moduleDetail.linkErrorFailedTitle'), t('moduleDetail.linkErrorFailedMsg'));
    }
  };

  const handleQuizOrMentor = () => {
    if (quizStatus === 'unlocked') {
      if (!quizId) {
        Alert.alert(t('moduleDetail.quizNotAvailableTitle'), t('moduleDetail.quizNotAvailableMsg'));
        return;
      }
      router.push(`/quiz/${quizId}?moduleId=${moduleData.id}&mentorId=${moduleData.mentorId}` as any);
    } else if (quizStatus === 'done') {
      router.push(`/mentors/${moduleData.mentorId}` as any);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, styles.centerBox]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>{t('moduleDetail.loadingContent')}</Text>
      </SafeAreaView>
    );
  }

  // ── Konfigurasi tombol bawah berdasarkan status ──
  const bottomBtnConfig = {
    locked: {
      label: t('moduleDetail.btnLockedLabel'),
      icon: 'lock-closed-outline' as const,
      color: '#94A3B8',
      bg: '#E2E8F0',
      disabled: true,
    },
    unlocked: {
      label: t('moduleDetail.btnUnlockedLabel'),
      icon: 'clipboard-outline' as const,
      color: '#FFFFFF',
      bg: COLORS.primary,
      disabled: false,
    },
    done: {
      label: t('moduleDetail.btnDoneLabel'),
      icon: 'chatbubble-ellipses-outline' as const,
      color: '#FFFFFF',
      bg: '#16A34A',
      disabled: false,
    },
  }[quizStatus];

  return (
    <SafeAreaView style={styles.safe}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBackBtn} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={20} color={COLORS.primary} />
          <Text style={styles.headerSubtitle}>{t('moduleDetail.headerLabel', { category: moduleData.category })}</Text>
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            activeOpacity={0.8}
            onPress={() => setIsBookmarked(!isBookmarked)}
          >
            <Ionicons
              name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
              size={20}
              color={COLORS.primary}
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn} activeOpacity={0.8} onPress={handleShare}>
            <Ionicons name="share-social-outline" size={20} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Progress Bar (jumlah materi yang sudah dibuka) ── */}
      <View style={styles.readProgressTrack}>
        <View
          style={[
            styles.readProgressFill,
            { width: totalContents > 0 ? `${Math.min(100, (openedIds.size / totalContents) * 100)}%` : '0%' },
          ]}
        />
      </View>

      {/* ── Konten ── */}
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Meta info */}
        <View style={styles.metaRow}>
          <View style={styles.metaBadge}>
            <Ionicons name="bar-chart-outline" size={12} color={COLORS.primary} />
            <Text style={styles.metaBadgeText}>{moduleData.level}</Text>
          </View>
          <View style={styles.metaBadge}>
            <Ionicons name="book-outline" size={12} color={COLORS.primary} />
            <Text style={styles.metaBadgeText}>{t('moduleDetail.materialsCount', { count: moduleData.lessons })}</Text>
          </View>
          {/* Badge GRATIS */}
          <View style={[styles.metaBadge, styles.freeBadge]}>
            <Ionicons name="gift-outline" size={12} color="#16A34A" />
            <Text style={[styles.metaBadgeText, { color: '#16A34A' }]}>{t('home.free')}</Text>
          </View>
        </View>

        {/* Judul */}
        <Text style={styles.moduleTitle}>{moduleData.title}</Text>

        {/* Info Mentor */}
        <TouchableOpacity
          style={styles.authorCard}
          activeOpacity={0.85}
          onPress={() => moduleData.mentorId && router.push(`/mentors/${moduleData.mentorId}` as any)}
        >
          <Image source={{ uri: moduleData.mentor.avatar }} style={styles.authorAvatar} />
          <View style={styles.authorInfo}>
            <Text style={styles.authorLabel}>{t('moduleDetail.byMentor')}</Text>
            <Text style={styles.authorName}>{moduleData.mentor.name}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textLight} />
        </TouchableOpacity>

        {/* Deskripsi Modul */}
        {!!moduleData.description && (
          <Text style={styles.introText}>{moduleData.description}</Text>
        )}

        {/* Daftar Materi (video / artikel / dokumen) */}
        <View style={styles.contentContainer}>
          <Text style={styles.sectionTitle}>{t('moduleDetail.materialListTitle')}</Text>
          <Text style={styles.sectionSubtitle}>
            {t('moduleDetail.materialListSubtitle')}
          </Text>

          <View style={styles.materialsList}>
            {moduleData.contents.length === 0 ? (
              <View style={styles.emptyMaterials}>
                <Ionicons name="folder-open-outline" size={28} color={COLORS.textMuted} />
                <Text style={styles.emptyMaterialsText}>{t('moduleDetail.emptyMaterials')}</Text>
              </View>
            ) : (
              moduleData.contents.map((item: any) => {
                const meta = CONTENT_TYPE_META[item.contentType] || CONTENT_TYPE_META.artikel;
                const opened = openedIds.has(item.id);
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.materialRow}
                    activeOpacity={0.85}
                    onPress={() => handleOpenContent(item)}
                  >
                    <View style={[styles.materialIconWrap, { backgroundColor: meta.bg }]}>
                      <Ionicons name={meta.icon} size={20} color={meta.color} />
                    </View>
                    <View style={styles.materialInfo}>
                      <Text style={styles.materialTitle} numberOfLines={2}>{item.title}</Text>
                      <Text style={styles.materialType}>{t(meta.labelKey)}</Text>
                    </View>
                    {opened ? (
                      <Ionicons name="checkmark-circle" size={22} color="#16A34A" />
                    ) : (
                      <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </View>

          {/* Info kuis terkunci */}
          {!isComplete && totalContents > 0 && (
            <View style={styles.quizLockedInfo}>
              <Ionicons name="information-circle-outline" size={16} color={COLORS.textLight} />
              <Text style={styles.quizLockedText}>
                {t('moduleDetail.quizLockedInfo', { opened: openedIds.size, total: totalContents })}
              </Text>
            </View>
          )}

          {/* Kuis tersedia */}
          {isComplete && quizStatus !== 'done' && (
            <View style={styles.quizUnlockedBanner}>
              <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
              <Text style={styles.quizUnlockedText}>
                {t('moduleDetail.quizUnlockedInfo')}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Sticky Bottom Bar ── */}
      <View style={styles.bottomBar}>
        <View style={styles.bottomProgressRow}>
          <Text style={styles.bottomProgressLabel}>{t('moduleDetail.materialsOpenedLabel')}</Text>
          <Text style={[styles.bottomProgressPct, isComplete && { color: '#16A34A' }]}>
            {openedIds.size}/{totalContents}
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.actionButton,
            { backgroundColor: bottomBtnConfig.bg },
            bottomBtnConfig.disabled && styles.actionButtonDisabled,
          ]}
          activeOpacity={bottomBtnConfig.disabled ? 1 : 0.85}
          onPress={handleQuizOrMentor}
          disabled={bottomBtnConfig.disabled || checkingQuizStatus}
        >
          <Ionicons name={bottomBtnConfig.icon} size={20} color={bottomBtnConfig.color} style={styles.actionIcon} />
          <Text style={[styles.actionText, { color: bottomBtnConfig.color }]}>
            {bottomBtnConfig.label}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  centerBox: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, color: COLORS.textLight },

  /* ── HEADER ── */
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, backgroundColor: BG,
  },
  headerBackBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', paddingRight: 14, paddingLeft: 8, paddingVertical: 8,
    borderRadius: 99, gap: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  headerSubtitle: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerIconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },

  /* ── PROGRESS BAR ── */
  readProgressTrack: {
    height: 3, backgroundColor: '#EDE9FE',
    marginHorizontal: 0,
  },
  readProgressFill: {
    height: 3, backgroundColor: '#7C6FF7', borderRadius: 2,
  },

  /* ── SCROLL ── */
  scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 160 },

  /* ── META INFO ROW ── */
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  metaBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99,
  },
  freeBadge: { backgroundColor: '#DCFCE7' },
  metaBadgeText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },

  /* ── JUDUL ── */
  moduleTitle: {
    fontSize: 26, fontWeight: '800', color: COLORS.primary,
    lineHeight: 34, marginBottom: 16,
  },

  /* ── AUTHOR CARD (tappable → profil mentor) ── */
  authorCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
    gap: 12,
  },
  authorAvatar: { width: 48, height: 48, borderRadius: 24 },
  authorInfo: { flex: 1 },
  authorLabel: { fontSize: 10, fontWeight: '600', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  authorName: { fontSize: 15, fontWeight: '700', color: COLORS.textDark, marginTop: 2 },

  /* ── DESKRIPSI ── */
  introText: { fontSize: 14, color: '#475569', lineHeight: 22, marginBottom: 20 },

  /* ── DAFTAR MATERI ── */
  contentContainer: { gap: 14 },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textDark, marginBottom: 2 },
  sectionSubtitle: { fontSize: 12.5, color: COLORS.textLight, marginBottom: 4, lineHeight: 18 },

  materialsList: { gap: 10, marginBottom: 4 },
  materialRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', padding: 14, borderRadius: 16,
    borderWidth: 1, borderColor: '#F1F5F9', gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  materialIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  materialInfo: { flex: 1 },
  materialTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textDark, lineHeight: 19 },
  materialType: { fontSize: 11, color: COLORS.textLight, marginTop: 2, fontWeight: '600' },

  emptyMaterials: { alignItems: 'center', gap: 8, paddingVertical: 24 },
  emptyMaterialsText: { fontSize: 13, color: COLORS.textLight },

  /* ── INFO KUIS TERKUNCI ── */
  quizLockedInfo: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F8FAFC', borderRadius: 12, padding: 14, marginTop: 8,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  quizLockedText: { flex: 1, fontSize: 12, color: COLORS.textLight, lineHeight: 18 },

  /* ── KUIS TERSEDIA ── */
  quizUnlockedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#F0FDF4', borderRadius: 12, padding: 14, marginTop: 8,
    borderWidth: 1, borderColor: '#BBF7D0',
  },
  quizUnlockedText: { flex: 1, fontSize: 13, color: '#16A34A', fontWeight: '600', lineHeight: 18 },

  /* ── STICKY BOTTOM BAR ── */
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: BG,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32,
    borderTopWidth: 1, borderTopColor: '#EDE9DF',
  },
  bottomProgressRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10,
  },
  bottomProgressLabel: { fontSize: 12, color: COLORS.textLight, fontWeight: '600' },
  bottomProgressPct: { fontSize: 12, fontWeight: '700', color: '#7C6FF7' },
  actionButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, borderRadius: 99, ...PRIMARY_BUTTON_SHADOW,
  },
  actionButtonDisabled: { shadowOpacity: 0, elevation: 0 },
  actionIcon: { marginRight: 10 },
  actionText: { fontSize: 16, fontWeight: '700' },
});