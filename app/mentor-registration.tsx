import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { COLORS, PRIMARY_BUTTON_SHADOW } from '../constants/brand';

const BUCKET = 'mentor-documents';

type DocType = 'ktp' | 'ijazah' | 'sertifikat_keahlian' | 'portofolio';

type PickedFile = {
  uri: string;
  name: string;
  mimeType: string;
};

const DOCUMENT_FIELD_DEFS: {
  type: DocType;
  labelKey: string;
  hintKey: string;
  required: boolean;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { type: 'ktp',                  labelKey: 'mentorRegistration.doc1Label', hintKey: 'mentorRegistration.doc1Hint', required: true,  icon: 'image-outline' },
  { type: 'ijazah',               labelKey: 'mentorRegistration.doc2Label', hintKey: 'mentorRegistration.doc2Hint', required: true,  icon: 'document-text-outline' },
  { type: 'sertifikat_keahlian', labelKey: 'mentorRegistration.doc3Label', hintKey: 'mentorRegistration.doc3Hint', required: false, icon: 'ribbon-outline' },
  { type: 'portofolio',           labelKey: 'mentorRegistration.doc4Label', hintKey: 'mentorRegistration.doc4Hint', required: false, icon: 'briefcase-outline' },
];

const uploadOneFile = async (userId: string, type: DocType, file: PickedFile) => {
  const ext = file.name.includes('.') ? file.name.split('.').pop() : 'dat';
  const path = `${userId}/${type}_${Date.now()}.${ext}`;

  const response = await fetch(file.uri);
  const blob = await response.blob();

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: file.mimeType, upsert: false });

  if (uploadError) throw uploadError;
  return path;
};

