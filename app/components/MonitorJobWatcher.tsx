'use client';

import { useEffect, useRef, useState } from 'react';

type MonitorJobStatusValue = 0 | 1 | 2;

type MonitorJobStatus = {
  id: number;
  status: MonitorJobStatusValue;
  started_at: string | null;
  finished_at: string | null;
  updated_at: string;
  last_message: string | null;
};

async function fetchJobStatus(): Promise<MonitorJobStatus | null> {
  const response = await fetch('/api/monitor-job-status', {
    method: 'GET',
    cache: 'no-store'
  });

  const json = (await response.json()) as {
    ok?: boolean;
    data?: MonitorJobStatus;
    error?: string;
  };

  if (!response.ok || !json.ok || !json.data) {
    throw new Error(json.error || 'Errore lettura stato job.');
  }

  return json.data;
}

async function resetJobStatus() {
  const response = await fetch('/api/monitor-job-status', {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      action: 'reset'
    })
  });

  const json = (await response.json()) as {
    ok?: boolean;
    error?: string;
  };

  if (!response.ok || !json.ok) {
    throw new Error(json.error || 'Errore reset stato job.');
  }
}

export default function MonitorJobWatcher() {
  const [status, setStatus] = useState<MonitorJobStatus | null>(null);
  const [message, setMessage] = useState('');
  const isResettingRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    async function checkStatus() {
      if (isResettingRef.current) return;

      try {
        const nextStatus = await fetchJobStatus();

        if (!isMounted || !nextStatus) return;

        setStatus(nextStatus);

        if (nextStatus.status === 0) {
          setMessage('');
          return;
        }

        if (nextStatus.status === 1) {
          setMessage(nextStatus.last_message || 'Controllo prezzi in corso...');
          return;
        }

        if (nextStatus.status === 2) {
          isResettingRef.current = true;
          setMessage(
            nextStatus.last_message ||
              'Controllo prezzi completato. Aggiorno la dashboard...'
          );

          await resetJobStatus();

          window.setTimeout(() => {
            window.location.reload();
          }, 800);
        }
      } catch (error) {
        if (!isMounted) return;

        setMessage(
          error instanceof Error
            ? `Stato controllo prezzi non disponibile: ${error.message}`
            : 'Stato controllo prezzi non disponibile.'
        );
      }
    }

    checkStatus();

    intervalId = setInterval(checkStatus, 2000);

    return () => {
      isMounted = false;

      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []);

  if (!message || !status || status.status === 0) {
    return null;
  }

  const isRunning = status.status === 1;
  const isFinished = status.status === 2;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md rounded-2xl border bg-white p-4 text-sm shadow-xl">
      <div className="font-semibold text-slate-900">
        {isRunning ? 'Controllo prezzi in corso' : null}
        {isFinished ? 'Controllo prezzi completato' : null}
      </div>

      <div className="mt-1 text-slate-600">{message}</div>

      {status.updated_at ? (
        <div className="mt-2 text-xs text-slate-400">
          Ultimo aggiornamento stato: {new Date(status.updated_at).toLocaleString('it-IT')}
        </div>
      ) : null}
    </div>
  );
}