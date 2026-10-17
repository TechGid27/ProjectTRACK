import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import FieldAuditorModal from '../src/ui/components/FieldAuditorModal';
import { ProjectDetail } from '../src/core/types';
import { outbox } from '../src/services/outbox';

const mockProject: ProjectDetail = {
  id: '24HD0012',
  title: 'Construction of Flood Mitigation Structure along Bogo River',
  contractor: 'QM BUILDERS',
  budget: 49000000,
  status: 'Ongoing',
  lgu: 'Bogo City',
  barangay: 'Cogon',
  startDate: '2024-02-15',
  targetCompletion: '2024-11-30',
  scope: 'Reinforced concrete revetment wall',
};

describe('FieldAuditorModal Component', () => {
  const mockOnClose = jest.fn();
  const mockOnAuditSubmitted = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    outbox.clearQueue();
  });

  test('does not render when visible is false or project is null', () => {
    const { queryByTestId } = render(
      <FieldAuditorModal
        visible={false}
        project={mockProject}
        onClose={mockOnClose}
      />,
    );

    // Modal with visible=false or null project
    const { queryByTestId: queryNullProj } = render(
      <FieldAuditorModal
        visible={true}
        project={null}
        onClose={mockOnClose}
      />,
    );

    expect(queryNullProj('field-auditor-modal')).toBeNull();
  });

  test('renders project details and geofence radar banner when open', () => {
    const { getByTestId, getByText } = render(
      <FieldAuditorModal
        visible={true}
        project={mockProject}
        onClose={mockOnClose}
        onAuditSubmitted={mockOnAuditSubmitted}
      />,
    );

    expect(getByTestId('field-auditor-modal')).toBeTruthy();
    expect(getByText('24HD0012')).toBeTruthy();
    expect(getByText(/Construction of Flood Mitigation Structure/)).toBeTruthy();
    expect(getByTestId('geofence-radar-badge')).toBeTruthy();
    expect(getByTestId('auditor-shutter-btn')).toBeTruthy();
  });

  test('disables shutter button when simulating off-site location (320m)', () => {
    const { getByText, getByTestId } = render(
      <FieldAuditorModal
        visible={true}
        project={mockProject}
        onClose={mockOnClose}
        onAuditSubmitted={mockOnAuditSubmitted}
      />,
    );

    // Click Off-Site simulation pill
    const offSiteBtn = getByText('Off-Site (320m)');
    fireEvent.press(offSiteBtn);

    // Radar should indicate outside geofence
    expect(getByText(/Outside Geofence/)).toBeTruthy();
    expect(getByText('Geofence Locked — Move Closer')).toBeTruthy();
  });

  test('captures verified audit, enqueues to outbox, and displays receipt badge', () => {
    const { getByTestId, getByText } = render(
      <FieldAuditorModal
        visible={true}
        project={mockProject}
        onClose={mockOnClose}
        onAuditSubmitted={mockOnAuditSubmitted}
      />,
    );

    const shutterBtn = getByTestId('auditor-shutter-btn');
    fireEvent.press(shutterBtn);

    // Verify outbox received the item
    expect(outbox.getPendingCount()).toBe(1);
    expect(mockOnAuditSubmitted).toHaveBeenCalledTimes(1);

    // Verify receipt badge rendered
    expect(getByTestId('receipt-code-badge')).toBeTruthy();
    expect(getByText(/Audit Verified & Queued!/)).toBeTruthy();

    // Verify done button closes
    const doneBtn = getByTestId('done-auditor-btn');
    fireEvent.press(doneBtn);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test('tapping close button triggers onClose', () => {
    const { getByTestId } = render(
      <FieldAuditorModal
        visible={true}
        project={mockProject}
        onClose={mockOnClose}
      />,
    );

    const closeBtn = getByTestId('close-auditor-btn');
    fireEvent.press(closeBtn);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});
