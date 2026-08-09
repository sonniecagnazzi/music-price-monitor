'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { Monitor } from '@/lib/types';
import { MonitorDetailModal } from '@/app/components/MonitorDetailModal';
import {
  addCartItem,
  clearCartItems,
  getCartItems,
  removeCartItem,
  toggleCartItemIgnored,
  type CartItem
} from '@/lib/cart';
import { formatEuro } from '@/lib/format';

type StoreKey = 'medimops' | 'momox';

type CartSortKey =
  | 'status'
  | 'artist'
  | 'album'
  | 'country'
  | 'ean_code'
  | 'edition'
  | 'price'
  | 'finalPrice'
  | 'condition'
  | 'rowDiscount'
  | 'discountedPrice'
  | 'shippingShare';

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

function MenuIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 7h16M4 12h16M4 17h16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function WaveIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 12h2l2-6 3 12 3-16 3 10h3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1v-9.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 5h2l2.4 10.5a2 2 0 0 0 2 1.5h6.8a2 2 0 0 0 1.9-1.4L21 9H7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM18 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function TargetIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none">
      <path d="M12 21a9 9 0 1 0-9-9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 17a5 5 0 1 0-5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 13a1 1 0 1 0-1-1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="m16 8 4-4M17 4h3v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ImportIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none">
      <path d="M12 3v12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="m8 7 4-4 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none">
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none">
      <path d="M4 7h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M6.5 7 7.5 21h9L17.5 7" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 7V4h6v3" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}


function EyeIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none">
      <path
        d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none">
      <path
        d="M9 5v14M15 5v14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none">
      <path
        d="M8 6.5v11l9-5.5-9-5.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none">
      <path d="M12 3v12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="m7 10 5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 21h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

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
  if (!value) {
    return <span className="text-slate-400">-</span>;
  }

  const normalized = value.toUpperCase();

  const cls =
    normalized === 'M'
      ? 'border-emerald-700 bg-emerald-700 text-white'
      : normalized === 'NM'
        ? 'border-emerald-400 bg-emerald-200 text-emerald-950'
        : normalized === 'EX'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : normalized === 'VG'
            ? 'border-slate-300 bg-white text-slate-950'
            : normalized === 'G'
              ? 'border-red-200 bg-red-100 text-red-800'
              : 'border-slate-200 bg-slate-100 text-slate-700';

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${cls}`}>
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

function NavItem({
  active,
  icon,
  label,
  badge,
  href,
  onClick
}: {
  active?: boolean;
  icon: React.ReactNode;
  label: string;
  badge?: number;
  href?: string;
  onClick?: () => void;
}) {
  const content = (
    <div
      className={`flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-semibold ${
        active
          ? 'bg-[#24BFBF] text-white shadow-lg shadow-cyan-950/20'
          : 'text-white/82 hover:bg-white/8'
      }`}
    >
      <div className="flex items-center gap-3">
        {icon}
        <span>{label}</span>
      </div>

      {badge ? (
        <span className="rounded-full bg-[#24BFBF] px-2 py-0.5 text-xs font-bold text-white ring-2 ring-white/15">
          {badge}
        </span>
      ) : null}
    </div>
  );

  if (href) {
    return (
      <Link href={href} onClick={onClick}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" className="w-full text-left" onClick={onClick}>
      {content}
    </button>
  );
}

function monitorToCartItem(monitor: Monitor): CartItem {
  return {
    id: monitor.id,
    type: monitor.type,
    artist: monitor.artist,
    album: monitor.album,
    edition: monitor.edition || null,
    ean_code: monitor.ean_code || null,
    medimops_url: monitor.medimops_url || null,
    medimops_current_price: monitor.medimops_current_price ?? null,
    is_ignored: false
  };
}

function AlbumCell({ value }: { value: string }) {
  const shouldWrap = value.length > 40;

  return (
    <div
      className={
        shouldWrap
          ? 'max-w-[360px] whitespace-normal break-words leading-snug text-slate-700'
          : 'min-w-[300px] whitespace-nowrap text-slate-700'
      }
      title={value}
    >
      {value}
    </div>
  );
}

function CartSortIndicator({ active, ascending }: { active: boolean; ascending: boolean }) {
  if (!active) return <span className="text-slate-300">↕</span>;

  return <span className="text-[#24BFBF]">{ascending ? '↑' : '↓'}</span>;
}

function SortableCartHeader({
  label,
  sortKey,
  activeSortKey,
  sortAsc,
  onDoubleClick
}: {
  label: React.ReactNode;
  sortKey?: CartSortKey;
  activeSortKey: CartSortKey | null;
  sortAsc: boolean;
  onDoubleClick: (key: CartSortKey) => void;
}) {
  if (!sortKey) {
    return (
      <th className="whitespace-nowrap border-b border-slate-200 px-3 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </th>
    );
  }

  const active = activeSortKey === sortKey;

  return (
    <th
      className="cursor-pointer select-none whitespace-nowrap border-b border-slate-200 px-3 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 hover:bg-slate-50"
      title="Doppio click: crescente, decrescente, non ordinato"
      onDoubleClick={() => onDoubleClick(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <CartSortIndicator active={active} ascending={sortAsc} />
      </span>
    </th>
  );
}


export default function CartPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [activeStore, setActiveStore] = useState<StoreKey>('medimops');
  const [discountType, setDiscountType] = useState<'percent' | 'euro'>('percent');
  const [discountValue, setDiscountValue] = useState('');
  const [message, setMessage] = useState('Caricamento carrello...');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [detailPopupMonitor, setDetailPopupMonitor] = useState<Monitor | null>(null);
  const [processedAddId, setProcessedAddId] = useState<string | null>(null);
  const [cartSortKey, setCartSortKey] = useState<CartSortKey | null>(null);
  const [cartSortAsc, setCartSortAsc] = useState(true);

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
    if (!detailPopupMonitor) return;

    function handleDetailKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setDetailPopupMonitor(null);
      }
    }

    window.addEventListener('keydown', handleDetailKeyDown);

    return () => {
      window.removeEventListener('keydown', handleDetailKeyDown);
    };
  }, [detailPopupMonitor]);

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

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const addId = params.get('add');

    if (!addId || processedAddId === addId || monitors.length === 0) return;

    const monitor = monitorById.get(addId);

    setProcessedAddId(addId);

    if (!monitor) {
      setMessage('Carrello: monitor non trovato.');
      return;
    }

    addCartItem(monitorToCartItem(monitor));
    refreshItems();
    setMessage(`Aggiunto al carrello: ${monitor.artist} - ${monitor.album}`);

    window.history.replaceState(null, '', '/cart');
  }, [processedAddId, monitors.length, monitorById]);

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
        country: monitor?.country ?? null,
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
  const ignoredItemCount = enrichedItems.length - activeItemCount;
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

  const sortedRows = (() => {
    if (!cartSortKey) return rows;

    function numberValue(value: number | null | undefined): number {
      return typeof value === 'number' && Number.isFinite(value)
        ? value
        : Number.POSITIVE_INFINITY;
    }

    function textValue(value: string | null | undefined): string {
      return String(value || '').toLowerCase();
    }

    return [...rows].sort((left, right) => {
      let comparison = 0;

      if (cartSortKey === 'price') {
        comparison = numberValue(left.price) - numberValue(right.price);
      } else if (cartSortKey === 'finalPrice') {
        comparison = numberValue(left.finalPrice) - numberValue(right.finalPrice);
      } else if (cartSortKey === 'rowDiscount') {
        comparison = numberValue(left.rowDiscount) - numberValue(right.rowDiscount);
      } else if (cartSortKey === 'discountedPrice') {
        comparison = numberValue(left.discountedPrice) - numberValue(right.discountedPrice);
      } else if (cartSortKey === 'shippingShare') {
        comparison = numberValue(left.shippingShare) - numberValue(right.shippingShare);
      } else if (cartSortKey === 'status') {
        comparison = Number(left.is_ignored) - Number(right.is_ignored);
      } else if (cartSortKey === 'artist') {
        comparison = textValue(left.artist).localeCompare(textValue(right.artist), 'it');
      } else if (cartSortKey === 'album') {
        comparison = textValue(left.album).localeCompare(textValue(right.album), 'it');
      } else if (cartSortKey === 'country') {
        comparison = textValue(left.country).localeCompare(textValue(right.country), 'it');
      } else if (cartSortKey === 'ean_code') {
        comparison = textValue(left.ean_code).localeCompare(textValue(right.ean_code), 'it');
      } else if (cartSortKey === 'edition') {
        comparison = textValue(left.edition).localeCompare(textValue(right.edition), 'it');
      } else if (cartSortKey === 'condition') {
        comparison = textValue(left.condition).localeCompare(textValue(right.condition), 'it');
      }

      return cartSortAsc ? comparison : -comparison;
    });
  })();

  function handleCartHeaderDoubleClick(key: CartSortKey) {
    if (cartSortKey !== key) {
      setCartSortKey(key);
      setCartSortAsc(true);
      return;
    }

    if (cartSortAsc) {
      setCartSortAsc(false);
      return;
    }

    setCartSortKey(null);
    setCartSortAsc(true);
  }

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

  function csvNumber(value: number | null | undefined): string {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '';

    return value.toFixed(2).replace('.', ',');
  }

  function exportCsv() {
    const header = [
      'Carrello',
      'Stato',
      'Artista',
      'Titolo',
      'Country',
      'EAN',
      'Label',
      `Prezzo ${activeStoreConfig.label}`,
      'Prezzo finale',
      'Condizione',
      'Sconto riga',
      'Prezzo scontato',
      'Quota spedizione'
    ];

    const csvRows = sortedRows.map((row) => {
      return [
        activeStoreConfig.label,
        row.is_ignored ? 'Ignorato' : 'Attivo',
        row.artist,
        row.album,
        row.country || '',
        row.ean_code || '',
        row.edition || '',
        csvNumber(row.price),
        csvNumber(row.finalPrice),
        row.condition || '',
        csvNumber(row.rowDiscount),
        csvNumber(row.discountedPrice),
        csvNumber(row.shippingShare)
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
    <div className="min-h-screen">
      {isSidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-[#2B403E]/50 backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
          aria-label="Chiudi menu"
        />
      )}

      <aside
        className={`mpm-sidebar fixed inset-y-0 left-0 z-40 flex w-72 flex-col p-5 text-white shadow-2xl transition-transform duration-200 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-8 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#24BFBF] shadow-lg shadow-cyan-950/30">
              <WaveIcon />
            </div>
            <div>
              <div className="text-2xl font-black tracking-tight">DiscWatch</div>
              <div className="text-sm font-medium text-white/65">
                Music Price Monitor
              </div>
            </div>
          </div>

          <button
            type="button"
            className="rounded-xl border border-white/10 p-2 text-white/80 hover:bg-white/10"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Chiudi menu"
          >
            <CloseIcon />
          </button>
        </div>

        <nav className="space-y-2">
          <NavItem icon={<HomeIcon />} label="Dashboard" href="/" onClick={() => setIsSidebarOpen(false)} />
          <NavItem icon={<ClockIcon />} label="Monitoraggi" onClick={() => setIsSidebarOpen(false)} />
          <NavItem icon={<TargetIcon />} label="Quick Target" onClick={() => setIsSidebarOpen(false)} />
          <NavItem icon={<ImportIcon />} label="Importazioni" onClick={() => setIsSidebarOpen(false)} />
          <NavItem active icon={<CartIcon />} label="Carrello" badge={items.length || undefined} onClick={() => setIsSidebarOpen(false)} />
          <NavItem icon={<WaveIcon />} label="Statistiche" onClick={() => setIsSidebarOpen(false)} />
        </nav>

        <div className="mt-auto rounded-3xl border border-white/10 bg-white/5 p-4 shadow-xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#24BFBF] text-lg font-black shadow-lg">
            MP
          </div>
          <div className="mt-3 text-center text-sm font-bold">Music Price Monitor</div>
          <div className="mt-1 text-center text-xs text-white/55">
            Carrello comparativo
          </div>
        </div>
      </aside>

      <main>
        <div className="mx-auto max-w-[1920px] px-4 py-4 sm:px-6 lg:px-6">
          <section className="mb-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-[#2B403E] shadow-sm hover:bg-slate-50"
                  onClick={() => setIsSidebarOpen(true)}
                >
                  <MenuIcon />
                  Menu
                </button>

                <div>
                  <h1 className="text-4xl font-black tracking-tight text-[#12201f]">
                    Carrello comparativo
                  </h1>
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    Confronto prezzi e sconti • Medimops / Momox
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/"
                  className="inline-flex h-11 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  Torna alla dashboard
                </Link>

                <button
                  className="mpm-btn-primary inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold disabled:opacity-50"
                  onClick={exportCsv}
                  disabled={rows.length === 0}
                >
                  <DownloadIcon />
                  Esporta Excel
                </button>

                <button
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-red-100 bg-white px-4 text-sm font-bold text-red-700 shadow-sm hover:bg-red-50 disabled:opacity-50"
                  onClick={clearCart}
                  disabled={items.length === 0}
                >
                  <TrashIcon />
                  Svuota
                </button>
              </div>
            </div>

            <p className="mt-3 rounded-2xl border border-slate-200 bg-white/70 px-4 py-2 text-sm font-medium text-slate-600 shadow-sm">
              Stato: {message}
            </p>
          </section>

          <section className="mpm-card mb-4 rounded-3xl p-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[240px_170px_160px_150px_180px_180px_180px]">
              <div>
                <div className="mb-2 text-sm font-black uppercase tracking-wide text-slate-500">
                  Store
                </div>
                <div className="flex gap-2">
                  {STORES.map((store) => (
                    <button
                      key={store.key}
                      className={`h-11 rounded-xl border px-4 text-sm font-black shadow-sm ${
                        activeStore === store.key
                          ? 'border-[#24BFBF] bg-cyan-50 text-[#168c95]'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                      onClick={() => setActiveStore(store.key)}
                    >
                      {store.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="text-sm font-bold text-slate-700">
                Tipo sconto
                <select
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none focus:border-[#24BFBF]"
                  value={discountType}
                  onChange={(event) =>
                    setDiscountType(event.target.value as 'percent' | 'euro')
                  }
                >
                  <option value="percent">Percentuale</option>
                  <option value="euro">Euro totale</option>
                </select>
              </label>

              <label className="text-sm font-bold text-slate-700">
                Valore
                <input
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none focus:border-[#24BFBF]"
                  placeholder={discountType === 'percent' ? 'es. 10' : 'es. 5,00'}
                  value={discountValue}
                  onChange={(event) => setDiscountValue(event.target.value)}
                />
              </label>

              <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-100">
                <div className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Articoli attivi
                </div>
                <div className="mt-1 text-2xl font-black text-[#2B403E]">
                  {activeItemCount}
                </div>
                {ignoredItemCount > 0 ? (
                  <div className="text-xs font-bold text-slate-400">
                    Ignorati: {ignoredItemCount}
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-100">
                <div className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Subtotale
                </div>
                <div className="mt-1 text-2xl font-black text-[#2B403E]">
                  {formatEuro(rawSubtotal)}
                </div>
              </div>

              <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-100">
                <div className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Spedizione
                </div>
                <div className="mt-1 text-2xl font-black text-[#F2A25C]">
                  {formatEuro(shipping)}
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                <div className="text-xs font-black uppercase tracking-wide text-emerald-700">
                  Totale finale
                </div>
                <div className="mt-1 text-2xl font-black text-[#159b77]">
                  {formatEuro(finalTotal)}
                </div>
              </div>
            </div>
          </section>

          {activeItems.some((item) => item.price === null) && (
            <p className="mb-4 rounded-2xl border border-orange-100 bg-orange-50 px-4 py-3 text-sm font-semibold text-orange-900">
              Alcuni articoli attivi non hanno prezzo nello store selezionato:
              contano per la spedizione ma non nel subtotale prezzi.
            </p>
          )}

          <section className="mpm-card overflow-hidden rounded-3xl">
            <div className="flex flex-col gap-2 border-b border-slate-200 px-5 py-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-black text-[#12201f]">Articoli</h2>
                <p className="text-sm font-medium text-slate-500">
                  Record nel carrello: {rows.length} • Store attivo: {activeStoreConfig.label}
                </p>
              </div>
            </div>

            <div className="mpm-scrollbar max-h-[calc(100vh-360px)] overflow-auto">
              <table className="min-w-[1450px] border-collapse text-sm">
                <thead className="[&_th]:sticky [&_th]:top-0 [&_th]:z-20 [&_th]:bg-white">
                  <tr className="bg-white text-left">
                      <SortableCartHeader label="Stato" sortKey="status" activeSortKey={cartSortKey} sortAsc={cartSortAsc} onDoubleClick={handleCartHeaderDoubleClick} />
                      <SortableCartHeader label="Azioni" activeSortKey={cartSortKey} sortAsc={cartSortAsc} onDoubleClick={handleCartHeaderDoubleClick} />
                      <SortableCartHeader label="Artista" sortKey="artist" activeSortKey={cartSortKey} sortAsc={cartSortAsc} onDoubleClick={handleCartHeaderDoubleClick} />
                      <SortableCartHeader label="Titolo" sortKey="album" activeSortKey={cartSortKey} sortAsc={cartSortAsc} onDoubleClick={handleCartHeaderDoubleClick} />
                      <SortableCartHeader label="Country" sortKey="country" activeSortKey={cartSortKey} sortAsc={cartSortAsc} onDoubleClick={handleCartHeaderDoubleClick} />
                      <SortableCartHeader label="EAN" sortKey="ean_code" activeSortKey={cartSortKey} sortAsc={cartSortAsc} onDoubleClick={handleCartHeaderDoubleClick} />
                      <SortableCartHeader label="Label" sortKey="edition" activeSortKey={cartSortKey} sortAsc={cartSortAsc} onDoubleClick={handleCartHeaderDoubleClick} />
                      <SortableCartHeader label={`Prezzo ${activeStoreConfig.label}`} sortKey="price" activeSortKey={cartSortKey} sortAsc={cartSortAsc} onDoubleClick={handleCartHeaderDoubleClick} />
                      <SortableCartHeader label="Prezzo finale" sortKey="finalPrice" activeSortKey={cartSortKey} sortAsc={cartSortAsc} onDoubleClick={handleCartHeaderDoubleClick} />
                      <SortableCartHeader label="Condizione" sortKey="condition" activeSortKey={cartSortKey} sortAsc={cartSortAsc} onDoubleClick={handleCartHeaderDoubleClick} />
                      <SortableCartHeader label="Sconto riga" sortKey="rowDiscount" activeSortKey={cartSortKey} sortAsc={cartSortAsc} onDoubleClick={handleCartHeaderDoubleClick} />
                      <SortableCartHeader label="Prezzo scontato" sortKey="discountedPrice" activeSortKey={cartSortKey} sortAsc={cartSortAsc} onDoubleClick={handleCartHeaderDoubleClick} />
                      <SortableCartHeader label="Quota spedizione" sortKey="shippingShare" activeSortKey={cartSortKey} sortAsc={cartSortAsc} onDoubleClick={handleCartHeaderDoubleClick} />
                    </tr>
                </thead>

                <tbody>
                  {sortedRows.map((row) => (
                    <tr
                      key={row.cartItem.id}
                      className={`border-b border-slate-100 align-top ${
                        row.is_ignored ? 'bg-slate-50 text-slate-400' : 'bg-white hover:bg-slate-50/70'
                      }`}
                    >
                      <td className="px-3 py-3">
                        {row.is_ignored ? (
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500 ring-1 ring-slate-200">
                            Ignorato
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-[#159b77] ring-1 ring-emerald-100">
                            Attivo
                          </span>
                        )}
                      </td>

                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          <button
                            type="button"
                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                            disabled={!row.monitor}
                            onClick={() => row.monitor && setDetailPopupMonitor(row.monitor)}
                            title={row.monitor ? 'Vedi dettaglio' : 'Dettaglio non disponibile'}
                            aria-label={row.monitor ? 'Vedi dettaglio' : 'Dettaglio non disponibile'}
                          >
                            <EyeIcon />
                          </button>

                          <button
                            type="button"
                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                            onClick={() => toggleIgnored(row.cartItem.id)}
                            title={row.is_ignored ? 'Riattiva' : 'Ignora'}
                            aria-label={row.is_ignored ? 'Riattiva' : 'Ignora'}
                          >
                            {row.is_ignored ? <PlayIcon /> : <PauseIcon />}
                          </button>

                          <button
                            type="button"
                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-100 bg-white text-red-700 hover:bg-red-50"
                            onClick={() => removeItem(row.cartItem.id)}
                            title="Rimuovi"
                            aria-label="Rimuovi"
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      </td>

                      <td className="px-3 py-3 font-bold text-[#12201f]">{row.artist}</td>
                      <td className="px-3 py-3"><AlbumCell value={row.album} /></td>
                      <td className="px-3 py-3 text-slate-600">{row.country || '-'}</td>
                      <td className="px-3 py-3 text-slate-600">{row.ean_code || '-'}</td>
                      <td className="px-3 py-3 text-slate-600">{row.edition || '-'}</td>

                      <td className="px-3 py-3 font-bold">
                        {row.url && row.price !== null ? (
                          <a
                            href={row.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#2B403E] underline decoration-dotted underline-offset-4 hover:text-[#24BFBF]"
                          >
                            {formatEuro(row.price)}
                          </a>
                        ) : (
                          <span className="text-slate-500">{formatEuro(row.price)}</span>
                        )}
                      </td>

                      <td className="px-3 py-3 font-black text-[#159b77]">{formatEuro(row.finalPrice)}</td>
                      <td className="px-3 py-3">{conditionBadge(row.condition)}</td>
                      <td className="px-3 py-3 text-slate-600">{formatEuro(row.rowDiscount)}</td>
                      <td className="px-3 py-3 font-semibold text-slate-800">{formatEuro(row.discountedPrice)}</td>
                      <td className="px-3 py-3 text-slate-600">{formatEuro(row.shippingShare)}</td>
                    </tr>
                  ))}

                  {sortedRows.length === 0 && (
                    <tr>
                      <td className="p-8 text-center text-slate-500" colSpan={13}>
                        Carrello vuoto.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>

      <MonitorDetailModal
        monitor={detailPopupMonitor}
        onClose={() => setDetailPopupMonitor(null)}
      />
    </div>
  );
}