export default function MentorRegistrationScreen() {
  const { t } = useTranslation();
  const [bio, setBio] = useState('');
  const [files, setFiles] = useState<Partial<Record<DocType, PickedFile>>>({});
  const [submitting, setSubmitting] = useState(false);

  const DOCUMENT_FIELDS = DOCUMENT_FIELD_DEFS.map((d) => ({
    ...d,
    label: t(d.labelKey),
    hint: t(d.hintKey),
  }));

  const handlePickFile = async (type: DocType) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      if (asset.size && asset.size > 5 * 1024 * 1024) {
        Alert.alert(t('mentorRegistration.fileTooLargeTitle'), t('mentorRegistration.fileTooLargeMsg'));
        return;
      }

      setFiles((prev) => ({
        ...prev,
        [type]: {
          uri: asset.uri,
          name: asset.name || `${type}.jpg`,
          mimeType: asset.mimeType || 'application/octet-stream',
        },
      }));
    } catch (e) {
      console.log('Error picking document:', e);
      Alert.alert(t('mentorRegistration.filePickFailTitle'), t('mentorRegistration.filePickFailMsg'));
    }
  };

  const handleKirimData = async () => {
    const missingRequired = DOCUMENT_FIELDS.filter((f) => f.required && !files[f.type]);
    if (missingRequired.length > 0) {
      Alert.alert(t('mentorRegistration.docIncompleteTitle'), t('mentorRegistration.docIncompleteMsg', { docs: missingRequired.map((f) => f.label).join(', ') }));
      return;
    }

    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        Alert.alert(t('mentorRegistration.notLoggedInTitle'), t('mentorRegistration.notLoggedInMsg'));
        return;
      }
      const userId = session.user.id;

      // 1. Pastikan row mentor_profiles ada buat user ini (insert kalau belum ada)
      const { data: existingProfile, error: fetchProfileError } = await supabase
        .from('mentor_profiles')
        .select('id_mentor_profile')
        .eq('user_id', userId)
        .maybeSingle();

      if (fetchProfileError) console.log('Error checking mentor_profiles:', fetchProfileError);

      let mentorProfileId = existingProfile?.id_mentor_profile;

      if (!mentorProfileId) {
        const { data: newProfile, error: insertProfileError } = await supabase
          .from('mentor_profiles')
          .insert({ user_id: userId, curriculum_vitae: bio, is_verified: false })
          .select('id_mentor_profile')
          .single();

        if (insertProfileError || !newProfile) {
          console.log('Error creating mentor_profiles:', insertProfileError);
          Alert.alert(t('mentorRegistration.submitFailedTitle'), t('mentorRegistration.submitFailedMsg'));
          return;
        }
        mentorProfileId = newProfile.id_mentor_profile;
      } else if (bio) {
        await supabase.from('mentor_profiles').update({ curriculum_vitae: bio }).eq('id_mentor_profile', mentorProfileId);
      }

      // 2. Upload tiap file yang diisi, lalu insert record dokumennya
      const entries = Object.entries(files) as [DocType, PickedFile][];
      for (const [type, file] of entries) {
        const path = await uploadOneFile(userId, type, file);

        const { error: docError } = await supabase.from('mentor_verification_documents').insert({
          id_mentor_profile: mentorProfileId,
          document_type: type,
          file_url: path,
          status: 'pending',
          uploaded_at: new Date().toISOString(),
        });

        if (docError) console.log(`Error saving document record (${type}):`, docError);
      }

      router.push('/mentor-processing');
    } catch (e) {
      console.log('Error submitting mentor registration:', e);
      Alert.alert(t('mentorRegistration.submitFailedTitle'), t('mentorRegistration.submitFailedMsg'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={COLORS.textDark} />
            </TouchableOpacity>
            <View style={styles.logoRow}>
              <Image source={require('@/assets/images/logo.png')} style={styles.logoImage} />
              <Text style={styles.logoText}>Edumate</Text>
            </View>
            <TouchableOpacity onPress={() => router.replace('/mentor-processing')} style={styles.skipButton}>
              <Text style={styles.skipButtonText}>{t('mentorRegistration.skip')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <Text style={styles.title}>{t('mentorRegistration.title')}</Text>
            <Text style={styles.subtitle}>{t('mentorRegistration.subtitle')}</Text>

            <View style={styles.limitedAccessNote}>
              <Ionicons name="information-circle-outline" size={16} color="#D97706" />
              <Text style={styles.limitedAccessText}>{t('mentorRegistration.limitedAccessNote')}</Text>
            </View>

            {DOCUMENT_FIELDS.map((field) => {
              const picked = files[field.type];
              return (
                <View key={field.type} style={styles.fieldContainer}>
                  <Text style={styles.fieldLabel}>{field.label}</Text>
                  <TouchableOpacity
                    style={[styles.uploadBox, picked && styles.uploadBoxFilled]}
                    activeOpacity={0.7}
                    onPress={() => handlePickFile(field.type)}
                  >
                    <View style={[styles.iconCircle, picked && { backgroundColor: '#DCFCE7' }]}>
                      <Ionicons
                        name={picked ? 'checkmark-circle' : field.icon}
                        size={24}
                        color={picked ? '#16A34A' : COLORS.primary}
                      />
                    </View>
                    <Text style={styles.uploadTextTitle} numberOfLines={1}>
                      {picked ? picked.name : t('mentorRegistration.uploadBoxEmpty')}
                    </Text>
                    <Text style={styles.uploadTextDesc}>
                      {picked ? t('mentorRegistration.uploadBoxFilled') : field.hint}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}

            {/* Field: Bio / CV Singkat */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>{t('mentorRegistration.bioLabel')}</Text>
              <View style={styles.textAreaContainer}>
                <TextInput
                  style={styles.textArea}
                  placeholder={t('mentorRegistration.bioPlaceholder')}
                  placeholderTextColor={COLORS.textMuted}
                  multiline
                  numberOfLines={4}
                  value={bio}
                  onChangeText={setBio}
                  textAlignVertical="top"
                />
              </View>
            </View>

            {/* Tombol Kirim */}
            <TouchableOpacity
              style={[styles.primaryButton, submitting && { opacity: 0.7 }]}
              activeOpacity={0.85}
              onPress={handleKirimData}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <>
                  <Text style={styles.primaryButtonText}>{t('mentorRegistration.submitButton')}</Text>
                  <Ionicons name="arrow-forward" size={18} color={COLORS.white} style={{ marginLeft: 8 }} />
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  scrollContent: {
    flexGrow: 1,
    backgroundColor: COLORS.white,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 99,
    backgroundColor: '#F1F5F9',
  },
  skipButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  logoRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
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
  limitedAccessNote: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 12,
    marginBottom: 24,
  },
  limitedAccessText: {
    flex: 1,
    fontSize: 12,
    color: '#92400E',
    lineHeight: 18,
  },
  content: {
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.textDark,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textLight,
    lineHeight: 22,
    marginBottom: 32,
  },
  fieldContainer: {
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textDark,
    marginBottom: 12,
  },
  uploadBox: {
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadBoxFilled: {
    borderColor: '#16A34A',
    borderStyle: 'solid',
    backgroundColor: '#F0FDF4',
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  uploadTextTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textDark,
    marginBottom: 4,
    maxWidth: '90%',
  },
  uploadTextDesc: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  textAreaContainer: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 16,
    backgroundColor: COLORS.background,
    padding: 4,
  },
  textArea: {
    minHeight: 120,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 15,
    color: COLORS.textDark,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 17,
    borderRadius: 16,
    marginTop: 16,
    ...PRIMARY_BUTTON_SHADOW,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});