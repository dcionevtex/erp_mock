'use client';

import { cn } from '@/lib/utils';
import type { ErpStatus, StartHandlingStatus, InvoiceStatus } from '@/types';

type Status = ErpStatus | StartHandlingStatus | InvoiceStatus;

const COLOR_MAP: Record<string, string> = {
  RECEIVED:               'bg-slate-100 text-slate-600',
  PROCESSING:             'bg-blue-100 text-blue-700',
  ERP_ACCEPTED:           'bg-amber-100 text-amber-700',
  START_HANDLING_SUCCESS: 'bg-green-500 text-white font-semibold',
  START_HANDLING_ERROR:   'bg-red-500 text-white font-semibold',
  ERROR:                  'bg-red-500 text-white font-semibold',
  DUPLICATE_IGNORED:      'bg-gray-100 text-gray-500',
  MANUALLY_RESOLVED:      'bg-purple-100 text-purple-700',
  CANCELLED:              'bg-orange-100 text-orange-700',
  NOT_STARTED:            'bg-slate-100 text-slate-500',
  SUCCESS:                'bg-green-500 text-white font-semibold',
  INVOICED:               'bg-emerald-500 text-white font-semibold',
  INVOICE_ERROR:          'bg-red-500 text-white font-semibold',
  NOT_SENT:               'bg-slate-100 text-slate-500',
};

const LABEL_MAP: Record<string, string> = {
  RECEIVED:               'Received',
  PROCESSING:             'Processing',
  ERP_ACCEPTED:           'ERP Accepted',
  START_HANDLING_SUCCESS: 'SH Success',
  START_HANDLING_ERROR:   'SH Error',
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
        COLOR_MAP[status] ?? 'bg-gray-100 text-gray-600',
      )}
    >
      {LABEL_MAP[status] ?? status}
    </span>
  );
}
