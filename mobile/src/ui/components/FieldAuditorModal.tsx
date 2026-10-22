import React from 'react';
import ReportAnomalyModal from './ReportAnomalyModal';
import { ProjectDetail } from '../../core/types';
import { QueuedAudit } from '../../services/outbox';

export interface FieldAuditorModalProps {
  visible: boolean;
  project: ProjectDetail | null;
  onClose: () => void;
  onAuditSubmitted?: (receipt: QueuedAudit) => void;
}

/**
 * Unified Field Auditor & Anomaly Reporting Modal
 * Field Audit and Report Anomaly are unified into a single geofenced workflow
 * with mandatory photo evidence, GPS lock verification, and offline durability.
 */
export default function FieldAuditorModal({
  visible,
  project,
  onClose,
  onAuditSubmitted,
}: FieldAuditorModalProps) {
  return (
    <ReportAnomalyModal
      visible={visible}
      project={project}
      onClose={onClose}
      onAuditSubmitted={onAuditSubmitted}
    />
  );
}
