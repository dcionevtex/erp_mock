'use client';

import { cn } from '@/lib/utils';
import type { ErpStatus, StartHandlingStatus, InvoiceStatus } from '@/types';

type Status = ErpStatus | StartHandlingStatus | InvoiceStatus;

const COLOR_MAP: Record<string, string> = {
  RECEIVED:               'bg-muted text-muted-foreground',
  PROCESSING:             'bg-warning-faded text-warning-foreground',
  ERP_ACCEPTED:           'bg-warning-faded text-warning-foreground',
  START_HANDLING_SUCCESS: 'bg-success-faded text-success-foreground',
  START_HANDLING_ERROR:   'bg-danger-faded text-danger-foreground',
  ERROR:                  'bg-danger-faded text-danger-foreground',
  DUPLICATE_IGNORED:      'bg-muted text-muted-foreground',
  MANUALLY_RESOLVED:      'bg-success-faded text-success-foreground',
  CANCELLED:              'bg-warning-faded text-warning-foreground',
  NOT_STARTED:            'bg-muted text-muted-foreground',
  SUCCESS:                'bg-success-faded text-success-foreground',
  INVOICED:               'bg-success-faded text-success-foreground',
  INVOICE_ERROR:          'bg-danger-faded text-danger-foreground',
  NOT_SENT:               'bg-muted text-muted-foreground',
};

const LABEL_MAP: Record<string, string> = {
  RECEIVED:               'Received',
  PROCESSING:             'Processing',
  ERP_ACCEPTED:           'ERP Accepted',
  START_HANDLING_SUCCESS: 'Start Handling OK',
  START_HANDLING_ERROR:   'Start Handling Failed',
  ERROR:                  'Error',
  DUPLICATE_IGNORED:      'Duplicate',
  MANUALLY_RESOLVED:      'Resolved',
  CANCELLED:              'Cancelled',
  NOT_STARTED:            'Not Started',
  SUCCESS:                'Success',
  INVOICED:               'Invoiced',
  INVOICE_ERROR:          'Invoice Error',
  NOT_SENT:               'Not Sent',
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium',
        COLOR_MAP[status] ?? 'bg-muted text-muted-foreground',
      )}
    >
      {LABEL_MAP[status] ?? status}
    </span>
  );
}
