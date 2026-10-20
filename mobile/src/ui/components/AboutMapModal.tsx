import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
} from 'react-native';

interface AboutMapModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function AboutMapModal({ visible, onClose }: AboutMapModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.backdrop} testID="about-map-modal">
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.modalCard}>
            {/* Modal Header */}
            <View style={styles.header}>
              <Text style={styles.title}>About the map</Text>
              <TouchableOpacity
                onPress={onClose}
                style={styles.closeBtn}
                accessibilityLabel="Close about map"
                testID="close-about-map-btn"
              >
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.bodyContent}>
              <Text style={styles.leadText}>
                The interactive map shows every DPWH project site in Cebu Province
                loaded from the database. Tap any municipality polygon to zoom in and see
                its projects, budgets, and statuses in the Location Intel panel. Tap a
                diamond pin to open the full project details.
              </Text>

              {/* Legend List */}
              <View style={styles.legendContainer}>
                <View style={styles.legendItem}>
                  <View style={[styles.diamondPin, styles.diamondTeal]} />
                  <Text style={styles.legendText}>
                    <Text style={styles.bold}>Teal diamond</Text> — Ongoing project
                    (shows completion %)
                  </Text>
                </View>

                <View style={styles.legendItem}>
                  <View style={[styles.diamondPin, styles.diamondBlue]} />
                  <Text style={styles.legendText}>
                    <Text style={styles.bold}>Blue diamond</Text> — Completed project
                    (100%)
                  </Text>
                </View>

                <View style={styles.legendItem}>
                  <View style={styles.circleOutline} />
                  <Text style={styles.legendText}>
                    <Text style={styles.bold}>Grey outline</Text> — Municipality
                    boundary (tap to select)
                  </Text>
                </View>
              </View>

              <Text style={styles.footerText}>
                When several projects share the same coordinate, a single pin is
                drawn — tapping it opens the list so you can inspect individual civil
                works.
              </Text>
            </ScrollView>

            <TouchableOpacity
              style={styles.doneButton}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text style={styles.doneButtonText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  safeArea: {
    width: '100%',
    maxWidth: 440,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
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
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '700',
  },
  bodyContent: {
    paddingVertical: 4,
  },
  leadText: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 22,
    marginBottom: 16,
  },
  legendContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 14,
    gap: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  diamondPin: {
    width: 12,
    height: 12,
    transform: [{ rotate: '45deg' }],
  },
  diamondTeal: {
    backgroundColor: '#0d9488',
  },
  diamondBlue: {
    backgroundColor: '#0284c7',
  },
  circleOutline: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#94a3b8',
  },
  legendText: {
    fontSize: 13,
    color: '#475569',
    flex: 1,
    lineHeight: 18,
  },
  bold: {
    fontWeight: '700',
    color: '#0f172a',
  },
  footerText: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 18,
  },
  doneButton: {
    backgroundColor: '#1f3d3c',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  doneButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
