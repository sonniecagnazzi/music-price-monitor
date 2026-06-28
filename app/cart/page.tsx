'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  clearCartItems,
  getCartItems,
  removeCartItem,
  toggleCartItemIgnored,
  type CartItem
} from '@/lib/cart';
import { formatEuro } from '@/lib/format';
import type { Monitor } from '@/lib/types';

type DiscountMode = 'percent' | 'euro';
type StoreKey = 'medimops' | 'momox';

type StoreConfig = {
  key: StoreKey;
  label: string;
};

type CalculatedRow = {
  item: CartItem;
  store: StoreKey;
  storeLabel: string;
  artist: string;
  album: string;
  eanCode: string | null;
  edition: string | null;
  basePrice: number | null;
  discountAmount: number;
  discountedPrice: number | null;
  shippingShare: number;
  finalPrice: number | null;
  isIgnored: boolean;
};

type CartSummary = {
  store: StoreKey;
  storeLabel: string;
  rows: CalculatedRow[];
  activeRows: CalculatedRow[];
  activeItemCount: number;
  activePriceItemCount: number;
  shippingCost: number;
  shippingShare: number;
  euroDiscountShare: number;
  totalBase: number;
  totalDiscount: number;
  totalDiscounted: number;
  totalFinal: number;
  ignoredCount: number;
  missingPriceCount: number;
};

const STORES: StoreConfig[] = [
  {
    key: 'medimops',
    label: 'Medimops'
  },
  {
    key: 'momox',
    label: 'Momox'
  }
];

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function parseItalianNumber(value: string): number {
  const cleaned = value
    .trim()
    .replace(/\s/g, '')
    .replace('€', '')
    .replace(/\./g, '')
    .replace(',', '.');

  if (!cleaned) return 0;

  const parsed = Number(cleaned);

  if (!Number.isFinite(parsed)) return 0;
  if (parsed < 0) return 0;

  return parsed;
}

function getShippingCost(activeItemCount: number): number {
  if (activeItemCount <= 0) return 0;
  if (activeItemCount === 1) return 2.49;
  if (activeItemCount === 2) return 4.98;
  if (activeItemCount === 3) return 7.47;

  return 7.99;
}

function calculatePercentDiscount(
  price: number,
  discountPercent: number
): {
  discountAmount: number;
  discountedPrice: number;
} {
  if (discountPercent <= 0) {
    return {
      discountAmount: 0,
      discountedPrice: price
    };
  }

  const discountAmount = roundMoney(price * (discountPercent / 100));
  const discountedPrice = Math.max(0, roundMoney(price - discountAmount));

  return {
    discountAmount,
    discountedPrice
  };
}

function formatCsvMoney(value: number | null): string {
  if (value === null) return '';

  return value.toFixed(2).replace('.', ',');
}

