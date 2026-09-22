import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { COLORS, PRIMARY_BUTTON_SHADOW } from '../constants/brand';

const BG = '#FCF9F1';
const PASSING_SCORE = 70; // samakan dengan app/quiz/[id].tsx & app/modules/[id].tsx

type AttemptItem = {
  id: string;
  quizTitle: string;
  moduleTitle: string;
  score: number;
  expEarned: number;
  completedAt: string;
  aiFeedback: string | null;
  aiSuggestion: string | null;
};

export default function QuizHistoryScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [attempts, setAttempts] = useState<AttemptItem[]>([]);
  const [studentName, setStudentName] = useState('Siswa Edumate');
  const [selectedCert, setSelectedCert] = useState<AttemptItem | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { setLoading(false); return; }

      const { data: profile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', session.user.id)
        .single();
      if (profile?.name) setStudentName(profile.name);

      const { data, error } = await supabase
        .from('quiz_attempts')
        .select(`
          id_attempt, score, exp_earned, completed_at, ai_feedback, ai_suggestion,
          quiz:quizzes(title, module:modules(title))
        `)
        .eq('id_user', session.user.id)
        .order('completed_at', { ascending: false });

      if (error) console.log('Error fetching quiz attempts:', error);

      const mapped: AttemptItem[] = (data || []).map((a: any) => ({
        id: a.id_attempt,
        quizTitle: a.quiz?.title || 'Kuis',
        moduleTitle: a.quiz?.module?.title || 'Modul',
        score: Number(a.score),
        expEarned: a.exp_earned ?? 0,
        completedAt: a.completed_at,
        aiFeedback: a.ai_feedback || null,
        aiSuggestion: a.ai_suggestion || null,
      }));

      setAttempts(mapped);
    } catch (e) {
      console.log('Error loading quiz history:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const formatDate = (iso: string) => {
    const locale = t('common.back') === 'Back' ? 'en-US' : 'id-ID';
    return new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, styles.centerBox]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  const passedCount = attempts.filter((a) => a.score >= PASSING_SCORE).length;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('quizHistory.headerTitle')}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {/* Ringkasan */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{attempts.length}</Text>
            <Text style={styles.summaryLabel}>{t('quizHistory.quizzesTaken')}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: '#16A34A' }]}>{passedCount}</Text>
            <Text style={styles.summaryLabel}>{t('quizHistory.passedCertificates')}</Text>
          </View>
        </View>

        {attempts.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="school-outline" size={32} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>{t('quizHistory.emptyText')}</Text>
            <TouchableOpacity style={styles.emptyCta} onPress={() => router.push('/(tabs)/explore')}>
              <Text style={styles.emptyCtaText}>{t('quizHistory.exploreModules')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {attempts.map((a) => {
              const passed = a.score >= PASSING_SCORE;
              return (
                <View key={a.id} style={styles.card}>
                  <View style={styles.cardTopRow}>
                    <View style={[styles.scoreCircle, { borderColor: passed ? '#16A34A' : '#DC2626' }]}>
                      <Text style={[styles.scoreCircleText, { color: passed ? '#16A34A' : '#DC2626' }]}>
                        {a.score}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.quizTitle} numberOfLines={1}>{a.quizTitle}</Text>
                      <Text style={styles.moduleTitle} numberOfLines={1}>{a.moduleTitle}</Text>
                      <Text style={styles.dateText}>{formatDate(a.completedAt)} · +{a.expEarned} EXP</Text>
                    </View>
                  </View>

                  {passed ? (
                    <TouchableOpacity style={styles.certButton} onPress={() => setSelectedCert(a)}>
                      <MaterialCommunityIcons name="certificate-outline" size={16} color={COLORS.primary} />
                      <Text style={styles.certButtonText}>{t('quizHistory.viewCertificate')}</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.notPassedBadge}>
                      <Text style={styles.notPassedText}>{t('quizHistory.notPassed', { score: PASSING_SCORE })}</Text>
                    </View>
                  )}

                  {!!a.aiFeedback && (
                    <>
                      <TouchableOpacity
                        style={styles.aiToggleButton}
                        onPress={() => setExpandedId(expandedId === a.id ? null : a.id)}
                      >
                        <MaterialCommunityIcons name="robot-outline" size={15} color={COLORS.primary} />
                        <Text style={styles.aiToggleText}>{t('quizHistory.viewAiAnalysis')}</Text>
                        <Ionicons
                          name={expandedId === a.id ? 'chevron-up' : 'chevron-down'}
                          size={15}
                          color={COLORS.primary}
                        />
                      </TouchableOpacity>

                      {expandedId === a.id && (
                        <View style={styles.aiAnalysisBox}>
                          <Text style={styles.aiAnalysisText}>{a.aiFeedback}</Text>
                          {!!a.aiSuggestion && (
                            <View style={styles.aiSuggestionRow}>
                              <Ionicons name="bulb-outline" size={13} color={COLORS.primary} />
                              <Text style={styles.aiSuggestionText}>{a.aiSuggestion}</Text>
                            </View>
                          )}
                        </View>
                      )}
                    </>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* ── Modal Sertifikat ── */}
      <Modal visible={!!selectedCert} transparent animationType="fade" onRequestClose={() => setSelectedCert(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.certificateCard}>
            <MaterialCommunityIcons name="certificate" size={40} color="#D97706" style={{ alignSelf: 'center' }} />
            <Text style={styles.certHeading}>{t('quizHistory.certHeading')}</Text>
            <Text style={styles.certSub}>{t('quizHistory.certDeclare')}</Text>
            <Text style={styles.certName}>{studentName}</Text>
            <Text style={styles.certSub}>{t('quizHistory.certHasPassed')}</Text>
            <Text style={styles.certQuiz}>&quot;{selectedCert?.quizTitle}&quot;</Text>
            <Text style={styles.certModule}>{t('quizHistory.certModule', { title: selectedCert?.moduleTitle })}</Text>

            <View style={styles.certDivider} />

            <View style={styles.certStatsRow}>
              <View>
                <Text style={styles.certStatValue}>{selectedCert?.score}</Text>
                <Text style={styles.certStatLabel}>{t('quizHistory.certScore')}</Text>
              </View>
              <View>
                <Text style={styles.certStatValue}>{selectedCert && formatDate(selectedCert.completedAt)}</Text>
                <Text style={styles.certStatLabel}>{t('quizHistory.certDate')}</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.closeCertButton} onPress={() => setSelectedCert(null)}>
              <Text style={styles.closeCertButtonText}>{t('quizHistory.closeCert')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  centerBox: { justifyContent: 'center', alignItems: 'center' },

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

  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },

  summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  summaryCard: {
    flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, paddingVertical: 16,
    alignItems: 'center', borderWidth: 1, borderColor: '#F1F5F9',
  },
  summaryValue: { fontSize: 24, fontWeight: '900', color: COLORS.textDark },
  summaryLabel: { fontSize: 11, color: COLORS.textLight, marginTop: 4, fontWeight: '600' },

  emptyBox: { alignItems: 'center', gap: 10, paddingVertical: 60 },
  emptyText: { fontSize: 13, color: COLORS.textLight, textAlign: 'center' },
  emptyCta: { backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 99, marginTop: 6 },
  emptyCtaText: { color: COLORS.white, fontWeight: '700', fontSize: 13 },

  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: '#F1F5F9',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  scoreCircle: {
    width: 48, height: 48, borderRadius: 24, borderWidth: 2,
    justifyContent: 'center', alignItems: 'center',
  },
  scoreCircleText: { fontSize: 15, fontWeight: '800' },
  quizTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textDark },
  moduleTitle: { fontSize: 11.5, color: COLORS.textLight, marginTop: 1 },
  dateText: { fontSize: 10.5, color: COLORS.textMuted, marginTop: 3 },

  certButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: COLORS.primaryLight, paddingVertical: 10, borderRadius: 10,
  },
  certButtonText: { color: COLORS.primary, fontSize: 12.5, fontWeight: '700' },

  notPassedBadge: { backgroundColor: '#FEF2F2', paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  notPassedText: { color: '#DC2626', fontSize: 12, fontWeight: '600' },

  aiToggleButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: 8, paddingVertical: 8,
  },
  aiToggleText: { color: COLORS.primary, fontSize: 12, fontWeight: '700' },
  aiAnalysisBox: {
    backgroundColor: COLORS.primaryLight, borderRadius: 10, padding: 12, marginTop: 4,
  },
  aiAnalysisText: { fontSize: 12.5, color: COLORS.textDark, lineHeight: 18 },
  aiSuggestionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 8 },
  aiSuggestionText: { flex: 1, fontSize: 12, color: COLORS.primary, fontWeight: '600', lineHeight: 17 },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center', padding: 28,
  },
  certificateCard: {
    width: '100%', backgroundColor: '#FFFDF7', borderRadius: 20, padding: 24,
    borderWidth: 3, borderColor: '#D97706',
  },
  certHeading: {
    textAlign: 'center', fontSize: 16, fontWeight: '900', color: '#92400E',
    marginTop: 10, letterSpacing: 1,
  },
  certSub: { textAlign: 'center', fontSize: 12, color: COLORS.textLight, marginTop: 10 },
  certName: {
    textAlign: 'center', fontSize: 20, fontWeight: '800', color: COLORS.textDark,
    marginTop: 4, fontStyle: 'italic',
  },
  certQuiz: { textAlign: 'center', fontSize: 14, fontWeight: '700', color: COLORS.primary, marginTop: 4 },
  certModule: { textAlign: 'center', fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  certDivider: { height: 1, backgroundColor: '#FDE68A', marginVertical: 16 },
  certStatsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  certStatValue: { fontSize: 16, fontWeight: '800', color: COLORS.textDark, textAlign: 'center' },
  certStatLabel: { fontSize: 10, color: COLORS.textLight, textAlign: 'center', marginTop: 2 },

  closeCertButton: {
    marginTop: 20, backgroundColor: COLORS.primary, paddingVertical: 12,
    borderRadius: 99, alignItems: 'center', ...PRIMARY_BUTTON_SHADOW,
  },
  closeCertButtonText: { color: COLORS.white, fontWeight: '700', fontSize: 13 },
});