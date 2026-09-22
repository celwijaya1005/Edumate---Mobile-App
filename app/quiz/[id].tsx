import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { COLORS, PRIMARY_BUTTON_SHADOW } from '../../constants/brand';

const BG = '#FCF9F1';

// CATATAN: tabel `quizzes` belum punya kolom passing_score, jadi nilai ini
// hardcode sementara (samakan dengan app/modules/[id].tsx).
const PASSING_SCORE = 70;

// ── Konfigurasi level kepahaman (feedback lokal, bukan dari AI beneran) ──
const AI_LEVEL_CONFIG = [
  {
    minScore: 85,
    labelKey: 'quizScreen.levelMasterLabel',
    emoji: '🏆',
    color: '#16A34A',
    bg: '#F0FDF4',
    border: '#BBF7D0',
    descriptionKey: 'quizScreen.levelMasterDesc',
    suggestionKey: 'quizScreen.levelMasterSuggestion',
  },
  {
    minScore: 70,
    labelKey: 'quizScreen.levelDevelopingLabel',
    emoji: '📈',
    color: '#D97706',
    bg: '#FFFBEB',
    border: '#FDE68A',
    descriptionKey: 'quizScreen.levelDevelopingDesc',
    suggestionKey: 'quizScreen.levelDevelopingSuggestion',
  },
  {
    minScore: 0,
    labelKey: 'quizScreen.levelBeginnerLabel',
    emoji: '🌱',
    color: '#DC2626',
    bg: '#FEF2F2',
    border: '#FECACA',
    descriptionKey: 'quizScreen.levelBeginnerDesc',
    suggestionKey: 'quizScreen.levelBeginnerSuggestion',
  },
];

function getAILevel(score: number) {
  return AI_LEVEL_CONFIG.find((c) => score >= c.minScore) || AI_LEVEL_CONFIG[2];
}

const OPTION_KEYS = ['a', 'b', 'c', 'd'] as const;

type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
};

