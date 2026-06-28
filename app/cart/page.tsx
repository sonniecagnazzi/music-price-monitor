'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { Monitor } from '@/lib/types';
import {
  clearCartItems,
  getCartItems,
  removeCartItem,
  toggleCartItemIgnored,
  type CartItem
} from '@/lib/cart';
import { formatEuro } from '@/lib/format';

type StoreKey = 'medimops' | 'momox';

type StoreConfig = {
  key: StoreKey;
  label: string;
  priceField: 'medimops_current_price' | 'momox_current_price';
  conditionField: 'medimops_condition' | 'momox_condition';
  urlField: 'medimops_url' | 'momox_url';
};

const STORES: StoreConfig[] = [
  {
    key: 'medimops',
    label: 'Medimops',
    priceField: 'medimops_current_price',
    conditionField: 'medimops_condition',
    urlField: 'medimops_url'
  },
  {
    key: 'momox',
    label: 'Momox',
    priceField: 'momox_current_price',
    conditionField: 'momox_condition',
    urlField: 'momox_url'
  }
];

function getShipping(activeItemCount: number): number {
  if (activeItemCount <= 0) return 0;
  if (activeItemCount === 1) return 2.49;
  if (activeItemCount === 2) return 4.98;
  if (activeItemCount === 3) return 7.47;

  return 7.99;
}

function getTodayForFilename() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeNumber(value: string): number {
  const cleaned = value
    .trim()
    .replace(/\s/g, '')
    .replace('€', '')
    .replace(/\./g, '')
    .replace(',', '.');

  const parsed = Number(cleaned);

  if (!Number.isFinite(parsed) || parsed < 0) return 0;

  return parsed;
}

