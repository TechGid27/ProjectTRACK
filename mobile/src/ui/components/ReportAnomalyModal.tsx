import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { ProjectDetail, AnomalyCategory, AnomalyReport } from '../../core/types';

interface ReportAnomalyModalProps {
  visible: boolean;
  project: ProjectDetail | null;
  onClose: () => void;
  onSubmit: (report: AnomalyReport) => void;
}

interface CategoryOption {
  key: AnomalyCategory;
  label: string;
  icon: string;
}

const CATEGORIES: CategoryOption[] = [
  { key: 'ghost_project', label: 'Ghost Project / Abandoned', icon: '👻' },
  { key: 'delay', label: 'Unjustified Delay', icon: '⏳' },
  { key: 'substandard_materials', label: 'Substandard Materials', icon: '🧱' },
  { key: 'other', label: 'Other Concerns', icon: '📝' },
];

export default function ReportAnomalyModal({
  visible,
  project,
  onClose,
  onSubmit,
}: ReportAnomalyModalProps) {
  const [category, setCategory] = useState<AnomalyCategory>('ghost_project');
  const [description, setDescription] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!project) return null;

  const handleSubmit = () => {
    if (description.trim().length < 15) {
      setErrorMessage(
        'Please provide a detailed description (at least 15 characters).',
      );
      return;
    }

    setErrorMessage(null);
    const report: AnomalyReport = {
      id: `rep_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      projectId: project.id,
      category,
      description: description.trim(),
      timestamp: Date.now(),
    };

    onSubmit(report);
    setDescription('');
    setErrorMessage(null);
  };

  const handleCancel = () => {
    setDescription('');
    setErrorMessage(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleCancel}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}
      >
        <View style={styles.backdrop}>
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.modalCard} testID="report-anomaly-modal">
              {/* Header */}
              <View style={styles.header}>
                <View>
                  <Text style={styles.title}>Report Project Anomaly</Text>
                  <Text style={styles.subtitle}>
                    Project ID: <Text style={styles.projectIdHighlight}>{project.id}</Text>
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={handleCancel}
                  style={styles.closeBtn}
                  accessibilityLabel="Close report modal"
                >
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.formBody}
                showsVerticalScrollIndicator={false}
              >
                {/* Issue Category Selection */}
                <Text style={styles.fieldLabel}>CATEGORY OF ANOMALY</Text>
                <View style={styles.categoryGrid}>
                  {CATEGORIES.map((cat) => {
                    const isSelected = category === cat.key;
                    return (
                      <TouchableOpacity
                        key={cat.key}
                        style={[
                          styles.categoryCard,
                          isSelected && styles.categoryCardSelected,
                        ]}
                        onPress={() => setCategory(cat.key)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.categoryIcon}>{cat.icon}</Text>
                        <Text
                          style={[
                            styles.categoryLabel,
                            isSelected && styles.categoryLabelSelected,
                          ]}
                        >
                          {cat.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Description Input */}
                <Text style={styles.fieldLabel}>DETAILS & OBSERVATIONS</Text>
                <TextInput
                  style={styles.textArea}
                  placeholder="Describe observed issues, missing equipment, lack of personnel, or structural defects..."
                  placeholderTextColor="#94a3b8"
                  value={description}
                  onChangeText={(text) => {
                    setDescription(text);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  multiline={true}
                  numberOfLines={4}
                  textAlignVertical="top"
                />

                {errorMessage && (
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{errorMessage}</Text>
                  </View>
                )}

                {/* Anonymous Citizen Protection Notice */}
                <TouchableOpacity
                  style={styles.anonToggle}
                  onPress={() => setIsAnonymous(!isAnonymous)}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.checkbox,
                      isAnonymous && styles.checkboxChecked,
                    ]}
                  >
                    {isAnonymous && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <View style={styles.anonTextContainer}>
                    <Text style={styles.anonTitle}>
                      Submit as Verified Anonymous Citizen
                    </Text>
                    <Text style={styles.anonSubtitle}>
                      Your identity and contact info will never be disclosed to contractors.
                    </Text>
                  </View>
                </TouchableOpacity>
              </ScrollView>

              {/* Actions Footer */}
              <View style={styles.actionsFooter}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={handleCancel}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.submitBtn}
                  onPress={handleSubmit}
                  activeOpacity={0.8}
                >
                  <Text style={styles.submitBtnText}>Submit Report</Text>
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  safeArea: {
    maxHeight: '90%',
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  projectIdHighlight: {
    fontWeight: '700',
    color: '#0d9488',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
  },
  closeBtnText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '700',
  },
  formBody: {
    maxHeight: 400,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  categoryCard: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    gap: 6,
  },
  categoryCardSelected: {
    borderColor: '#0d9488',
    backgroundColor: '#f0fdfa',
  },
  categoryIcon: {
    fontSize: 18,
  },
  categoryLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
    flex: 1,
  },
  categoryLabelSelected: {
    color: '#0f766e',
    fontWeight: '700',
  },
  textArea: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    padding: 12,
    fontSize: 13,
    color: '#1e293b',
    minHeight: 90,
    marginBottom: 8,
  },
  errorContainer: {
    backgroundColor: '#fee2e2',
    padding: 8,
    borderRadius: 8,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 12,
    color: '#b91c1c',
    fontWeight: '600',
  },
  anonToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
    gap: 10,
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#94a3b8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#0d9488',
    borderColor: '#0d9488',
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  anonTextContainer: {
    flex: 1,
  },
  anonTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e293b',
  },
  anonSubtitle: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  actionsFooter: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  submitBtn: {
    flex: 2,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#1f3d3c',
    alignItems: 'center',
  },
  submitBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
});
