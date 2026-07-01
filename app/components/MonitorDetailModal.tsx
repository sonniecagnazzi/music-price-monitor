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

function Box({
  label,
  children,
  wide = false
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={`rounded-2xl bg-[#f2f2f2] p-3 ${wide ? 'md:col-span-3' : ''}`}>
      <div className="text-xs font-black uppercase text-[#2b403e]/50">
        {label}
      </div>
      <div className="mt-1 break-words font-black text-[#12201f]">
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
    <div className="rounded-3xl border border-slate-200 p-4">
      <h4 className={`text-sm font-black uppercase tracking-[0.18em] ${accentClassName}`}>
        {title}
      </h4>

      <div className="mt-3 space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <span className="font-bold text-[#2b403e]/60">€</span>
          <span className="font-black text-[#12201f]">{formatEuro(price)}</span>
        </div>

        <div className="flex justify-between gap-4">
          <span className="font-bold text-[#2b403e]/60">Condition</span>
          <span className="font-black text-[#12201f]">{condition || '—'}</span>
        </div>

        <div className="flex justify-between gap-4">
          <span className="font-bold text-[#2b403e]/60">Target</span>
          <span className="font-black text-[#12201f]">{formatEuro(target)}</span>
        </div>

        <div>
          <div className="font-bold text-[#2b403e]/60">URL</div>
          {url ? (
            <a
              className="mt-1 block break-all text-xs font-bold text-[#168c95] underline"
              href={url}
              target="_blank"
              rel="noreferrer"
            >
              {url}
            </a>
          ) : (
            <div className="mt-1 text-sm font-bold text-slate-400">—</div>
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#12201f]/35 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.22em] text-[#24bfbf]">
              Dettaglio monitor
            </div>
            <h3 className="mt-1 text-xl font-black text-[#12201f]">
              {monitor.artist}
            </h3>
            <p className="text-sm font-semibold text-[#2b403e]/70">
              {monitor.album}
            </p>
          </div>

          <button
            type="button"
            className="rounded-full border border-[#2b403e]/10 px-3 py-1 text-lg font-black text-[#2b403e] hover:bg-[#f2f2f2]"
            onClick={onClose}
            aria-label="Chiudi"
          >
            ×
          </button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <Box label="Tipo">{monitor.type}</Box>
          <Box label="Artista">{monitor.artist}</Box>
          <Box label="Album" wide>
            {monitor.album}
          </Box>
          <Box label="EAN">{monitor.ean_code || '—'}</Box>
          <Box label="Label">{monitor.edition || '—'}</Box>
          <Box label="Anno / Country">
            {monitor.release_year || '—'} / {monitor.country || '—'}
          </Box>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 p-3">
            <div className="text-xs font-black uppercase text-[#2b403e]/50">
              Stato
            </div>
            <div className="mt-2">
              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${getStatusClass(monitor)}`}>
                {getStatusLabel(monitor)}
              </span>
            </div>
          </div>

          <Box label="Best attuale">{formatEuro(getBestPrice(monitor))}</Box>
          <Box label="Lowest storico">{formatEuro(monitor.lowest_best_price)}</Box>
          <Box label="Data lowest">{formatDateTime(monitor.lowest_best_price_at)}</Box>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
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

        <div className="mt-5 rounded-2xl bg-[#f2f2f2] p-4">
          <div className="text-xs font-black uppercase text-[#2b403e]/50">
            Ultimo rilievo
          </div>

          <div className="mt-1 text-sm font-black text-[#12201f]">
            {formatDateTime(monitor.last_checked_at)}
          </div>

          {monitor.last_error && (
            <div className="mt-3 rounded-xl bg-white p-3 text-xs font-semibold text-red-700">
              {monitor.last_error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}