function escapeCsvValue(value: string | number | null | undefined): string {
  const text = String(value ?? '');
  const escaped = text.replace(/"/g, '""');

  return `"${escaped}"`;
}

function buildCsv(rows: CalculatedRow[], storeLabel: string): string {
  const headers = [
    'Carrello',
    'Stato',
    'Artista',
    'Titolo',
    'EAN',
    'Label',
    `Prezzo ${storeLabel}`,
    'Sconto riga',
    'Prezzo scontato',
    'Quota spedizione',
    'Prezzo finale articolo'
  ];

  const csvRows = rows.map((row) => {
    return [
      storeLabel,
      row.isIgnored ? 'Ignorato' : 'Attivo',
      row.artist,
      row.album,
      row.eanCode || '',
      row.edition || '',
      formatCsvMoney(row.basePrice),
      row.isIgnored ? '' : formatCsvMoney(row.discountAmount),
      row.discountedPrice === null ? '' : formatCsvMoney(row.discountedPrice),
      row.isIgnored ? '' : formatCsvMoney(row.shippingShare),
      row.isIgnored || row.finalPrice === null
        ? ''
        : formatCsvMoney(row.finalPrice)
    ];
  });

  return [headers, ...csvRows]
    .map((row) => row.map(escapeCsvValue).join(';'))
    .join('\n');
}

function exportCsvForExcel(rows: CalculatedRow[], storeLabel: string) {
  const csv = buildCsv(rows, storeLabel);

  const blob = new Blob([`\uFEFF${csv}`], {
    type: 'text/csv;charset=utf-8;'
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  const today = new Date().toISOString().slice(0, 10);
  const storeSlug = storeLabel.toLowerCase();

  link.href = url;
  link.download = `carrello-${storeSlug}-${today}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

function getMonitorFromMap(
  item: CartItem,
  monitorsById: Map<string, Monitor>
): Monitor | null {
  return monitorsById.get(item.id) || null;
}

function getArtist(item: CartItem, monitor: Monitor | null): string {
  return monitor?.artist || item.artist;
}

function getAlbum(item: CartItem, monitor: Monitor | null): string {
  return monitor?.album || item.album;
}

function getEanCode(item: CartItem, monitor: Monitor | null): string | null {
  return monitor?.ean_code || item.ean_code || null;
}

function getEdition(item: CartItem, monitor: Monitor | null): string | null {
  return monitor?.edition || item.edition || null;
}

function getStorePrice(
  item: CartItem,
  monitor: Monitor | null,
  store: StoreKey
): number | null {
  if (store === 'medimops') {
    return monitor?.medimops_current_price ?? item.medimops_current_price ?? null;
  }

  return monitor?.momox_current_price ?? null;
}

function calculateCartSummary({
  items,
  monitorsById,
  store,
  storeLabel,
  discountMode,
  discountNumber
}: {
  items: CartItem[];
  monitorsById: Map<string, Monitor>;
  store: StoreKey;
  storeLabel: string;
  discountMode: DiscountMode;
  discountNumber: number;
}): CartSummary {
  const activeItems = items.filter((item) => !item.is_ignored);

  const activeItemsWithPrice = activeItems.filter((item) => {
    const monitor = getMonitorFromMap(item, monitorsById);
    return getStorePrice(item, monitor, store) !== null;
  });

  const activeItemCount = activeItems.length;
  const activePriceItemCount = activeItemsWithPrice.length;

  const shippingCost = getShippingCost(activeItemCount);
  const shippingShare =
    activeItemCount === 0 ? 0 : roundMoney(shippingCost / activeItemCount);

  const euroDiscountShare =
    discountMode === 'euro' && activePriceItemCount > 0
      ? roundMoney(discountNumber / activePriceItemCount)
      : 0;

  const rows = items.map((item) => {
    const monitor = getMonitorFromMap(item, monitorsById);
    const isIgnored = Boolean(item.is_ignored);
    const basePrice = getStorePrice(item, monitor, store);

    const baseRow = {
      item,
      store,
      storeLabel,
      artist: getArtist(item, monitor),
      album: getAlbum(item, monitor),
      eanCode: getEanCode(item, monitor),
      edition: getEdition(item, monitor),
      basePrice,
      isIgnored
    };

    if (isIgnored) {
      return {
        ...baseRow,
        discountAmount: 0,
        discountedPrice: basePrice,
        shippingShare: 0,
        finalPrice: basePrice
      };
    }

    if (basePrice === null) {
      return {
        ...baseRow,
        discountAmount: 0,
        discountedPrice: null,
        shippingShare,
        finalPrice: null
      };
    }

    if (discountMode === 'percent') {
      const discount = calculatePercentDiscount(basePrice, discountNumber);

      return {
        ...baseRow,
        discountAmount: discount.discountAmount,
        discountedPrice: discount.discountedPrice,
        shippingShare,
        finalPrice: roundMoney(discount.discountedPrice + shippingShare)
      };
    }

    const discountAmount = Math.min(basePrice, euroDiscountShare);
    const discountedPrice = Math.max(0, roundMoney(basePrice - discountAmount));

    return {
      ...baseRow,
      discountAmount,
      discountedPrice,
      shippingShare,
      finalPrice: roundMoney(discountedPrice + shippingShare)
    };
  });

  const activeRows = rows.filter((row) => !row.isIgnored);

  const totalBase = activeRows.reduce(
    (total, row) => total + (row.basePrice ?? 0),
    0
  );

  const totalDiscounted = activeRows.reduce(
    (total, row) => total + (row.discountedPrice ?? 0),
    0
  );

  const totalFinal = activeRows.reduce(
    (total, row) => total + (row.finalPrice ?? 0),
    0
  );

  const totalDiscount = activeRows.reduce(
    (total, row) => total + row.discountAmount,
    0
  );

  const ignoredCount = rows.filter((row) => row.isIgnored).length;

  const missingPriceCount = activeRows.filter(
    (row) => row.basePrice === null
  ).length;

  return {
    store,
    storeLabel,
    rows,
    activeRows,
    activeItemCount,
    activePriceItemCount,
    shippingCost,
    shippingShare,
    euroDiscountShare,
    totalBase,
    totalDiscount,
    totalDiscounted,
    totalFinal,
    ignoredCount,
    missingPriceCount
  };
}

function SummaryCards({
  summary,
  discountMode
}: {
  summary: CartSummary;
  discountMode: DiscountMode;
}) {
  return (
    <div className="mt-4 grid gap-3 md:grid-cols-5">
      <div className="rounded-xl border p-3">
        <div className="text-xs font-semibold uppercase text-slate-500">
          Totale prezzi iniziali
        </div>
        <div className="mt-1 text-lg font-bold">
          {formatEuro(summary.totalBase)}
        </div>
      </div>

      <div className="rounded-xl border p-3">
        <div className="text-xs font-semibold uppercase text-slate-500">
          Sconto totale applicato
        </div>
        <div className="mt-1 text-lg font-bold">
          {formatEuro(summary.totalDiscount)}
        </div>
        {discountMode === 'euro' && summary.activePriceItemCount > 0 && (
          <div className="mt-1 text-xs text-slate-500">
            {formatEuro(summary.euroDiscountShare)} per articolo con prezzo
          </div>
        )}
      </div>

      <div className="rounded-xl border p-3">
        <div className="text-xs font-semibold uppercase text-slate-500">
          Totale scontato
        </div>
        <div className="mt-1 text-lg font-bold">
          {formatEuro(summary.totalDiscounted)}
        </div>
      </div>

      <div className="rounded-xl border p-3">
        <div className="text-xs font-semibold uppercase text-slate-500">
          Articoli attivi
        </div>
        <div className="mt-1 text-lg font-bold">{summary.activeItemCount}</div>
      </div>

      <div className="rounded-xl border p-3">
        <div className="text-xs font-semibold uppercase text-slate-500">
          Articoli ignorati
        </div>
        <div className="mt-1 text-lg font-bold">{summary.ignoredCount}</div>
      </div>
    </div>
  );
}

function CartTable({
  summary,
  onToggleIgnored,
  onRemove
}: {
  summary: CartSummary;
  onToggleIgnored: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold">Articoli {summary.storeLabel}</h2>

        <div className="text-sm text-slate-500">
          Totale {summary.storeLabel}: {' '}
          <span className="font-bold text-green-800">
            {formatEuro(summary.totalFinal)}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-100 text-left">
              <th className="border-b p-2">Azioni</th>
              <th className="border-b p-2">Stato</th>
              <th className="border-b p-2">Artista</th>
              <th className="border-b p-2">Titolo</th>
              <th className="border-b p-2">EAN</th>
              <th className="border-b p-2">Label</th>
              <th className="border-b p-2">Prezzo {summary.storeLabel}</th>
              <th className="border-b p-2">Sconto riga</th>
              <th className="border-b p-2">Prezzo scontato</th>
              <th className="border-b p-2">Quota spedizione</th>
              <th className="border-b p-2">Prezzo finale articolo</th>
            </tr>
          </thead>

          <tbody>
            {summary.rows.map((row) => (
              <tr
                key={`${row.store}-${row.item.id}`}
                className={`border-b align-top ${
                  row.isIgnored ? 'bg-slate-100 text-slate-400' : ''
                }`}
              >
                <td className="p-2">
                  <div className="flex flex-wrap gap-2">
                    <button
                      className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${
                        row.isIgnored
                          ? 'border-green-300 text-green-700 hover:bg-green-50'
                          : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                      }`}
                      onClick={() => onToggleIgnored(row.item.id)}
                    >
                      {row.isIgnored ? 'Riattiva' : 'Ignora'}
                    </button>

                    <button
                      className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50"
                      onClick={() => onRemove(row.item.id)}
                    >
                      Elimina
                    </button>
                  </div>
                </td>

                <td className="p-2">
                  {row.isIgnored ? (
                    <span className="rounded-full bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-600">
                      Ignorato
                    </span>
                  ) : (
                    <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">
                      Attivo
                    </span>
                  )}
                </td>

                <td className="p-2 font-medium">{row.artist}</td>
                <td className="p-2">{row.album}</td>
                <td className="p-2">{row.eanCode || '-'}</td>
                <td className="p-2">{row.edition || '-'}</td>

                <td className="p-2 font-semibold">
                  {formatEuro(row.basePrice)}
                </td>

                <td className="p-2">
                  {row.isIgnored ? '-' : formatEuro(row.discountAmount)}
                </td>

                <td className="p-2 font-semibold text-blue-800">
                  {row.discountedPrice === null
                    ? '-'
                    : formatEuro(row.discountedPrice)}
                </td>

                <td className="p-2 text-slate-600">
                  {row.isIgnored ? '-' : formatEuro(row.shippingShare)}
                </td>

                <td className="p-2 font-bold text-green-800">
                  {row.finalPrice === null
                    ? '-'
                    : row.isIgnored
                      ? '-'
                      : formatEuro(row.finalPrice)}
                </td>
              </tr>
            ))}

            {summary.rows.length === 0 && (
              <tr>
                <td className="p-4 text-center text-slate-500" colSpan={11}>
                  Il carrello è vuoto. Torna alla dashboard e aggiungi qualche
                  disco.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function CartPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [activeStore, setActiveStore] = useState<StoreKey>('medimops');
  const [discountMode, setDiscountMode] = useState<DiscountMode>('percent');
  const [discountValue, setDiscountValue] = useState('');
  const [message, setMessage] = useState('Caricamento carrello...');

  useEffect(() => {
    setItems(getCartItems({ includeIgnored: true }));

    async function loadMonitors() {
      try {
        const response = await fetch('/api/monitors');
        const json = (await response.json()) as {
          data?: Monitor[];
          error?: string;
        };

        if (!response.ok) {
          throw new Error(json.error || 'Errore caricamento monitor.');
        }

        setMonitors(json.data || []);
        setMessage('Pronto.');
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : 'Errore caricamento prezzi carrello.'
        );
      }
    }

    loadMonitors();
  }, []);

  const discountNumber = parseItalianNumber(discountValue);

  const monitorsById = useMemo(() => {
    return new Map(monitors.map((monitor) => [monitor.id, monitor]));
  }, [monitors]);

  const summaries = useMemo(() => {
    return STORES.map((store) =>
      calculateCartSummary({
        items,
        monitorsById,
        store: store.key,
        storeLabel: store.label,
        discountMode,
        discountNumber
      })
    );
  }, [items, monitorsById, discountMode, discountNumber]);

  const activeSummary =
    summaries.find((summary) => summary.store === activeStore) || summaries[0];

  const medimopsSummary = summaries.find(
    (summary) => summary.store === 'medimops'
  );
  const momoxSummary = summaries.find((summary) => summary.store === 'momox');

  function handleRemove(id: string) {
    setItems(removeCartItem(id));
  }

  function handleToggleIgnored(id: string) {
    setItems(toggleCartItemIgnored(id));
  }

  function handleClearCart() {
    const confirmed = window.confirm('Vuoi svuotare tutto il carrello?');

    if (!confirmed) return;

    setItems(clearCartItems());
  }

  function handleExportExcel() {
    if (!activeSummary || activeSummary.rows.length === 0) {
      window.alert('Il carrello è vuoto: non c’è nulla da esportare.');
      return;
    }

    exportCsvForExcel(activeSummary.rows, activeSummary.storeLabel);
  }

  return (
    <main className="mx-auto max-w-7xl p-4 sm:p-6">
      <div className="mb-4 rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Carrello comparativo</h1>
            <p className="mt-2 text-slate-600">
              Simulazione separata per Medimops e Momox. Lo sconto e le righe
              ignorate sono condivisi tra i due carrelli.
            </p>
            <p className="mt-2 rounded-lg bg-slate-100 p-2 text-sm text-slate-600">
              Stato: {message}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/"
              className="rounded-lg border px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
            >
              Torna alla dashboard
            </Link>

            <button
              className="rounded-lg border border-green-700 px-4 py-2 font-semibold text-green-700 hover:bg-green-50 disabled:opacity-50"
              disabled={!activeSummary || activeSummary.rows.length === 0}
              onClick={handleExportExcel}
            >
              Esporta Excel {activeSummary?.storeLabel || ''}
            </button>

            <button
              className="rounded-lg border border-red-300 px-4 py-2 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
              disabled={items.length === 0}
              onClick={handleClearCart}
            >
              Svuota carrello
            </button>
          </div>
        </div>
      </div>

      <section className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-4">
          <label className="text-sm font-medium">
            Tipo sconto
            <select
              className="mt-1 w-full rounded-lg border p-2"
              value={discountMode}
              onChange={(event) =>
                setDiscountMode(event.target.value as DiscountMode)
              }
            >
              <option value="percent">Percentuale %</option>
              <option value="euro">Euro € totale carrello</option>
            </select>
          </label>

          <label className="text-sm font-medium">
            Sconto
            <input
              className="mt-1 w-full rounded-lg border p-2"
              placeholder={discountMode === 'percent' ? 'es. 15' : 'es. 10'}
              value={discountValue}
              onChange={(event) => setDiscountValue(event.target.value)}
            />
            <span className="mt-1 block text-xs text-slate-500">
              {discountMode === 'percent'
                ? 'Lo sconto percentuale viene applicato a ogni riga di entrambi i carrelli.'
                : 'Lo sconto in euro viene diviso sugli articoli attivi con prezzo, separatamente per Medimops e Momox.'}
            </span>
          </label>

          <div className="rounded-xl bg-blue-50 p-3">
            <div className="text-xs font-semibold uppercase text-blue-700">
              Totale Medimops
            </div>
            <div className="mt-1 text-xl font-bold text-blue-950">
              {formatEuro(medimopsSummary?.totalFinal || 0)}
            </div>
            <div className="mt-1 text-xs text-blue-800">
              Spedizione: {formatEuro(medimopsSummary?.shippingCost || 0)}
            </div>
          </div>

          <div className="rounded-xl bg-green-50 p-3">
            <div className="text-xs font-semibold uppercase text-green-700">
              Totale Momox
            </div>
            <div className="mt-1 text-xl font-bold text-green-950">
              {formatEuro(momoxSummary?.totalFinal || 0)}
            </div>
            <div className="mt-1 text-xs text-green-800">
              Spedizione: {formatEuro(momoxSummary?.shippingCost || 0)}
            </div>
          </div>
        </div>
      </section>

      <section className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap gap-2">
          {summaries.map((summary) => (
            <button
              key={summary.store}
              className={`rounded-lg border px-4 py-2 font-semibold ${
                activeStore === summary.store
                  ? 'border-blue-700 bg-blue-700 text-white'
                  : 'border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
              onClick={() => setActiveStore(summary.store)}
            >
              {summary.storeLabel} — {formatEuro(summary.totalFinal)}
            </button>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase text-slate-500">
              Spedizione {activeSummary.storeLabel}
            </div>
            <div className="mt-1 text-xl font-bold">
              {formatEuro(activeSummary.shippingCost)}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {activeSummary.activeItemCount === 0
                ? 'Nessun articolo attivo'
                : `${activeSummary.activeItemCount} articoli attivi × ${formatEuro(
                    activeSummary.shippingShare
                  )} cad.`}
            </div>
          </div>

          <div className="rounded-xl bg-green-50 p-3">
            <div className="text-xs font-semibold uppercase text-green-700">
              Totale finale {activeSummary.storeLabel}
            </div>
            <div className="mt-1 text-xl font-bold text-green-900">
              {formatEuro(activeSummary.totalFinal)}
            </div>
            <div className="mt-1 text-xs text-green-800">
              Prezzi scontati + spedizione
            </div>
          </div>
        </div>

        <SummaryCards summary={activeSummary} discountMode={discountMode} />

        {activeSummary.missingPriceCount > 0 && (
          <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            Attenzione: {activeSummary.missingPriceCount} articolo/i attivi non
            hanno ancora un prezzo {activeSummary.storeLabel} rilevato. Quelle
            righe non entrano nei totali dei prezzi, ma contano ancora come
            articoli attivi per la spedizione.
          </div>
        )}
      </section>

      <CartTable
        summary={activeSummary}
        onToggleIgnored={handleToggleIgnored}
        onRemove={handleRemove}
      />
    </main>
  );
}
