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
  /** Poll until the transaction reaches a terminal state. Default: true */
  autoRefresh?: boolean;
  /** Override label for the component heading */
  title?: string;
}

// ── Constants ─────────────────────────────────────────────────

const TERMINAL_STATES = new Set([
  'COMPLETED', 'CANCELLED', 'BLOCKED', 'PAYMENT_FAILED',
]);

const POLL_INTERVAL_MS = 2500;

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

// ── Component ─────────────────────────────────────────────────

export default function IncidentTimeline({
  transactionId,
  autoRefresh = true,
  title = 'Incident Timeline',
}: IncidentTimelineProps) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [transactionState, setTransactionState] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
          schedule(); // re-schedule only if not terminal
        }
      }, POLL_INTERVAL_MS);
    };

    schedule();
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactionId, autoRefresh]);

  // Stop polling when terminal
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
        {transactionState && (
          <span className={`incident-state-badge incident-state-${transactionState.toLowerCase().replace(/_/g, '-')}`}>
            {transactionState.replace(/_/g, ' ')}
          </span>
        )}
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
                {/* Connector line */}
                <div className="incident-connector">
                  <div
                    className="incident-dot"
                    style={{ backgroundColor: dotColor }}
                  />
                  {!isLast && <div className="incident-line" />}
                </div>

                {/* Content */}
                <div className="incident-content">
                  <div className="incident-meta">
                    <span className={`incident-label ${labelClass}`}>
                      {icon} {evt.event.replace(/_/g, ' ')}
                    </span>
                    <span className="incident-time">{time}</span>
                  </div>
                  <p className="incident-reason">{evt.reason}</p>
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
