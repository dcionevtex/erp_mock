'use client';

import { cn } from '@/lib/utils';
import type { ErpStatus, StartHandlingStatus } from '@/types';

type Status = ErpStatus | StartHandlingStatus;

const COLOR_MAP: Record<string, string> = {
  RECEIVED:               'bg-slate-100 text-slate-700',
  PROCESSING:             'bg-blue-100 text-blue-700',
  ERP_ACCEPTED:           'bg-yellow-100 text-yellow-700',
  START_HANDLING_SUCCESS: 'bg-green-100 text-green-700',
  START_HANDLING_ERROR:   'bg-red-100 text-red-700',
  ERROR:                  'bg-red-100 text-red-700',
  DUPLICATE_IGNORED:      'bg-gray-100 text-gray-500',
  MANUALLY_RESOLVED:      'bg-purple-100 text-purple-700',
  NOT_STARTED:            'bg-slate-100 text-slate-500',
  SUCCESS:                'bg-green-100 text-green-700',
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
  NOT_STARTED:            'Not Started',
  SUCCESS:                'Success',
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