function conditionBadge(value: string | null) {
  if (!value) return <span className="text-slate-400">-</span>;

  const cls =
    value === 'EX'
      ? 'bg-green-100 text-green-800'
      : value === 'VG'
        ? 'bg-blue-100 text-blue-800'
        : value === 'G'
          ? 'bg-amber-100 text-amber-800'
          : 'bg-slate-100 text-slate-700';

  return (
    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${cls}`}>
      {value}
    </span>
  );
}

function csvEscape(value: string | number | null | undefined): string {
  const text = String(value ?? '');

  if (/[",\n;]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

export default function CartPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [activeStore, setActiveStore] = useState<StoreKey>('medimops');
  const [discountType, setDiscountType] = useState<'percent' | 'euro'>('percent');
  const [discountValue, setDiscountValue] = useState('');
  const [message, setMessage] = useState('Caricamento carrello...');

  function refreshItems() {
    setItems(getCartItems({ includeIgnored: true }));
  }

  async function loadMonitors() {
    const response = await fetch('/api/monitors', {
      cache: 'no-store'
    });

    const json = (await response.json()) as {
      data?: Monitor[];
      error?: string;
    };

    if (!response.ok) {
      throw new Error(json.error || 'Errore caricamento monitor.');
    }

    setMonitors(json.data || []);
  }

  useEffect(() => {
    refreshItems();

    loadMonitors()
      .then(() => setMessage('Pronto.'))
      .catch((error: unknown) =>
        setMessage(error instanceof Error ? error.message : 'Errore caricamento')
      );

    window.addEventListener('music-price-monitor-cart-updated', refreshItems);
    window.addEventListener('storage', refreshItems);

    return () => {
      window.removeEventListener('music-price-monitor-cart-updated', refreshItems);
      window.removeEventListener('storage', refreshItems);
    };
  }, []);

  const monitorById = useMemo(() => {
    const map = new Map<string, Monitor>();

    monitors.forEach((monitor) => {
      map.set(monitor.id, monitor);
    });

    return map;
  }, [monitors]);

  const activeStoreConfig =
    STORES.find((store) => store.key === activeStore) || STORES[0];

  const enrichedItems = useMemo(() => {
    return items.map((item) => {
      const monitor = monitorById.get(item.id);

      return {
        cartItem: item,
        monitor,
        type: monitor?.type || item.type,
        artist: monitor?.artist || item.artist,
        album: monitor?.album || item.album,
        edition: monitor?.edition ?? item.edition ?? null,
        ean_code: monitor?.ean_code ?? item.ean_code ?? null,
        price:
          monitor?.[activeStoreConfig.priceField] ??
          (activeStore === 'medimops' ? item.medimops_current_price : null),
        condition: monitor?.[activeStoreConfig.conditionField] ?? null,
        url:
          monitor?.[activeStoreConfig.urlField] ??
          (activeStore === 'medimops' ? item.medimops_url : null),
        is_ignored: Boolean(item.is_ignored)
      };
    });
  }, [items, monitorById, activeStore, activeStoreConfig]);

  const activeItems = enrichedItems.filter((item) => !item.is_ignored);
  const pricedItems = activeItems.filter((item) => item.price !== null);
  const activeItemCount = activeItems.length;
  const shipping = getShipping(activeItemCount);
  const rawSubtotal = pricedItems.reduce(
    (total, item) => total + (item.price || 0),
    0
  );

  const discountNumber = normalizeNumber(discountValue);

  const rows = enrichedItems.map((item) => {
    const price = item.price;
    const hasPrice = price !== null;
    const isActive = !item.is_ignored;

    let rowDiscount = 0;

    if (isActive && hasPrice) {
      if (discountType === 'percent') {
        rowDiscount = (price * discountNumber) / 100;
      } else if (pricedItems.length > 0) {
        rowDiscount = discountNumber / pricedItems.length;
      }
    }

    const discountedPrice =
      isActive && hasPrice ? Math.max(0, price - rowDiscount) : null;

    const shippingShare =
      isActive && activeItemCount > 0 ? shipping / activeItemCount : 0;

    const finalPrice =
      discountedPrice !== null ? discountedPrice + shippingShare : null;

    return {
      ...item,
      rowDiscount,
      discountedPrice,
      shippingShare,
      finalPrice
    };
  });

  const discountedSubtotal = rows
    .filter((row) => !row.is_ignored && row.discountedPrice !== null)
    .reduce((total, row) => total + (row.discountedPrice || 0), 0);

  const finalTotal = discountedSubtotal + shipping;

  function removeItem(id: string) {
    removeCartItem(id);
    refreshItems();
  }

  function toggleIgnored(id: string) {
    toggleCartItemIgnored(id);
    refreshItems();
  }

  function clearCart() {
    if (!confirm('Svuotare tutto il carrello?')) return;

    clearCartItems();
    refreshItems();
  }

  function exportCsv() {
    const header = [
      'Carrello',
      'Stato',
      'Artista',
      'Titolo',
      'EAN',
      'Label',
      `Prezzo ${activeStoreConfig.label}`,
      'Condizione',
      'Sconto riga',
      'Prezzo scontato',
      'Quota spedizione',
      'Prezzo finale articolo'
    ];

    const csvRows = rows.map((row) => {
      return [
        activeStoreConfig.label,
        row.is_ignored ? 'Ignorato' : 'Attivo',
        row.artist,
        row.album,
        row.ean_code || '',
        row.edition || '',
        row.price ?? '',
        row.condition || '',
        row.rowDiscount ? row.rowDiscount.toFixed(2) : '',
        row.discountedPrice !== null ? row.discountedPrice.toFixed(2) : '',
        row.shippingShare ? row.shippingShare.toFixed(2) : '',
        row.finalPrice !== null ? row.finalPrice.toFixed(2) : ''
      ];
    });

    const content = [header, ...csvRows]
      .map((row) => row.map(csvEscape).join(';'))
      .join('\n');

    const blob = new Blob([`\uFEFF${content}`], {
      type: 'text/csv;charset=utf-8'
    });

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `carrello-${activeStoreConfig.key}-${getTodayForFilename()}.csv`;
    link.click();

    window.URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto max-w-7xl p-4 sm:p-6">
      <div className="mb-4 rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Carrello comparativo</h1>
            <p className="mt-2 text-slate-600">
              Confronta il carrello Medimops e Momox con sconti e spedizione.
            </p>
            <p className="mt-3 rounded-lg bg-slate-100 p-3 text-sm">
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
              className="rounded-lg border border-blue-700 px-4 py-2 font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50"
              onClick={exportCsv}
              disabled={rows.length === 0}
            >
              Esporta Excel
            </button>

            <button
              className="rounded-lg border border-red-600 px-4 py-2 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
              onClick={clearCart}
              disabled={items.length === 0}
            >
              Svuota carrello
            </button>
          </div>
        </div>
      </div>

      <section className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {STORES.map((store) => {
              const storeItems = items
                .map((item) => monitorById.get(item.id))
                .filter(Boolean) as Monitor[];

              const storeTotal = storeItems.reduce((total, monitor) => {
                const price = monitor[store.priceField];

                return total + (price || 0);
              }, 0);

              return (
                <button
                  key={store.key}
                  className={`rounded-xl border px-4 py-3 text-left ${
                    activeStore === store.key
                      ? 'border-blue-700 bg-blue-50 text-blue-900'
                      : 'bg-white hover:bg-slate-50'
                  }`}
                  onClick={() => setActiveStore(store.key)}
                >
                  <div className="font-semibold">{store.label}</div>
                  <div className="text-sm text-slate-600">
                    Totale grezzo: {formatEuro(storeTotal)}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="grid gap-3 sm:grid-cols-[180px_180px]">
            <label className="text-sm font-medium">
              Tipo sconto
              <select
                className="mt-1 w-full rounded-lg border p-2"
                value={discountType}
                onChange={(event) =>
                  setDiscountType(event.target.value as 'percent' | 'euro')
                }
              >
                <option value="percent">Percentuale</option>
                <option value="euro">Euro totale</option>
              </select>
            </label>

            <label className="text-sm font-medium">
              Valore sconto
              <input
                className="mt-1 w-full rounded-lg border p-2"
                placeholder={discountType === 'percent' ? 'es. 10' : 'es. 5,00'}
                value={discountValue}
                onChange={(event) => setDiscountValue(event.target.value)}
              />
            </label>
          </div>
        </div>
      </section>

      <section className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="text-sm text-slate-500">Store</div>
            <div className="text-xl font-bold">{activeStoreConfig.label}</div>
          </div>

          <div className="rounded-xl bg-slate-50 p-3">
            <div className="text-sm text-slate-500">Articoli attivi</div>
            <div className="text-xl font-bold">{activeItemCount}</div>
          </div>

          <div className="rounded-xl bg-slate-50 p-3">
            <div className="text-sm text-slate-500">Subtotale</div>
            <div className="text-xl font-bold">{formatEuro(rawSubtotal)}</div>
          </div>

          <div className="rounded-xl bg-slate-50 p-3">
            <div className="text-sm text-slate-500">Spedizione</div>
            <div className="text-xl font-bold">{formatEuro(shipping)}</div>
          </div>

          <div className="rounded-xl bg-green-50 p-3">
            <div className="text-sm text-green-700">Totale finale</div>
            <div className="text-xl font-bold text-green-800">
              {formatEuro(finalTotal)}
            </div>
          </div>
        </div>

        {activeItems.some((item) => item.price === null) && (
          <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            Alcuni articoli attivi non hanno prezzo nello store selezionato:
            contano per la spedizione ma non nel subtotale prezzi.
          </p>
        )}
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-100 text-left">
                <th className="border-b p-2">Stato</th>
                <th className="border-b p-2">Azioni</th>
                <th className="border-b p-2">Artista</th>
                <th className="border-b p-2">Titolo</th>
                <th className="border-b p-2">EAN</th>
                <th className="border-b p-2">Label</th>
                <th className="border-b p-2">
                  Prezzo {activeStoreConfig.label}
                </th>
                <th className="border-b p-2">Condizione</th>
                <th className="border-b p-2">Sconto riga</th>
                <th className="border-b p-2">Prezzo scontato</th>
                <th className="border-b p-2">Quota spedizione</th>
                <th className="border-b p-2">Prezzo finale articolo</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.cartItem.id}
                  className={`border-b align-top ${
                    row.is_ignored ? 'bg-slate-50 text-slate-400' : ''
                  }`}
                >
                  <td className="p-2">
                    {row.is_ignored ? (
                      <span className="rounded-full bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-600">
                        Ignorato
                      </span>
                    ) : (
                      <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">
                        Attivo
                      </span>
                    )}
                  </td>

                  <td className="p-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="rounded-lg border px-3 py-1 text-xs hover:bg-slate-50"
                        onClick={() => toggleIgnored(row.cartItem.id)}
                      >
                        {row.is_ignored ? 'Riattiva' : 'Ignora'}
                      </button>

                      <button
                        className="rounded-lg border border-red-300 px-3 py-1 text-xs text-red-700 hover:bg-red-50"
                        onClick={() => removeItem(row.cartItem.id)}
                      >
                        Rimuovi
                      </button>
                    </div>
                  </td>

                  <td className="p-2 font-medium">{row.artist}</td>
                  <td className="p-2">{row.album}</td>
                  <td className="p-2">{row.ean_code || '-'}</td>
                  <td className="p-2">{row.edition || '-'}</td>

                  <td className="p-2 font-semibold">
                    {row.url && row.price !== null ? (
                      <a
                        href={row.url}
                        target="_blank"
                        rel="noreferrer"
                        className="underline decoration-dotted underline-offset-4 hover:text-blue-700"
                      >
                        {formatEuro(row.price)}
                      </a>
                    ) : (
                      formatEuro(row.price)
                    )}
                  </td>

                  <td className="p-2">{conditionBadge(row.condition)}</td>
                  <td className="p-2">{formatEuro(row.rowDiscount)}</td>
                  <td className="p-2">{formatEuro(row.discountedPrice)}</td>
                  <td className="p-2">{formatEuro(row.shippingShare)}</td>
                  <td className="p-2 font-bold">{formatEuro(row.finalPrice)}</td>
                </tr>
              ))}

              {rows.length === 0 && (
                <tr>
                  <td className="p-4 text-center text-slate-500" colSpan={12}>
                    Carrello vuoto.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}