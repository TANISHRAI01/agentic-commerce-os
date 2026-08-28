'use client';

import React, { useEffect, useRef, useState } from 'react';

// ── Types ─────────────────────────────────────────────────────

interface AuditEvent {
  id: string;
  timestamp: string;
  transactionId: string;
  event: string;
  result: 'SUCCESS' | 'FAILURE' | 'INFO' | 'WARNING';
  reason: string;
  metadata?: Record<string, unknown>;
}

interface IncidentTimelineProps {
  transactionId: string;
  autoRefresh?: boolean;
  title?: string;
}

// ── Constants ─────────────────────────────────────────────────

const TERMINAL_STATES = new Set([
  'COMPLETED', 'CANCELLED', 'BLOCKED', 'PAYMENT_FAILED',
]);

const POLL_INTERVAL_MS = 2500;

type ViewMode = 'simple' | 'technical';

// ── Event styling ─────────────────────────────────────────────

function getEventStyle(result: string, event: string): {
  icon: string;
  dotColor: string;
  labelClass: string;
} {
  if (event === 'RETRY_BLOCKED') {
    return { icon: 'lock', dotColor: 'bg-warning', labelClass: 'text-warning bg-warning/10 border-warning/20' };
  }
  if (event === 'PAYMENT_TIMEOUT') {
    return { icon: 'timer', dotColor: 'bg-warning', labelClass: 'text-warning bg-warning/10 border-warning/20' };
  }
  if (event === 'PAYMENT_STATUS_POLLED') {
    return { icon: 'search', dotColor: 'bg-primary', labelClass: 'text-primary bg-primary/10 border-primary/20' };
  }
  if (event === 'PAYMENT_RECONCILED' && result === 'SUCCESS') {
    return { icon: 'sync', dotColor: 'bg-[#4ade80]', labelClass: 'text-[#4ade80] bg-[#4ade80]/10 border-[#4ade80]/20' };
  }
  if (event === 'PAYMENT_RECONCILED' && result === 'FAILURE') {
    return { icon: 'sync_problem', dotColor: 'bg-error', labelClass: 'text-error bg-error/10 border-error/20' };
  }
  if (event === 'DUPLICATE_PREVENTED') {
    return { icon: 'block', dotColor: 'bg-warning', labelClass: 'text-warning bg-warning/10 border-warning/20' };
  }
  if (event === 'INTENT_RECEIVED') {
    return { icon: 'chat', dotColor: 'bg-primary', labelClass: 'text-primary bg-primary/10 border-primary/20' };
  }
  if (event === 'DISCOVERY_STARTED' || event === 'DISCOVERY_COMPLETE') {
    return { icon: 'manage_search', dotColor: 'bg-primary', labelClass: 'text-primary bg-primary/10 border-primary/20' };
  }
  if (event === 'DECISION_STARTED' || event === 'DECISION_COMPLETE') {
    return { icon: 'psychology', dotColor: 'bg-primary', labelClass: 'text-primary bg-primary/10 border-primary/20' };
  }
  if (event === 'POLICY_CHECK' || event === 'POLICY_EVALUATED') {
    return { icon: 'shield', dotColor: result === 'SUCCESS' ? 'bg-[#4ade80]' : result === 'FAILURE' ? 'bg-error' : 'bg-primary', labelClass: result === 'SUCCESS' ? 'text-[#4ade80] bg-[#4ade80]/10 border-[#4ade80]/20' : result === 'FAILURE' ? 'text-error bg-error/10 border-error/20' : 'text-primary bg-primary/10 border-primary/20' };
  }
  if (event === 'APPROVAL_REQUESTED' || event === 'APPROVAL_GRANTED') {
    return { icon: 'how_to_reg', dotColor: 'bg-[#4ade80]', labelClass: 'text-[#4ade80] bg-[#4ade80]/10 border-[#4ade80]/20' };
  }
  if (event === 'APPROVAL_REJECTED') {
    return { icon: 'person_off', dotColor: 'bg-error', labelClass: 'text-error bg-error/10 border-error/20' };
  }
  if (event === 'ORDER_CREATED') {
    return { icon: 'receipt_long', dotColor: 'bg-primary', labelClass: 'text-primary bg-primary/10 border-primary/20' };
  }
  if (event === 'PAYMENT_INITIATED') {
    return { icon: 'payment', dotColor: 'bg-primary', labelClass: 'text-primary bg-primary/10 border-primary/20' };
  }
  if (event === 'PAYMENT_VERIFIED') {
    return { icon: 'verified', dotColor: 'bg-[#4ade80]', labelClass: 'text-[#4ade80] bg-[#4ade80]/10 border-[#4ade80]/20' };
  }
  if (event === 'TRANSACTION_COMPLETE') {
    return { icon: 'celebration', dotColor: 'bg-[#4ade80]', labelClass: 'text-[#4ade80] bg-[#4ade80]/10 border-[#4ade80]/20' };
  }
  if (event === 'TRANSACTION_FAILED') {
    return { icon: 'cancel', dotColor: 'bg-error', labelClass: 'text-error bg-error/10 border-error/20' };
  }

  switch (result) {
    case 'SUCCESS':
      return { icon: 'check_circle', dotColor: 'bg-[#4ade80]', labelClass: 'text-[#4ade80] bg-[#4ade80]/10 border-[#4ade80]/20' };
    case 'FAILURE':
      return { icon: 'cancel', dotColor: 'bg-error', labelClass: 'text-error bg-error/10 border-error/20' };
    case 'WARNING':
      return { icon: 'warning', dotColor: 'bg-warning', labelClass: 'text-warning bg-warning/10 border-warning/20' };
    default:
      return { icon: 'info', dotColor: 'bg-primary', labelClass: 'text-primary bg-primary/10 border-primary/20' };
  }
}

