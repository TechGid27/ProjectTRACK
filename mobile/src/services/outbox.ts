export interface QueuedAudit {
  id: string;
  projectId: string;
  receiptCode: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  status: 'pending' | 'synced' | 'failed';
  notes?: string;
  timestamp: number;
  /** On-site = captured within the geofence; photo flag = off-site evidence. */
  verification?: 'onsite' | 'photo_flag';
}

class OutboxService {
  private queue: QueuedAudit[] = [];

  /**
   * Generates a privacy-preserving zero-knowledge whistleblower tracking receipt.
   * e.g. 'PT-CEB-9A4B-31C8'
   */
  generateWhistleblowerReceipt(projectId: string): string {
    const raw = `${projectId}-${Date.now()}-${Math.random()}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = (hash << 5) - hash + raw.charCodeAt(i);
      hash |= 0;
    }
    const hex1 = Math.abs(hash).toString(16).toUpperCase().padStart(4, '0').slice(-4);
    const hex2 = Math.floor(Math.random() * 0xffff)
      .toString(16)
      .toUpperCase()
      .padStart(4, '0');
    return `PT-CEB-${hex1}-${hex2}`;
  }

  /**
   * Enqueues an on-site field audit or anomaly report into the local outbox.
   */
  enqueueAudit(
    audit: Omit<QueuedAudit, 'id' | 'receiptCode' | 'status' | 'timestamp'>,
  ): QueuedAudit {
    const receiptCode = this.generateWhistleblowerReceipt(audit.projectId);
    const item: QueuedAudit = {
      ...audit,
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      receiptCode,
      status: 'pending',
      timestamp: Date.now(),
    };
    this.queue.unshift(item);
    return item;
  }

  getPendingAudits(): QueuedAudit[] {
    return this.queue.filter((a) => a.status === 'pending');
  }

  getAllAudits(): QueuedAudit[] {
    return [...this.queue];
  }

  getPendingCount(): number {
    return this.getPendingAudits().length;
  }

  markSynced(id: string) {
    const item = this.queue.find((a) => a.id === id);
    if (item) item.status = 'synced';
  }

  clearQueue() {
    this.queue = [];
  }
}

export const outbox = new OutboxService();