export default function QuizScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { id, moduleId, mentorId } = useLocalSearchParams<{ id: string; moduleId: string; mentorId: string }>();

  const [loading, setLoading] = useState(true);
  const [quizTitle, setQuizTitle] = useState(t('quizScreen.defaultTitle'));
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [startedAt] = useState(() => new Date().toISOString());

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [finished, setFinished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);

  const total = questions.length;
  const question = questions[currentIndex];

  // Fetch kuis + daftar soal dari Supabase
  useEffect(() => {
    async function loadQuiz() {
      if (!id) { setLoading(false); return; }
      try {
        const { data: quizRow, error: quizError } = await supabase
          .from('quizzes')
          .select('id_quiz, title')
          .eq('id_quiz', id)
          .single();

        if (quizError) console.log('Error fetching quiz:', quizError);
        if (quizRow?.title) setQuizTitle(quizRow.title);

        const { data: questionRows, error: questionsError } = await supabase
          .from('quiz_questions')
          .select('id_question, question_text, option_a, option_b, option_c, option_d, correct_option, order_index')
          .eq('quiz_id', id)
          .order('order_index', { ascending: true });

        if (questionsError) console.log('Error fetching quiz questions:', questionsError);

        const mapped: QuizQuestion[] = (questionRows || []).map((q: any) => ({
          id: q.id_question,
          question: q.question_text,
          options: [q.option_a, q.option_b, q.option_c, q.option_d],
          correctIndex: OPTION_KEYS.indexOf(String(q.correct_option).toLowerCase().trim() as any),
        }));

        setQuestions(mapped);
      } catch (e) {
        console.log('Error loading quiz:', e);
      } finally {
        setLoading(false);
      }
    }
    loadQuiz();
  }, [id]);

  const handleNext = () => {
    if (selected === null) return;
    const updatedAnswers = [...answers, selected];
    setAnswers(updatedAnswers);
    setSelected(null);
    if (currentIndex + 1 < total) {
      setCurrentIndex(currentIndex + 1);
    } else {
      submitAttempt(updatedAnswers);
    }
  };

  const submitAttempt = async (finalAnswers: number[]) => {
    setSaving(true);
    try {
      const correctCount = finalAnswers.filter((ans, i) => ans === questions[i]?.correctIndex).length;
      const score = total > 0 ? Math.round((correctCount / total) * 100) : 0;
      const level = getAILevel(score);

      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user && id) {
        const { data: inserted, error: insertError } = await supabase
          .from('quiz_attempts')
          .insert({
            id_quiz: id,
            id_user: session.user.id,
            score,
            ai_feedback: t(level.descriptionKey),
            exp_earned: correctCount * 10,
            answers: finalAnswers.map((selectedIndex, i) => ({
              question_id: questions[i]?.id,
              selected_option: OPTION_KEYS[selectedIndex] || null,
            })),
            started_at: startedAt,
            completed_at: new Date().toISOString(),
          })
          .select('id_attempt')
          .single();

        if (insertError) console.log('Error saving quiz attempt:', insertError);

        // Minta analisis AI beneran (Gemini) di background, bukan cuma template.
        // Kalau gagal/timeout, layar hasil tetap pakai teks rule-based di atas
        // (aiAnalysis/aiSuggestion dibiarkan null, fallback ke t(level.descriptionKey)).
        if (!insertError && inserted?.id_attempt) {
          setAiAnalyzing(true);
          supabase.functions
            .invoke('analyze-quiz', {
              body: { attemptId: inserted.id_attempt, language: i18n.language },
            })
            .then(async ({ data, error }) => {
              if (error) {
                let detail: any = null;
                try {
                  detail = await error.context?.json?.();
                } catch {
                  // response body bukan JSON atau nggak bisa dibaca, biarin null
                }
                console.log('Error calling analyze-quiz:', error.message, 'detail:', detail);
                return;
              }
              if (data?.analysis) setAiAnalysis(data.analysis);
              if (data?.suggestion) setAiSuggestion(data.suggestion);
            })
            .catch((e) => console.log('Unexpected error calling analyze-quiz:', e))
            .finally(() => setAiAnalyzing(false));
        }
      }
    } catch (e) {
      console.log('Error submitting quiz attempt:', e);
    } finally {
      setSaving(false);
      setFinished(true);
    }
  };

  const handleBackToModule = () => {
    if (moduleId) {
      router.replace(`/modules/${moduleId}` as any);
    } else {
      router.back();
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, styles.centerBox]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>{t('quizScreen.loading')}</Text>
      </SafeAreaView>
    );
  }

  if (!loading && total === 0) {
    return (
      <SafeAreaView style={[styles.safe, styles.centerBox]}>
        <Ionicons name="help-circle-outline" size={48} color={COLORS.textMuted} />
        <Text style={styles.loadingText}>{t('quizScreen.notAvailable')}</Text>
        <TouchableOpacity style={[styles.primaryButton, { marginTop: 20, paddingHorizontal: 24 }]} onPress={handleBackToModule}>
          <Text style={styles.primaryButtonText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ── Halaman Hasil ────────────────────────────────────────────────────────
  if (finished) {
    const correctCount = answers.filter((ans, i) => ans === questions[i]?.correctIndex).length;
    const score = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    const passed = score >= PASSING_SCORE;
    const level = getAILevel(score);

    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBackToModule} style={styles.closeBtn}>
            <Ionicons name="close" size={20} color={COLORS.textDark} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('quizScreen.resultHeaderTitle')}</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.resultContainer} showsVerticalScrollIndicator={false}>
          <View style={[styles.resultIconWrap, { backgroundColor: level.bg }]}>
            <Text style={styles.resultEmoji}>{level.emoji}</Text>
          </View>

          <Text style={styles.resultTitle}>
            {passed ? t('quizScreen.passedTitle') : t('quizScreen.failedTitle')}
          </Text>
          <Text style={styles.resultSubtitle}>
            {t('quizScreen.correctAnswers', { correct: correctCount, total })}
          </Text>

          <View style={[styles.scoreCard, { borderColor: level.border }]}>
            <Text style={[styles.scoreValue, { color: level.color }]}>{score}</Text>
            <Text style={styles.scoreLabel}>{t('quizScreen.yourScore')}</Text>
            <View style={styles.scoreProgressTrack}>
              <View style={[styles.scoreProgressFill, { width: `${score}%`, backgroundColor: level.color }]} />
            </View>
            <Text style={styles.scorePassLabel}>{t('quizScreen.passingScoreLabel', { score: PASSING_SCORE })}</Text>
          </View>

          <View style={[styles.levelBadge, { backgroundColor: level.bg, borderColor: level.border }]}>
            <Text style={[styles.levelTitle, { color: level.color }]}>
              {t('quizScreen.comprehensionLevel', { level: t(level.labelKey) })}
            </Text>
          </View>

          <View style={styles.feedbackCard}>
            <View style={styles.feedbackHeader}>
              <View style={styles.feedbackAiIcon}>
                <MaterialCommunityIcons name="robot-outline" size={18} color={COLORS.primary} />
              </View>
              <Text style={styles.feedbackLabel}>{t('quizScreen.aiAnalysisLabel')}</Text>
            </View>
            <Text style={styles.feedbackText}>{aiAnalysis || t(level.descriptionKey)}</Text>
            <View style={styles.feedbackSuggestion}>
              <Ionicons name="bulb-outline" size={14} color={COLORS.primary} />
              <Text style={styles.feedbackSuggestionText}>{aiSuggestion || t(level.suggestionKey)}</Text>
            </View>
            {aiAnalyzing && (
              <View style={styles.feedbackAnalyzingRow}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={styles.feedbackAnalyzingText}>{t('quizScreen.aiAnalyzing')}</Text>
              </View>
            )}
          </View>

          {!passed ? (
            <>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => {
                  setCurrentIndex(0);
                  setAnswers([]);
                  setSelected(null);
                  setFinished(false);
                }}
              >
                <Ionicons name="refresh-outline" size={18} color="#FFFFFF" style={styles.btnIcon} />
                <Text style={styles.primaryButtonText}>{t('quizScreen.retryQuiz')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.hireMentorButton}
                onPress={() => router.push(`/mentors/${mentorId}` as any)}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={18} color={COLORS.primary} style={styles.btnIcon} />
                <Text style={styles.hireMentorText}>{t('quizScreen.hireMentorForGuidance')}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={styles.hireMentorButton}
                onPress={() => router.push(`/mentors/${mentorId}` as any)}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={18} color={COLORS.primary} style={styles.btnIcon} />
                <Text style={styles.hireMentorText}>{t('quizScreen.hireThisMentor')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={handleBackToModule}>
                <Text style={styles.secondaryButtonText}>{t('quizScreen.backToModule')}</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Halaman Soal ─────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackToModule} style={styles.closeBtn}>
          <Ionicons name="close" size={20} color={COLORS.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{quizTitle}</Text>
        <View style={styles.questionCount}>
          <Text style={styles.questionCountText}>{currentIndex + 1}/{total}</Text>
        </View>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${((currentIndex + 1) / total) * 100}%` }]} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.questionLabel}>{t('quizScreen.questionLabel', { number: currentIndex + 1 })}</Text>
        <Text style={styles.questionText}>{question?.question}</Text>

        <View style={styles.optionsList}>
          {question?.options.map((option, index) => {
            const isSelected = selected === index;
            const letter = String.fromCharCode(65 + index);
            return (
              <TouchableOpacity
                key={index}
                style={[styles.optionCard, isSelected && styles.optionCardActive]}
                activeOpacity={0.8}
                onPress={() => setSelected(index)}
              >
                <View style={[styles.optionLetter, isSelected && styles.optionLetterActive]}>
                  <Text style={[styles.optionLetterText, isSelected && styles.optionLetterTextActive]}>
                    {letter}
                  </Text>
                </View>
                <Text style={[styles.optionText, isSelected && styles.optionTextActive]}>
                  {option}
                </Text>
                {isSelected && (
                  <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.primaryButton, (selected === null || saving) && styles.primaryButtonDisabled]}
          disabled={selected === null || saving}
          onPress={handleNext}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.primaryButtonText}>
                {currentIndex + 1 === total ? t('quizScreen.seeResult') : t('quizScreen.next')}
              </Text>
              <Ionicons
                name={currentIndex + 1 === total ? 'checkmark-circle-outline' : 'arrow-forward'}
                size={18}
                color="#FFFFFF"
                style={styles.btnIconRight}
              />
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  centerBox: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  loadingText: { marginTop: 12, fontSize: 14, color: COLORS.textLight, textAlign: 'center' },

  /* ── HEADER ── */
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 14,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  headerTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textDark },
  questionCount: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99,
  },
  questionCountText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },

  /* ── PROGRESS ── */
  progressTrack: {
    height: 5, backgroundColor: '#E2E8F0',
    marginHorizontal: 20, borderRadius: 3, marginBottom: 24, overflow: 'hidden',
  },
  progressFill: { height: 5, backgroundColor: COLORS.primary, borderRadius: 3 },

  /* ── SOAL ── */
  body: { paddingHorizontal: 20, paddingBottom: 20 },
  questionLabel: {
    fontSize: 11, fontWeight: '700', color: COLORS.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8,
  },
  questionText: {
    fontSize: 20, fontWeight: '800', color: COLORS.textDark,
    lineHeight: 28, marginBottom: 28,
  },

  optionsList: { gap: 12 },
  optionCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
    borderWidth: 2, borderColor: '#E2E8F0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  optionCardActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  optionLetter: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  optionLetterActive: { backgroundColor: COLORS.primary },
  optionLetterText: { fontSize: 13, fontWeight: '700', color: COLORS.textDark },
  optionLetterTextActive: { color: '#FFFFFF' },
  optionText: { flex: 1, fontSize: 14, color: COLORS.textDark, lineHeight: 20 },
  optionTextActive: { fontWeight: '600', color: COLORS.primary },

  /* ── FOOTER ── */
  footer: { padding: 20, borderTopWidth: 1, borderTopColor: '#EDE9DF' },

  /* ── TOMBOL ── */
  primaryButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.primary, paddingVertical: 16,
    borderRadius: 99, ...PRIMARY_BUTTON_SHADOW,
  },
  primaryButtonDisabled: { backgroundColor: '#CBD5E0', shadowOpacity: 0, elevation: 0 },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  btnIcon: { marginRight: 8 },
  btnIconRight: { marginLeft: 8 },

  hireMentorButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFFFFF', paddingVertical: 16,
    borderRadius: 99, marginTop: 12,
    borderWidth: 2, borderColor: COLORS.primary,
  },
  hireMentorText: { color: COLORS.primary, fontWeight: '700', fontSize: 15 },

  secondaryButton: { paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  secondaryButtonText: { color: COLORS.textLight, fontWeight: '600', fontSize: 14 },

  /* ── HASIL ── */
  resultContainer: {
    flexGrow: 1, paddingHorizontal: 24, paddingTop: 32, paddingBottom: 40,
    alignItems: 'center',
  },
  resultIconWrap: {
    width: 100, height: 100, borderRadius: 50,
    justifyContent: 'center', alignItems: 'center', marginBottom: 20,
  },
  resultEmoji: { fontSize: 48 },
  resultTitle: { fontSize: 22, fontWeight: '800', color: COLORS.textDark, textAlign: 'center' },
  resultSubtitle: {
    fontSize: 13, color: COLORS.textLight, textAlign: 'center', marginTop: 6, marginBottom: 24,
  },

  scoreCard: {
    width: '100%', backgroundColor: '#FFFFFF',
    borderRadius: 20, paddingVertical: 24, paddingHorizontal: 20,
    alignItems: 'center', borderWidth: 2, marginBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  scoreValue: { fontSize: 52, fontWeight: '900' },
  scoreLabel: { fontSize: 13, color: COLORS.textLight, marginTop: 2, marginBottom: 16 },
  scoreProgressTrack: {
    width: '100%', height: 8, backgroundColor: '#F1F5F9',
    borderRadius: 4, overflow: 'hidden', marginBottom: 8,
  },
  scoreProgressFill: { height: 8, borderRadius: 4 },
  scorePassLabel: { fontSize: 12, color: COLORS.textMuted },

  levelBadge: {
    width: '100%', borderRadius: 12, padding: 14,
    borderWidth: 1, alignItems: 'center', marginBottom: 16,
  },
  levelTitle: { fontSize: 14, fontWeight: '800' },

  feedbackCard: {
    width: '100%', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18,
    borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 8, elevation: 1,
  },
  feedbackHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  feedbackAiIcon: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center', alignItems: 'center',
  },
  feedbackLabel: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  feedbackText: { fontSize: 13, color: COLORS.textDark, lineHeight: 20, marginBottom: 12 },
  feedbackSuggestion: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: COLORS.primaryLight, borderRadius: 10, padding: 10,
  },
  feedbackSuggestionText: { flex: 1, fontSize: 12, color: COLORS.primary, fontWeight: '600', lineHeight: 18 },
  feedbackAnalyzingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  feedbackAnalyzingText: { fontSize: 11.5, color: COLORS.textLight, fontStyle: 'italic' },
});