// ── Simple explanation generator ──────────────────────────────

function getSimpleExplanation(evt: AuditEvent): string {
  // Return the reason — it's already human-readable from the backend
  return evt.reason;
}

function getTechnicalLine(evt: AuditEvent): string {
  const metaKeys = evt.metadata
    ? Object.entries(evt.metadata)
        .filter(([k]) => !['policyResult', 'searchParams', 'intent'].includes(k))
        .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`)
        .join(' ')
    : '';
  return `[${evt.id.slice(0, 8)}] ${evt.event} — ${evt.result}${metaKeys ? ` — ${metaKeys}` : ''}`;
}

// ── Component ─────────────────────────────────────────────────

export default function IncidentTimeline({
  transactionId,
  autoRefresh = true,
  title = 'Audit Trail',
}: IncidentTimelineProps) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [transactionState, setTransactionState] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('simple');
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchAudit = async () => {
    try {
      const res = await fetch(`/api/payment/audit?transactionId=${transactionId}`);
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to fetch audit trail');
        return;
      }
      const data = await res.json();
      setEvents(data.events ?? []);
      setTransactionState(data.transactionState ?? '');
      setError(null);
    } catch {
      setError('Network error fetching audit trail');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAudit();

    if (!autoRefresh) return;

    const schedule = () => {
      pollRef.current = setTimeout(async () => {
        await fetchAudit();
        if (!TERMINAL_STATES.has(transactionState)) {
          schedule();
        }
      }, POLL_INTERVAL_MS);
    };

    schedule();
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactionId, autoRefresh]);

  useEffect(() => {
    if (TERMINAL_STATES.has(transactionState) && pollRef.current) {
      clearTimeout(pollRef.current);
    }
  }, [transactionState]);

  return (
    <div className="glass-panel p-6 rounded-xl border border-outline-variant/20 mt-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-outline-variant/10">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[20px]">history</span>
          <span className="font-headline-sm text-on-surface text-base">{title}</span>
        </div>

        <div className="flex items-center gap-4">
          {/* Simple / Technical toggle */}
          <div className="flex items-center bg-surface-container-lowest rounded-full p-1 border border-outline-variant/10">
            <button
              className={`px-3 py-1 text-xs font-label-micro uppercase tracking-widest rounded-full transition-colors ${viewMode === 'simple' ? 'bg-surface-variant text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
              onClick={() => setViewMode('simple')}
            >
              Simple
            </button>
            <button
              className={`px-3 py-1 text-xs font-label-micro uppercase tracking-widest rounded-full transition-colors ${viewMode === 'technical' ? 'bg-surface-variant text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
              onClick={() => setViewMode('technical')}
            >
              Technical
            </button>
          </div>

          {transactionState && (
            <span className={`px-2 py-1 rounded text-[10px] uppercase font-tabular-data border bg-surface-variant/30 ${TERMINAL_STATES.has(transactionState) ? (transactionState.includes('FAIL') || transactionState.includes('BLOCK') || transactionState.includes('CANCEL') ? 'text-error border-error/30' : 'text-[#4ade80] border-[#4ade80]/30') : 'text-primary border-primary/30'}`}>
              {transactionState.replace(/_/g, ' ')}
            </span>
          )}
        </div>
      </div>

      {/* Info: what this shows */}
      <div className="font-body-main text-xs text-on-surface-variant mb-6 flex items-start gap-2 bg-surface-container-lowest/30 p-3 rounded border border-outline-variant/10">
        <span className="material-symbols-outlined text-[16px] mt-0.5">info</span>
        <span>Showing structured application events and policy decisions. No API keys, model prompts, or internal credentials are displayed.</span>
      </div>

      {loading && (
        <div className="flex items-center gap-3 p-4 text-on-surface-variant justify-center">
          <span className="btn-spinner border-primary" />
          <span className="font-body-main text-sm">Loading audit trail…</span>
        </div>
      )}

      {error && (
        <div className="p-3 mb-4 rounded bg-error/10 text-error border border-error/20 text-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error</span> {error}
        </div>
      )}

      {!loading && events.length === 0 && !error && (
        <div className="text-center p-8 text-on-surface-variant font-body-main text-sm">No events recorded yet.</div>
      )}

      {events.length > 0 && (
        <ol className="relative border-l border-outline-variant/20 ml-3 space-y-6">
          {events.map((evt, idx) => {
            const { icon, dotColor, labelClass } = getEventStyle(evt.result, evt.event);
            const isLast = idx === events.length - 1;
            const time = new Date(evt.timestamp).toLocaleTimeString([], {
              hour: '2-digit', minute: '2-digit', second: '2-digit',
            });

            return (
              <li key={evt.id} className="pl-6 relative group">
                <span className={`absolute -left-[5px] top-1 w-[9px] h-[9px] rounded-full border-2 border-surface shadow-sm ${dotColor}`}></span>

                <div className="flex flex-col md:flex-row md:items-start justify-between gap-2 mb-1">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] uppercase font-label-micro tracking-widest border ${labelClass}`}>
                    <span className="material-symbols-outlined text-[14px]">{icon}</span>
                    {viewMode === 'simple'
                      ? evt.event.replace(/_/g, ' ')
                      : evt.event}
                  </span>
                  <span className="font-tabular-data text-xs text-on-surface-variant/60">{time}</span>
                </div>

                <div className={`mt-2 font-body-main text-sm ${viewMode === 'technical' ? 'font-tabular-data text-xs text-on-surface-variant bg-surface-container-lowest/50 p-2 rounded overflow-x-auto whitespace-pre-wrap' : 'text-on-surface-variant'}`}>
                  {viewMode === 'simple' ? getSimpleExplanation(evt) : getTechnicalLine(evt)}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {/* Safety notice when in PAYMENT_UNKNOWN state */}
      {transactionState === 'PAYMENT_UNKNOWN' && (
        <div className="mt-6 p-4 rounded-lg bg-warning/10 border border-warning/30 text-warning flex items-start gap-3">
          <span className="material-symbols-outlined text-[20px]">lock</span>
          <div className="font-body-main text-sm">
            <strong>Automatic retry blocked.</strong> Payment status is being verified before any action.
          </div>
        </div>
      )}
    </div>
  );
}
