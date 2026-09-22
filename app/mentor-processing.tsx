import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/auth';
import { useTranslation } from 'react-i18next';
import { COLORS } from '../constants/brand';

type OverallStatus = 'pending' | 'approved' | 'rejected' | 'none';

type DocRow = { document_type: string; status: string };

function ProcessingIllustration({ status }: { status: OverallStatus }) {
  const iconName = status === 'approved' ? 'checkmark-circle' : status === 'rejected' ? 'close-circle' : 'document-text';
  const iconColor = status === 'approved' ? '#16A34A' : status === 'rejected' ? '#DC2626' : COLORS.primary;
  return (
    <View style={styles.illustrationContainer}>
      <View style={styles.decorCircleLarge} />
      <View style={styles.documentCard}>
        <Ionicons name={iconName as any} size={48} color={iconColor} />
        <View style={styles.phoneMockup}>
          <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />
        </View>
      </View>
      <Ionicons name="sparkles" size={24} color={COLORS.star} style={styles.sparkle1} />
      <Ionicons name="star" size={16} color={COLORS.accent} style={styles.sparkle2} />
    </View>
  );
}

export default function MentorProcessingScreen() {
  const { signOut } = useAuth();
  const { t } = useTranslation();
  const [loading, setLoading] = useState<boolean>(true);
  const [status, setStatus] = useState<OverallStatus>('none');
  const [docs, setDocs] = useState<DocRow[]>([]);

  const loadStatus = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { setLoading(false); return; }

      const { data: mentorProfile, error: mpError } = await supabase
        .from('mentor_profiles')
        .select('id_mentor_profile, is_verified')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (mpError) console.log('Error fetching mentor_profiles:', mpError);

      if (!mentorProfile) {
        setStatus('none');
        return;
      }

      const { data: docRows, error: docError } = await supabase
        .from('mentor_verification_documents')
        .select('document_type, status')
        .eq('id_mentor_profile', mentorProfile.id_mentor_profile);

      if (docError) console.log('Error fetching verification documents:', docError);
      setDocs(docRows || []);

      if (mentorProfile.is_verified) {
        setStatus('approved');
      } else if ((docRows || []).some((d: DocRow) => d.status === 'rejected')) {
        setStatus('rejected');
      } else {
        setStatus('pending');
      }
    } catch (e) {
      console.log('Error loading verification status:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadStatus();
    }, [loadStatus])
  );

  const handleLogout = () => {
    Alert.alert(t('mentorProcessing.logoutConfirmTitle'), t('mentorProcessing.logoutConfirmMsg'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('mentorProcessing.logout'), style: 'destructive', onPress: signOut },
    ]);
  };

  const handleGoToDashboard = () => {
    router.replace('/(mentor-tabs)' as any);
  };

  const handleResubmit = () => {
    router.push('/mentor-registration' as any);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  const copy = {
    pending:  { title: t('mentorProcessing.pendingTitle'),  description: t('mentorProcessing.pendingDesc') },
    approved: { title: t('mentorProcessing.approvedTitle'), description: t('mentorProcessing.approvedDesc') },
    rejected: { title: t('mentorProcessing.rejectedTitle'), description: t('mentorProcessing.rejectedDesc') },
    none:     { title: t('mentorProcessing.noneTitle'),     description: t('mentorProcessing.noneDesc') },
  }[status];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.logoRow}>
          <Image source={require('@/assets/images/logo.png')} style={styles.logoImage} />
          <Text style={styles.logoText}>Edumate</Text>
        </View>

        <ProcessingIllustration status={status} />

        <View style={styles.content}>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.description}>{copy.description}</Text>

          {status === 'pending' && docs.length > 0 && (
            <View style={styles.docsList}>
              {docs.map((d, i) => (
                <View key={i} style={styles.docRow}>
                  <Text style={styles.docType}>{formatDocType(d.document_type, t)}</Text>
                  <View style={styles.docStatusBadge}>
                    <Text style={styles.docStatusText}>{t('mentorProcessing.waitingReview')}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {status === 'rejected' && docs.length > 0 && (
            <View style={styles.docsList}>
              {docs.map((d, i) => (
                <View key={i} style={styles.docRow}>
                  <Text style={styles.docType}>{formatDocType(d.document_type, t)}</Text>
                  <View style={[styles.docStatusBadge, d.status === 'rejected' ? styles.badgeRejected : styles.badgeApproved]}>
                    <Text style={[styles.docStatusText, d.status === 'rejected' ? { color: '#DC2626' } : { color: '#16A34A' }]}>
                      {d.status === 'rejected' ? t('mentorProcessing.docRejected') : t('mentorProcessing.docApproved')}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {status !== 'rejected' && status !== 'none' && (
            <View style={styles.infoBox}>
              <View style={styles.infoIconBox}>
                <Ionicons name={status === 'approved' ? 'sparkles' : 'mail'} size={20} color={COLORS.primary} />
              </View>
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoTitle}>{status === 'approved' ? t('mentorProcessing.infoTitleApproved') : t('mentorProcessing.infoTitlePending')}</Text>
                <Text style={styles.infoDesc}>
                  {status === 'approved'
                    ? t('mentorProcessing.infoDescApproved')
                    : t('mentorProcessing.infoDescPending')}
                </Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {status === 'approved' ? (
          <TouchableOpacity style={styles.resubmitButton} onPress={handleGoToDashboard} activeOpacity={0.85}>
            <Ionicons name="grid" size={18} color={COLORS.white} />
            <Text style={styles.resubmitButtonText}>{t('mentorProcessing.goToDashboard')}</Text>
          </TouchableOpacity>
        ) : status === 'rejected' ? (
          <TouchableOpacity style={styles.resubmitButton} onPress={handleResubmit} activeOpacity={0.85}>
            <Ionicons name="refresh" size={18} color={COLORS.white} />
            <Text style={styles.resubmitButtonText}>{t('mentorProcessing.reuploadDocs')}</Text>
          </TouchableOpacity>
        ) : status === 'none' ? (
          <TouchableOpacity style={styles.resubmitButton} onPress={handleResubmit} activeOpacity={0.85}>
            <Ionicons name="document-text" size={18} color={COLORS.white} />
            <Text style={styles.resubmitButtonText}>{t('mentorProcessing.completRegistration')}</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={styles.backButton} onPress={handleLogout} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={18} color={COLORS.textDark} />
          <Text style={styles.backButtonText}>{t('mentorProcessing.logout')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function formatDocType(type: string, t: (key: string) => string) {
  const map: Record<string, string> = {
    ktp: t('mentorProcessing.docKtp'),
    ijazah: t('mentorProcessing.docIjazah'),
    sertifikat_keahlian: t('mentorProcessing.docSertifikat'),
    portofolio: t('mentorProcessing.docPortofolio'),
  };
  return map[type] || type;
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#EDF3F8',
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 40,
    paddingBottom: 20,
  },

  logoRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  logoImage: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
  },
  logoText: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.primary,
  },

  illustrationContainer: {
    height: 250,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 20,
  },
  decorCircleLarge: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(32, 78, 120, 0.05)',
  },
  documentCard: {
    width: 120,
    height: 140,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(32, 78, 120, 0.05)',
  },
  phoneMockup: {
    position: 'absolute',
    bottom: -10,
    right: -10,
    width: 50,
    height: 80,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    borderWidth: 3,
    borderColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  sparkle1: { position: 'absolute', top: 40, left: 80 },
  sparkle2: { position: 'absolute', bottom: 50, right: 80 },

  content: {
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.textDark,
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 15,
    color: COLORS.textLight,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 10,
  },

  docsList: { width: '100%', gap: 8, marginBottom: 24 },
  docRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  docType: { fontSize: 13, fontWeight: '600', color: COLORS.textDark },
  docStatusBadge: { backgroundColor: '#FFFBEB', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99 },
  badgeApproved: { backgroundColor: '#F0FDF4' },
  badgeRejected: { backgroundColor: '#FEF2F2' },
  docStatusText: { fontSize: 11, fontWeight: '700', color: '#D97706' },

  infoBox: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(32, 78, 120, 0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  infoIconBox: {
    width: 40, height: 40, borderRadius: 8, backgroundColor: '#E0F2FE',
    alignItems: 'center', justifyContent: 'center', marginRight: 16,
  },
  infoTextContainer: { flex: 1 },
  infoTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textDark, marginBottom: 4 },
  infoDesc: { fontSize: 13, color: COLORS.textLight, lineHeight: 20 },

  footer: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 16 : 24,
    paddingTop: 16,
    gap: 10,
  },
  resubmitButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, borderRadius: 16, backgroundColor: COLORS.primary, gap: 8,
  },
  resubmitButtonText: { fontSize: 15, fontWeight: '700', color: COLORS.white },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: '#E2E8F0',
    gap: 8,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textDark,
  },
});