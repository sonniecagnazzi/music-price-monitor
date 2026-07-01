'use client';

import type { ReactNode } from 'react';
import type { Monitor } from '@/lib/types';

type Props = {
  monitor: Monitor | null;
  onClose: () => void;
};

function formatEuro(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }

  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR'
  }).format(Number(value));
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('it-IT', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(date);
}

function getBestPrice(monitor: Monitor): number | null {
  const prices = [
    monitor.medimops_current_price,
    monitor.momox_current_price
  ].filter((value): value is number => typeof value === 'number');

  if (prices.length === 0) return null;

  return Math.min(...prices);
}

function getStatusLabel(monitor: Monitor): string {
  const status = String(monitor.last_status || '');

  if (!monitor.is_active) return 'Pausa';
  if (status === 'below_target') return 'Target';
  if (status === 'not_found') return 'Non trovato';
  if (status === 'error') return 'Errore';
  if (status === 'ok') return 'OK';

  return '—';
}

function getStatusClass(monitor: Monitor): string {
  const status = String(monitor.last_status || '');

  if (!monitor.is_active) return 'bg-slate-100 text-slate-600';
  if (status === 'below_target') return 'bg-emerald-50 text-emerald-700';
  if (status === 'not_found') return 'bg-orange-50 text-orange-700';
  if (status === 'error') return 'bg-red-50 text-red-700';
  if (status === 'ok') return 'bg-cyan-50 text-[#168c95]';

  return 'bg-slate-100 text-slate-600';
}

function MiniBox({
  label,
  children,
  className = ''
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl bg-[#f2f2f2] px-3 py-2 ${className}`}>
      <div className="text-[10px] font-black uppercase tracking-[0.12em] text-[#2b403e]/50">
        {label}
      </div>
      <div className="mt-0.5 truncate text-sm font-black text-[#12201f]">
        {children || '—'}
      </div>
    </div>
  );
}

function MetricBox({
  label,
  children,
  tone = 'default'
}: {
  label: string;
  children: ReactNode;
  tone?: 'default' | 'green';
}) {
  return (
    <div className="rounded-xl border border-slate-200 px-3 py-2">
      <div className="text-[10px] font-black uppercase tracking-[0.12em] text-[#2b403e]/50">
        {label}
      </div>
      <div
        className={`mt-0.5 text-base font-black ${
          tone === 'green' ? 'text-[#1fbf92]' : 'text-[#12201f]'
        }`}
      >
        {children || '—'}
      </div>
    </div>
  );
}

function StoreBox({
  title,
  accentClassName,
  price,
  condition,
  url,
  target
}: {
  title: string;
  accentClassName: string;
  price: number | null | undefined;
  condition: string | null | undefined;
  url: string | null | undefined;
  target: number | null | undefined;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 p-3">
      <div className={`text-xs font-black uppercase tracking-[0.18em] ${accentClassName}`}>
        {title}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <div className="font-bold text-[#2b403e]/55">€</div>
        <div className="text-right font-black text-[#12201f]">{formatEuro(price)}</div>

        <div className="font-bold text-[#2b403e]/55">Condition</div>
        <div className="text-right font-black text-[#12201f]">{condition || '—'}</div>

        <div className="font-bold text-[#2b403e]/55">Target</div>
        <div className="text-right font-black text-[#12201f]">{formatEuro(target)}</div>

        <div className="font-bold text-[#2b403e]/55">URL</div>
        <div className="text-right">
          {url ? (
            <a
              className="font-black text-[#168c95] underline"
              href={url}
              target="_blank"
              rel="noreferrer"
            >
              Apri scheda
            </a>
          ) : (
            <span className="font-black text-slate-400">—</span>
          )}
        </div>
      </div>
    </div>
  );
}

export function MonitorDetailModal({ monitor, onClose }: Props) {
  if (!monitor) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#12201f]/35 p-3"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white p-4 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs font-black uppercase tracking-[0.22em] text-[#24bfbf]">
              Dettaglio monitor
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-black text-[#168c95]">
                {monitor.type}
              </span>
              <h3 className="truncate text-xl font-black text-[#12201f]">
                {monitor.artist}
              </h3>
              <span className="text-sm font-bold text-[#2b403e]/50">—</span>
              <p className="truncate text-base font-bold text-[#2b403e]/70">
                {monitor.album}
              </p>
            </div>
          </div>

          <button
            type="button"
            className="h-10 w-10 shrink-0 rounded-full border border-[#2b403e]/10 text-xl font-black text-[#2b403e] hover:bg-[#f2f2f2]"
            onClick={onClose}
            aria-label="Chiudi"
          >
            ×
          </button>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-6">
          <MiniBox label="EAN">{monitor.ean_code || '—'}</MiniBox>
          <MiniBox label="Label" className="md:col-span-2">
            {monitor.edition || '—'}
          </MiniBox>
          <MiniBox label="Anno">{monitor.release_year || '—'}</MiniBox>
          <MiniBox label="Country">{monitor.country || '—'}</MiniBox>
          <MiniBox label="Attivo">{monitor.is_active ? 'Sì' : 'No'}</MiniBox>
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-4">
          <div className="rounded-xl border border-slate-200 px-3 py-2">
            <div className="text-[10px] font-black uppercase tracking-[0.12em] text-[#2b403e]/50">
              Stato
            </div>
            <div className="mt-1">
              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${getStatusClass(monitor)}`}>
                {getStatusLabel(monitor)}
              </span>
            </div>
          </div>

          <MetricBox label="Best attuale">{formatEuro(getBestPrice(monitor))}</MetricBox>
          <MetricBox label="Lowest storico" tone="green">
            {formatEuro(monitor.lowest_best_price)}
          </MetricBox>
          <MetricBox label="Data lowest">
            {formatDateTime(monitor.lowest_best_price_at)}
          </MetricBox>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <StoreBox
            title="Medimops"
            accentClassName="text-[#24bfbf]"
            price={monitor.medimops_current_price}
            condition={monitor.medimops_condition}
            url={monitor.medimops_url}
            target={monitor.medimops_target_price}
          />

          <StoreBox
            title="Momox"
            accentClassName="text-[#f2a25c]"
            price={monitor.momox_current_price}
            condition={monitor.momox_condition}
            url={monitor.momox_url}
            target={monitor.momox_target_price}
          />
        </div>

        <div className="mt-3 rounded-xl bg-[#f2f2f2] px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.12em] text-[#2b403e]/50">
                Ultimo rilievo
              </div>
              <div className="text-sm font-black text-[#12201f]">
                {formatDateTime(monitor.last_checked_at)}
              </div>
            </div>

            {monitor.last_error && (
              <div className="max-w-2xl rounded-lg bg-white px-3 py-2 text-xs font-semibold text-red-700">
                {monitor.last_error}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
