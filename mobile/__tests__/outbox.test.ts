import { outbox, QueuedAudit } from '../src/services/outbox';

describe('OutboxService', () => {
  beforeEach(() => {
    outbox.clearQueue();
  });

  test('generateWhistleblowerReceipt returns format PT-CEB-XXXX-XXXX with uppercase hex', () => {
    const receipt = outbox.generateWhistleblowerReceipt('24HD0012');
    expect(receipt).toMatch(/^PT-CEB-[0-9A-F]{4}-[0-9A-F]{4}$/);
  });

  test('enqueueAudit adds a pending audit item with generated receipt code and timestamp', () => {
    const newAudit = outbox.enqueueAudit({
      projectId: '24HD0012',
      latitude: 11.0505,
      longitude: 124.0055,
      distanceMeters: 45,
      notes: 'Verified on-site within 45m geofence.',
    });

    expect(newAudit.id).toBeDefined();
    expect(newAudit.receiptCode).toMatch(/^PT-CEB-[0-9A-F]{4}-[0-9A-F]{4}$/);
    expect(newAudit.status).toBe('pending');
    expect(newAudit.projectId).toBe('24HD0012');
    expect(newAudit.distanceMeters).toBe(45);
    expect(newAudit.timestamp).toBeGreaterThan(0);

    expect(outbox.getPendingCount()).toBe(1);
    expect(outbox.getPendingAudits().length).toBe(1);
    expect(outbox.getAllAudits()[0].id).toBe(newAudit.id);
  });

  test('markSynced updates audit status from pending to synced', () => {
    const item = outbox.enqueueAudit({
      projectId: '24HD0033',
      latitude: 10.3157,
      longitude: 123.8854,
      distanceMeters: 20,
    });

    expect(outbox.getPendingCount()).toBe(1);

    outbox.markSynced(item.id);

    expect(outbox.getPendingCount()).toBe(0);
    const updated = outbox.getAllAudits().find((a) => a.id === item.id);
    expect(updated?.status).toBe('synced');
  });

  test('clearQueue removes all audits', () => {
    outbox.enqueueAudit({
      projectId: '24HD0012',
      latitude: 11.0505,
      longitude: 124.0055,
      distanceMeters: 50,
    });
    outbox.enqueueAudit({
      projectId: '24HD0045',
      latitude: 11.051,
      longitude: 124.006,
      distanceMeters: 30,
    });

    expect(outbox.getAllAudits().length).toBe(2);

    outbox.clearQueue();

    expect(outbox.getAllAudits().length).toBe(0);
    expect(outbox.getPendingCount()).toBe(0);
  });
});
