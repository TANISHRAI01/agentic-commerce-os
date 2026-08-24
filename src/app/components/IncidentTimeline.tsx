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
    return { icon: '🔒', dotColor: '#f59e0b', labelClass: 'timeline-label-warn' };
  }
  if (event === 'PAYMENT_TIMEOUT') {
    return { icon: '⏱️', dotColor: '#f59e0b', labelClass: 'timeline-label-warn' };
  }
  if (event === 'PAYMENT_STATUS_POLLED') {
    return { icon: '🔍', dotColor: '#6366f1', labelClass: 'timeline-label-info' };
  }
  if (event === 'PAYMENT_RECONCILED' && result === 'SUCCESS') {
    return { icon: '🔄', dotColor: '#10b981', labelClass: 'timeline-label-success' };
  }
  if (event === 'PAYMENT_RECONCILED' && result === 'FAILURE') {
    return { icon: '🔄', dotColor: '#ef4444', labelClass: 'timeline-label-fail' };
  }
  if (event === 'DUPLICATE_PREVENTED') {
    return { icon: '🚫', dotColor: '#f59e0b', labelClass: 'timeline-label-warn' };
  }
  if (event === 'INTENT_RECEIVED') {
    return { icon: '💬', dotColor: '#6366f1', labelClass: 'timeline-label-info' };
  }
  if (event === 'DISCOVERY_STARTED' || event === 'DISCOVERY_COMPLETE') {
    return { icon: '🔍', dotColor: '#6366f1', labelClass: 'timeline-label-info' };
  }
  if (event === 'DECISION_STARTED' || event === 'DECISION_COMPLETE') {
    return { icon: '🎯', dotColor: '#6366f1', labelClass: 'timeline-label-info' };
  }
  if (event === 'POLICY_CHECK' || event === 'POLICY_EVALUATED') {
    return { icon: '🛡️', dotColor: result === 'SUCCESS' ? '#10b981' : result === 'FAILURE' ? '#ef4444' : '#6366f1', labelClass: result === 'SUCCESS' ? 'timeline-label-success' : result === 'FAILURE' ? 'timeline-label-fail' : 'timeline-label-info' };
  }
  if (event === 'APPROVAL_REQUESTED' || event === 'APPROVAL_GRANTED') {
    return { icon: '📝', dotColor: '#10b981', labelClass: 'timeline-label-success' };
  }
  if (event === 'APPROVAL_REJECTED') {
    return { icon: '📝', dotColor: '#ef4444', labelClass: 'timeline-label-fail' };
  }
  if (event === 'ORDER_CREATED') {
    return { icon: '🧾', dotColor: '#6366f1', labelClass: 'timeline-label-info' };
  }
  if (event === 'PAYMENT_INITIATED') {
    return { icon: '💳', dotColor: '#6366f1', labelClass: 'timeline-label-info' };
  }
  if (event === 'PAYMENT_VERIFIED') {
    return { icon: '✅', dotColor: '#10b981', labelClass: 'timeline-label-success' };
  }
  if (event === 'TRANSACTION_COMPLETE') {
    return { icon: '🎉', dotColor: '#10b981', labelClass: 'timeline-label-success' };
  }
  if (event === 'TRANSACTION_FAILED') {
    return { icon: '❌', dotColor: '#ef4444', labelClass: 'timeline-label-fail' };
  }

  switch (result) {
    case 'SUCCESS':
      return { icon: '✅', dotColor: '#10b981', labelClass: 'timeline-label-success' };
    case 'FAILURE':
      return { icon: '❌', dotColor: '#ef4444', labelClass: 'timeline-label-fail' };
    case 'WARNING':
      return { icon: '⚠️', dotColor: '#f59e0b', labelClass: 'timeline-label-warn' };
    default:
      return { icon: 'ℹ️', dotColor: '#6366f1', labelClass: 'timeline-label-info' };
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
    <div className="incident-timeline">
      {/* Header */}
      <div className="incident-timeline-header">
        <span className="incident-timeline-icon">📋</span>
        <span className="incident-timeline-title">{title}</span>

        {/* Simple / Technical toggle */}
        <div className="audit-view-toggle">
          <button
            className={`audit-toggle-btn ${viewMode === 'simple' ? 'audit-toggle-active' : ''}`}
            onClick={() => setViewMode('simple')}
          >
            Simple
          </button>
          <button
            className={`audit-toggle-btn ${viewMode === 'technical' ? 'audit-toggle-active' : ''}`}
            onClick={() => setViewMode('technical')}
          >
            Technical
          </button>
        </div>

        {transactionState && (
          <span className={`incident-state-badge incident-state-${transactionState.toLowerCase().replace(/_/g, '-')}`}>
            {transactionState.replace(/_/g, ' ')}
          </span>
        )}
      </div>

      {/* Info: what this shows */}
      <div className="audit-disclosure">
        Showing structured application events and policy decisions. No API keys, model prompts, or internal credentials are displayed.
      </div>

      {loading && (
        <div className="incident-timeline-loading">
          <span className="btn-spinner" />
          <span>Loading audit trail…</span>
        </div>
      )}

      {error && (
        <div className="incident-timeline-error">⚠️ {error}</div>
      )}

      {!loading && events.length === 0 && !error && (
        <div className="incident-timeline-empty">No events recorded yet.</div>
      )}

      {events.length > 0 && (
        <ol className="incident-events">
          {events.map((evt, idx) => {
            const { icon, dotColor, labelClass } = getEventStyle(evt.result, evt.event);
            const isLast = idx === events.length - 1;
            const time = new Date(evt.timestamp).toLocaleTimeString([], {
              hour: '2-digit', minute: '2-digit', second: '2-digit',
            });

            return (
              <li key={evt.id} className={`incident-event ${isLast ? 'incident-event-last' : ''}`}>
                <div className="incident-connector">
                  <div
                    className="incident-dot"
                    style={{ backgroundColor: dotColor }}
                  />
                  {!isLast && <div className="incident-line" />}
                </div>

                <div className="incident-content">
                  <div className="incident-meta">
                    <span className={`incident-label ${labelClass}`}>
                      {icon} {viewMode === 'simple'
                        ? evt.event.replace(/_/g, ' ')
                        : evt.event}
                    </span>
                    <span className="incident-time">{time}</span>
                  </div>

                  {viewMode === 'simple' ? (
                    <p className="incident-reason">{getSimpleExplanation(evt)}</p>
                  ) : (
                    <p className="incident-reason incident-reason-technical">
                      {getTechnicalLine(evt)}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {/* Safety notice when in PAYMENT_UNKNOWN state */}
      {transactionState === 'PAYMENT_UNKNOWN' && (
        <div className="incident-safety-notice">
          🔒 <strong>Automatic retry blocked.</strong> Payment status is being verified before any action.
        </div>
      )}
    </div>
  );
}
