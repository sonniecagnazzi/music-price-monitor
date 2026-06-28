'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  LastStatus,
  Monitor,
  MonitorGenre,
  MonitorInput,
  MonitorType
} from '@/lib/types';
import { MONITOR_GENRES } from '@/lib/types';
import { formatDate, formatEuro, toNumberFromItalianInput } from '@/lib/format';
import { buildAmazonUrl } from '@/lib/amazon-scraper';
import { addCartItem, getCartItems, type CartItem } from '@/lib/cart';
import { buildMomoxUrlFromMedimopsUrl } from '@/lib/store-urls';

type SortKey =
  | 'status'
  | 'is_active'
  | 'has_url'
  | 'genre'
  | 'type'
  | 'artist'
  | 'album'
  | 'best_price'
  | 'medimops_current_price'
  | 'medimops_condition'
  | 'momox_current_price'
  | 'momox_condition'
  | 'last_checked_at'
  | 'ean_code'
  | 'edition'
  | 'release_year'
  | 'country'
  | 'medimops_target_price'
  | 'momox_target_price';

type MultiFilterKey =
  | 'status'
  | 'type'
  | 'is_active'
  | 'has_url'
  | 'genre'
  | 'medimops_condition'
  | 'momox_condition';

type FormState = {
  id?: string;
  genre: MonitorGenre;
  type: MonitorType;
  artist: string;
  album: string;
  edition: string;
  ean_code: string;
  release_year: string;
  country: string;
  medimops_url: string;
  medimops_target_price: string;
  momox_url: string;
  momox_target_price: string;
  amazon_asin: string;
  amazon_target_price: string;
  alert_email: string;
  is_active: boolean;
};

type MultiFilters = Record<MultiFilterKey, string[]>;

const emptyForm: FormState = {
  genre: 'Rock Pop',
  type: 'CD',
  artist: '',
  album: '',
  edition: '',
  ean_code: '',
  release_year: '',
  country: '',
  medimops_url: '',
  medimops_target_price: '',
  momox_url: '',
  momox_target_price: '',
  amazon_asin: '',
  amazon_target_price: '',
  alert_email: '',
  is_active: true
};

const emptyMultiFilters: MultiFilters = {
  status: [],
  type: [],
  is_active: [],
  has_url: [],
  genre: [],
  medimops_condition: [],
  momox_condition: []
};

const conditionOptions = ['EX', 'VG', 'G'];

const multiFilterOptions: Record<MultiFilterKey, string[]> = {
  status: ['In target', 'ok'],
  type: ['CD', 'LP'],
  is_active: ['Sì', 'No'],
  has_url: ['Con URL', 'Senza URL'],
  genre: [...MONITOR_GENRES],
  medimops_condition: conditionOptions,
  momox_condition: conditionOptions
};

const statusLabels: Record<LastStatus | 'never_checked', string> = {
  never_checked: 'mai controllato',
  ok: 'ok',
  below_target: 'In target',
  error: 'errore'
};

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

function ClockIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M12 7v5l3 2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TargetIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 21a9 9 0 1 0-9-9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M12 17a5 5 0 1 0-5-5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M12 13a1 1 0 1 0-1-1"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="m16 8 4-4M17 4h3v3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ImportIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3v12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="m8 7 4-4 4 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 5h16l-6 7v5l-4 2v-7L4 5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 20h4.5L19 9.5 14.5 5 4 15.5V20Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M13.5 6 18 10.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none">
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

function CheckIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none">
      <path
        d="M21 12a9 9 0 1 1-2.64-6.36"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M8.5 12.5 11 15l7-7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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

function CloseIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none">
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none">
      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SortIndicator({ active, ascending }: { active: boolean; ascending: boolean }) {
  if (!active) return <span className="text-slate-300">↕</span>;

  return <span className="text-[#24BFBF]">{ascending ? '↑' : '↓'}</span>;
}

function SortableHeader({
  label,
  sortKey,
  activeSortKey,
  sortAsc,
  onDoubleClick
}: {
  label: string;
  sortKey?: SortKey;
  activeSortKey: SortKey | null;
  sortAsc: boolean;
  onDoubleClick: (key: SortKey) => void;
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
        <SortIndicator active={active} ascending={sortAsc} />
      </span>
    </th>
  );
}

function CompactMultiSelectFilter({
  label,
  value,
  options,
  isOpen,
  onToggle,
  onChange
}: {
  label: string;
  value: string[];
  options: string[];
  isOpen: boolean;
  onToggle: () => void;
  onChange: (value: string[]) => void;
}) {
  const [search, setSearch] = useState('');

  const visibleOptions = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return options;

    return options.filter((option) => option.toLowerCase().includes(query));
  }, [options, search]);

  function toggleValue(option: string) {
    if (value.includes(option)) {
      onChange(value.filter((item) => item !== option));
      return;
    }

    onChange([...value, option]);
  }

  const labelText = value.length === 0 ? label : value.join(', ');

  return (
    <div className="relative">
      <button
        type="button"
        className="mpm-focus flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 text-left text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
        onClick={onToggle}
      >
        <span className="truncate">{labelText}</span>
        <ChevronDownIcon />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-30 mt-2 w-full min-w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl">
          <input
            className="mb-2 w-full rounded-xl border border-slate-200 p-2 text-sm outline-none focus:border-[#24BFBF]"
            placeholder={`Cerca ${label.toLowerCase()}`}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <div className="mpm-scrollbar max-h-44 overflow-y-auto">
            {visibleOptions.map((option) => (
              <label
                key={option}
                className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1.5 text-sm hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={value.includes(option)}
                  onChange={() => toggleValue(option)}
                />
                {option}
              </label>
            ))}

            {visibleOptions.length === 0 && (
              <div className="px-2 py-2 text-sm text-slate-500">
                Nessun valore trovato.
              </div>
            )}
          </div>

          {value.length > 0 && (
            <button
              type="button"
              className="mt-2 w-full rounded-xl border border-slate-200 px-2 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={() => onChange([])}
            >
              Pulisci
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function toOptionalYear(value: string): number | null {
  const trimmed = value.trim();

  if (!trimmed) return null;

  const numberValue = Number(trimmed);

  if (!Number.isFinite(numberValue)) return null;

  return Math.trunc(numberValue);
}

function normalizeEan(value: string): string {
  return value.replace(/\D/g, '').slice(0, 32);
}

function normalizeAsin(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
}

function targetInputToNumber(value: string): number | null {
  const trimmed = value.trim();

  if (!trimmed) return null;

  return toNumberFromItalianInput(trimmed);
}

function numberToItalianInput(value: number | null | undefined): string {
  if (value === null || value === undefined) return '';

  return String(value).replace('.', ',');
}

function isSiteInTarget(currentPrice: number | null, targetPrice: number | null): boolean {
  return currentPrice !== null && targetPrice !== null && currentPrice <= targetPrice;
}

function hasAnyUrl(monitor: Monitor): boolean {
  return Boolean(
    String(monitor.medimops_url || '').trim() ||
      String(monitor.momox_url || '').trim()
  );
}

function getUrlStatusLabel(monitor: Monitor): 'Con URL' | 'Senza URL' {
  return hasAnyUrl(monitor) ? 'Con URL' : 'Senza URL';
}

function getBestPrice(monitor: Monitor): number | null {
  const prices = [monitor.medimops_current_price, monitor.momox_current_price].filter(
    (price): price is number => price !== null
  );

  if (prices.length === 0) return null;

  return Math.min(...prices);
}

function getDisplayStatus(monitor: Monitor): LastStatus | 'never_checked' {
  const medimopsInTarget = isSiteInTarget(
    monitor.medimops_current_price,
    monitor.medimops_target_price
  );

  const momoxInTarget = isSiteInTarget(
    monitor.momox_current_price,
    monitor.momox_target_price
  );

  if (medimopsInTarget || momoxInTarget) return 'below_target';

  return monitor.last_status || 'never_checked';
}

function sitePriceClass(currentPrice: number | null, targetPrice: number | null) {
  return isSiteInTarget(currentPrice, targetPrice)
    ? 'font-bold text-[#1FBF92]'
    : 'font-semibold text-slate-800';
}

function conditionBadge(value: string | null) {
  if (!value) return <span className="text-slate-400">-</span>;

  const cls =
    value === 'EX'
      ? 'bg-emerald-50 text-[#159b77] ring-emerald-100'
      : value === 'VG'
        ? 'bg-cyan-50 text-[#168c95] ring-cyan-100'
        : value === 'G'
          ? 'bg-orange-50 text-[#d97825] ring-orange-100'
          : 'bg-slate-100 text-slate-700 ring-slate-200';

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${cls}`}>
      {value}
    </span>
  );
}

function compareNullableNumbers(left: number | null, right: number | null): number {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;

  return left - right;
}

function compareDates(left: string | null, right: string | null): number {
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;

  const leftTime = new Date(left).getTime();
  const rightTime = new Date(right).getTime();

  if (!Number.isFinite(leftTime) && !Number.isFinite(rightTime)) return 0;
  if (!Number.isFinite(leftTime)) return 1;
  if (!Number.isFinite(rightTime)) return -1;

  return leftTime - rightTime;
}

function compareDefaultOrder(a: Monitor, b: Monitor): number {
  const artistCompare = String(a.artist || '').localeCompare(String(b.artist || ''), 'it');

  if (artistCompare !== 0) return artistCompare;

  const yearCompare = compareNullableNumbers(a.release_year, b.release_year);

  if (yearCompare !== 0) return yearCompare;

  const albumCompare = String(a.album || '').localeCompare(String(b.album || ''), 'it');

  if (albumCompare !== 0) return albumCompare;

  return String(a.country || '').localeCompare(String(b.country || ''), 'it');
}

function compareValues(a: Monitor, b: Monitor, key: SortKey): number {
  if (key === 'best_price') return compareNullableNumbers(getBestPrice(a), getBestPrice(b));

  if (key === 'status') {
    return statusLabels[getDisplayStatus(a)].localeCompare(
      statusLabels[getDisplayStatus(b)],
      'it'
    );
  }

  if (key === 'is_active') return Number(a.is_active) - Number(b.is_active);

  if (key === 'has_url') return Number(hasAnyUrl(a)) - Number(hasAnyUrl(b));

  if (key === 'last_checked_at') return compareDates(a.last_checked_at, b.last_checked_at);

  const left = a[key];
  const right = b[key];

  if (
    typeof left === 'number' ||
    typeof right === 'number' ||
    left === null ||
    right === null
  ) {
    return compareNullableNumbers(
      typeof left === 'number' ? left : null,
      typeof right === 'number' ? right : null
    );
  }

  return String(left ?? '').localeCompare(String(right ?? ''), 'it');
}

function countActiveFilters(filters: Record<string, string>, multiFilters: MultiFilters) {
  const textCount = Object.values(filters).filter(
    (value) => value.trim().length > 0
  ).length;

  const multiCount = Object.values(multiFilters).reduce(
    (total, values) => total + values.length,
    0
  );

  return textCount + multiCount;
}

function monitorToCartItem(monitor: Monitor): CartItem {
  return {
    id: monitor.id,
    type: monitor.type,
    artist: monitor.artist,
    album: monitor.album,
    edition: monitor.edition,
    ean_code: monitor.ean_code,
    medimops_url: monitor.medimops_url,
    medimops_current_price: monitor.medimops_current_price
  };
}

function LinkedPrice({
  value,
  url,
  className
}: {
  value: number | null;
  url: string | null;
  className: string;
}) {
  if (!url || value === null) return <span className={className}>{formatEuro(value)}</span>;

  return (
    <a
      className={`${className} underline decoration-dotted underline-offset-4 hover:text-[#24BFBF]`}
      href={url}
      target="_blank"
      rel="noreferrer"
      title="Apri prodotto"
    >
      {formatEuro(value)}
    </a>
  );
}

function DetailCell({ value }: { value: string | null }) {
  if (!value) return <span className="text-slate-400">-</span>;

  return (
    <details className="max-w-80">
      <summary className="cursor-pointer whitespace-nowrap text-xs font-bold text-red-700 underline decoration-dotted underline-offset-4">
        Vedi errore
      </summary>
      <div className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-red-200 bg-red-50 p-2 text-xs leading-relaxed text-red-900">
        {value}
      </div>
    </details>
  );
}

function UrlStatusCell({ monitor }: { monitor: Monitor }) {
  if (hasAnyUrl(monitor)) {
    return (
      <span
        className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-base font-bold text-[#1FBF92] ring-1 ring-emerald-100"
        title="Almeno un URL tra Medimops e Momox è presente"
      >
        ✓
      </span>
    );
  }

  return (
    <span
      className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-red-50 text-base font-bold text-red-600 ring-1 ring-red-100"
      title="Nessun URL Medimops/Momox presente"
    >
      ✕
    </span>
  );
}

function StatusBadge({ monitor }: { monitor: Monitor }) {
  const value = getDisplayStatus(monitor);

  const cls =
    value === 'error'
      ? 'bg-red-50 text-red-700 ring-red-100'
      : value === 'below_target'
        ? 'bg-emerald-50 text-[#159b77] ring-emerald-100'
        : value === 'ok'
          ? 'bg-cyan-50 text-[#168c95] ring-cyan-100'
          : 'bg-slate-100 text-slate-600 ring-slate-200';

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${cls}`}>
      {statusLabels[value]}
    </span>
  );
}

function NavItem({
  active,
  icon,
  label,
  badge
}: {
  active?: boolean;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}) {
  return (
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
}

function MetricCard({
  title,
  value,
  subtitle,
  tone,
  icon
}: {
  title: string;
  value: string;
  subtitle: string;
  tone: 'teal' | 'green' | 'orange' | 'dark';
  icon: React.ReactNode;
}) {
  const toneMap = {
    teal: {
      value: 'text-[#24BFBF]',
      circle: 'bg-cyan-50 text-[#24BFBF]'
    },
    green: {
      value: 'text-[#1FBF92]',
      circle: 'bg-emerald-50 text-[#1FBF92]'
    },
    orange: {
      value: 'text-[#F2A25C]',
      circle: 'bg-orange-50 text-[#F2A25C]'
    },
    dark: {
      value: 'text-[#2B403E]',
      circle: 'bg-slate-100 text-slate-600'
    }
  }[tone];

  return (
    <div className="mpm-card rounded-3xl p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-slate-500">{title}</div>
          <div className={`mt-2 text-3xl font-black tracking-tight ${toneMap.value}`}>
            {value}
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-500">{subtitle}</div>
        </div>

        <div className={`flex h-14 w-14 items-center justify-center rounded-full ${toneMap.circle}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [multiFilters, setMultiFilters] =
    useState<MultiFilters>(emptyMultiFilters);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [message, setMessage] = useState('Caricamento...');
  const [busy, setBusy] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [cartIds, setCartIds] = useState<string[]>([]);
  const [cartCount, setCartCount] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [openMultiFilter, setOpenMultiFilter] =
    useState<MultiFilterKey | null>(null);

  const csvInputRef = useRef<HTMLInputElement | null>(null);

  function refreshCartState() {
    const items = getCartItems({ includeIgnored: true });

    setCartIds(items.map((item) => item.id));
    setCartCount(items.length);
  }

  async function loadData() {
    const monitorsResponse = await fetch('/api/monitors');
    const monitorsJson = (await monitorsResponse.json()) as {
      data?: Monitor[];
      error?: string;
    };

    if (!monitorsResponse.ok) {
      throw new Error(monitorsJson.error || 'Errore caricamento monitor');
    }

    setMonitors(monitorsJson.data || []);
    setMessage('Pronto.');
  }

  useEffect(() => {
    loadData().catch((error: unknown) =>
      setMessage(error instanceof Error ? error.message : 'Errore caricamento')
    );
  }, []);

  useEffect(() => {
    refreshCartState();

    window.addEventListener('music-price-monitor-cart-updated', refreshCartState);
    window.addEventListener('storage', refreshCartState);

    return () => {
      window.removeEventListener('music-price-monitor-cart-updated', refreshCartState);
      window.removeEventListener('storage', refreshCartState);
    };
  }, []);

  const activeFilterCount = countActiveFilters(filters, multiFilters);

  const activeMonitorCount = monitors.filter((monitor) => monitor.is_active).length;
  const inTargetCount = monitors.filter((monitor) => getDisplayStatus(monitor) === 'below_target').length;
  const withoutUrlCount = monitors.filter((monitor) => !hasAnyUrl(monitor)).length;

  const lastCheckedAt = monitors
    .map((monitor) => monitor.last_checked_at)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

  function handleHeaderDoubleClick(key: SortKey) {
    if (sortKey !== key) {
      setSortKey(key);
      setSortAsc(true);
      return;
    }

    if (sortAsc) {
      setSortAsc(false);
      return;
    }

    setSortKey(null);
    setSortAsc(true);
  }

  function addMonitorToCart(monitor: Monitor) {
    addCartItem(monitorToCartItem(monitor));
    refreshCartState();
    setMessage(`Aggiunto al carrello: ${monitor.artist} - ${monitor.album}`);
  }

  function updateMedimopsUrl(value: string) {
    setForm((previous) => ({
      ...previous,
      medimops_url: value,
      momox_url: buildMomoxUrlFromMedimopsUrl(value)
    }));
  }

  async function importCsvFile(file: File) {
    setBusy(true);
    setMessage(`Import CSV in corso: ${file.name}`);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/monitors/import-csv', {
        method: 'POST',
        body: formData
      });

      const json = (await response.json()) as {
        ok?: boolean;
        imported?: number;
        message?: string;
        error?: string;
      };

      if (!response.ok) throw new Error(json.error || 'Errore durante import CSV.');

      await loadData();
      setSelectedIds([]);
      setIsImportOpen(false);

      setMessage(
        json.message || `Import CSV completato: ${json.imported || 0} righe caricate.`
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `Import CSV bloccato: ${error.message}`
          : 'Import CSV bloccato: errore sconosciuto.'
      );
    } finally {
      setBusy(false);
      setDragActive(false);

      if (csvInputRef.current) csvInputRef.current.value = '';
    }
  }

  function handleCsvInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    importCsvFile(file);
  }

  function handleImportDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);

    const file = event.dataTransfer.files?.[0];

    if (!file) return;

    importCsvFile(file);
  }

  async function applyQuickTarget() {
    if (selectedIds.length === 0) {
      setMessage('Quicktarget: seleziona almeno una riga.');
      return;
    }

    const value = window.prompt(
      `Inserisci il nuovo target da applicare a ${selectedIds.length} record selezionati. Esempio: 5 oppure 5,00`
    );

    if (value === null) return;

    setBusy(true);
    setMessage('Quicktarget in corso...');

    try {
      const response = await fetch('/api/monitors/quick-target', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ids: selectedIds,
          target: value
        })
      });

      const json = (await response.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
      };

      if (!response.ok) throw new Error(json.error || 'Errore Quicktarget.');

      await loadData();

      setMessage(json.message || 'Quicktarget completato.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Errore Quicktarget.');
    } finally {
      setBusy(false);
    }
  }

  const filtered = useMemo(() => {
    const lower = (value: unknown) => String(value ?? '').toLowerCase();

    const filteredRows = monitors.filter((monitor) => {
      const status = getDisplayStatus(monitor);
      const statusLabel = statusLabels[status];
      const activeLabel = monitor.is_active ? 'Sì' : 'No';
      const urlStatusLabel = getUrlStatusLabel(monitor);
      const bestPrice = getBestPrice(monitor);

      if (multiFilters.status.length > 0 && !multiFilters.status.includes(statusLabel)) return false;
      if (multiFilters.type.length > 0 && !multiFilters.type.includes(monitor.type)) return false;
      if (multiFilters.is_active.length > 0 && !multiFilters.is_active.includes(activeLabel)) return false;
      if (multiFilters.has_url.length > 0 && !multiFilters.has_url.includes(urlStatusLabel)) return false;
      if (multiFilters.genre.length > 0 && !multiFilters.genre.includes(monitor.genre)) return false;
      if (
        multiFilters.medimops_condition.length > 0 &&
        !multiFilters.medimops_condition.includes(monitor.medimops_condition || '')
      ) return false;
      if (
        multiFilters.momox_condition.length > 0 &&
        !multiFilters.momox_condition.includes(monitor.momox_condition || '')
      ) return false;

      const row: Record<string, unknown> = {
        ...monitor,
        status: statusLabel,
        has_url: urlStatusLabel,
        best_price: bestPrice === null ? '' : `${bestPrice} ${formatEuro(bestPrice)}`
      };

      return Object.entries(filters).every(
        ([key, filterValue]) =>
          !filterValue || lower(row[key]).includes(filterValue.toLowerCase())
      );
    });

    if (!sortKey) return [...filteredRows].sort(compareDefaultOrder);

    return [...filteredRows].sort((a, b) => {
      const primary = compareValues(a, b, sortKey);

      if (primary !== 0) return sortAsc ? primary : -primary;

      return compareDefaultOrder(a, b);
    });
  }, [monitors, filters, multiFilters, sortKey, sortAsc]);

  const filteredIds = filtered.map((monitor) => monitor.id);
  const allVisibleSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selectedIds.includes(id));

  function toggleSelected(id: string) {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((selectedId) => selectedId !== id));
      return;
    }

    setSelectedIds([...selectedIds, id]);
  }

  function toggleAllVisible() {
    if (allVisibleSelected) {
      setSelectedIds(
        selectedIds.filter((selectedId) => !filteredIds.includes(selectedId))
      );
      return;
    }

    setSelectedIds(Array.from(new Set([...selectedIds, ...filteredIds])));
  }

  function openNewMonitorModal() {
    setForm(emptyForm);
    setIsFormOpen(true);
    setMessage('Nuovo monitor: compila il form e premi Salva.');
  }

  function closeMonitorModal() {
    setForm(emptyForm);
    setIsFormOpen(false);
  }

  function editMonitor(monitor: Monitor) {
    setForm({
      id: monitor.id,
      genre: monitor.genre || 'Rock Pop',
      type: monitor.type,
      artist: monitor.artist,
      album: monitor.album,
      edition: monitor.edition || '',
      ean_code: monitor.ean_code || '',
      release_year:
        monitor.release_year === null || monitor.release_year === undefined
          ? ''
          : String(monitor.release_year),
      country: monitor.country || '',
      medimops_url: monitor.medimops_url || '',
      medimops_target_price: numberToItalianInput(monitor.medimops_target_price),
      momox_url:
        monitor.momox_url ||
        buildMomoxUrlFromMedimopsUrl(monitor.medimops_url || ''),
      momox_target_price: numberToItalianInput(monitor.momox_target_price),
      amazon_asin: monitor.amazon_asin || '',
      amazon_target_price: numberToItalianInput(monitor.amazon_target_price),
      alert_email: monitor.alert_email || '',
      is_active: monitor.is_active
    });

    setIsFormOpen(true);
  }

  function updateMedimopsTargetPrice(value: string) {
    setForm((previous) => {
      const shouldSyncMomox =
        previous.momox_target_price.trim() === '' ||
        previous.momox_target_price === previous.medimops_target_price;

      return {
        ...previous,
        medimops_target_price: value,
        momox_target_price: shouldSyncMomox ? value : previous.momox_target_price
      };
    });
  }

  async function saveMonitor(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setBusy(true);
    setMessage('Salvataggio...');

    const input: MonitorInput = {
      genre: form.genre,
      type: form.type,
      artist: form.artist,
      album: form.album,
      edition: form.edition || null,
      ean_code: form.ean_code.trim() ? normalizeEan(form.ean_code) : null,
      release_year: toOptionalYear(form.release_year),
      country: form.country.trim()
        ? form.country.trim().toUpperCase().slice(0, 3)
        : null,

      medimops_url: form.medimops_url.trim() || null,
      medimops_target_price: targetInputToNumber(form.medimops_target_price),

      momox_url:
        form.momox_url.trim() ||
        buildMomoxUrlFromMedimopsUrl(form.medimops_url.trim()) ||
        null,
      momox_target_price: targetInputToNumber(form.momox_target_price),

      amazon_asin: form.amazon_asin.trim() ? normalizeAsin(form.amazon_asin) : null,
      amazon_target_price: targetInputToNumber(form.amazon_target_price),

      alert_email: form.alert_email || null,
      is_active: form.is_active
    };

    try {
      const response = await fetch(
        form.id ? `/api/monitors/${form.id}` : '/api/monitors',
        {
          method: form.id ? 'PUT' : 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input)
        }
      );

      const json = (await response.json()) as { error?: string };

      if (!response.ok) throw new Error(json.error || 'Errore salvataggio');

      setForm(emptyForm);
      setIsFormOpen(false);
      await loadData();
      setMessage('Monitor salvato.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Errore salvataggio');
    } finally {
      setBusy(false);
    }
  }

  async function deleteMonitor(id: string) {
    if (!confirm('Eliminare questo monitor?')) return;

    setBusy(true);

    try {
      const response = await fetch(`/api/monitors/${id}`, {
        method: 'DELETE'
      });

      const json = (await response.json()) as { error?: string };

      if (!response.ok) throw new Error(json.error || 'Errore eliminazione');

      await loadData();
      setSelectedIds(selectedIds.filter((selectedId) => selectedId !== id));
      refreshCartState();
      setMessage('Monitor eliminato.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Errore eliminazione');
    } finally {
      setBusy(false);
    }
  }

  async function checkOne(id: string) {
    setBusy(true);
    setMessage('Avvio controllo singolo su GitHub Actions...');

    try {
      const response = await fetch(`/api/monitors/${id}/check`, {
        method: 'POST'
      });

      const json = (await response.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
      };

      if (!response.ok) throw new Error(json.error || 'Errore avvio controllo singolo.');

      setMessage(
        json.message ||
          'Controllo singolo avviato su GitHub Actions. Aggiorna tra 1-2 minuti.'
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Errore durante avvio controllo singolo.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function checkVisibleRows() {
    if (filtered.length === 0) {
      setMessage('Nessun record visibile da controllare.');
      return;
    }

    const confirmed = confirm(
      'Vuoi avviare ora il controllo GitHub Actions per tutti i monitor attivi?'
    );

    if (!confirmed) return;

    setBusy(true);
    setMessage('Avvio controllo completo su GitHub Actions...');

    try {
      const response = await fetch('/api/monitors/check-all', {
        method: 'POST'
      });

      const json = (await response.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
      };

      if (!response.ok) throw new Error(json.error || 'Errore avvio controllo completo.');

      setMessage(
        json.message ||
          'Controllo completo avviato su GitHub Actions. Aggiorna tra qualche minuto.'
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Errore durante avvio controllo completo.'
      );
    } finally {
      setBusy(false);
    }
  }

  function clearAllFilters() {
    setFilters({});
    setMultiFilters(emptyMultiFilters);
    setOpenMultiFilter(null);
  }

  const amazonFrUrl = form.amazon_asin
    ? buildAmazonUrl(normalizeAsin(form.amazon_asin), 'FR')
    : '';
  const amazonDeUrl = form.amazon_asin
    ? buildAmazonUrl(normalizeAsin(form.amazon_asin), 'DE')
    : '';
  const amazonItUrl = form.amazon_asin
    ? buildAmazonUrl(normalizeAsin(form.amazon_asin), 'IT')
    : '';

  return (
    <div className="min-h-screen">
      <aside className="mpm-sidebar fixed inset-y-0 left-0 z-20 hidden w-72 flex-col p-5 text-white shadow-2xl lg:flex">
        <div className="mb-8 flex items-center gap-3">
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

        <nav className="space-y-2">
          <NavItem active icon={<HomeIcon />} label="Dashboard" />
          <NavItem icon={<ClockIcon />} label="Monitoraggi" />
          <NavItem icon={<TargetIcon />} label="Quick Target" />
          <NavItem icon={<ImportIcon />} label="Importazioni" />
          <NavItem icon={<CartIcon />} label="Carrello" badge={cartCount || undefined} />
          <NavItem icon={<WaveIcon />} label="Statistiche" />
        </nav>

        <div className="mt-auto rounded-3xl border border-white/10 bg-white/5 p-4 shadow-xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#24BFBF] text-lg font-black shadow-lg">
            MP
          </div>
          <div className="mt-3 text-center text-sm font-bold">Music Price Monitor</div>
          <div className="mt-1 text-center text-xs text-white/55">
            Controlli automatici attivi
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-black/10 p-3 text-xs text-white/70">
            Palette attiva: teal, dark, green, orange.
          </div>
        </div>
      </aside>

      <main className="lg:pl-72">
        <div className="mx-auto max-w-[1760px] px-4 py-5 sm:px-6 lg:px-8">
          <section className="mb-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h1 className="text-4xl font-black tracking-tight text-[#12201f]">
                  Dashboard
                </h1>
                <p className="mt-2 text-sm font-medium text-slate-500">
                  Monitoraggio prezzi dischi • Medimops / Momox
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  className="mpm-btn-primary inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold disabled:opacity-50"
                  onClick={openNewMonitorModal}
                >
                  <span className="text-lg leading-none">+</span>
                  Nuovo record
                </button>

                <button
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                  disabled={busy}
                  onClick={() => setIsImportOpen(true)}
                >
                  <ImportIcon />
                  Import CSV
                </button>

                <button
                  className="mpm-btn-green inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold disabled:opacity-50"
                  disabled={busy || selectedIds.length === 0}
                  onClick={applyQuickTarget}
                >
                  <TargetIcon />
                  Quick Target
                  {selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}
                </button>

                <button
                  className="mpm-btn-orange inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold disabled:opacity-50"
                  disabled={busy || filtered.length === 0}
                  onClick={checkVisibleRows}
                >
                  <CheckIcon />
                  Controlla tutto
                </button>

                <Link
                  href="/cart"
                  className="relative inline-flex h-11 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
                  title="Carrello"
                >
                  <CartIcon />
                  {cartCount > 0 ? (
                    <span className="absolute -right-2 -top-2 rounded-full bg-[#24BFBF] px-2 py-0.5 text-xs font-black text-white">
                      {cartCount}
                    </span>
                  ) : null}
                </Link>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-white/70 p-3 text-sm font-medium text-slate-600 shadow-sm">
              Stato: {message}
            </div>
          </section>

          <section className="mb-5 grid gap-4 xl:grid-cols-[1fr_auto]">
            <div className="relative">
              <input
                className="mpm-focus h-12 w-full rounded-2xl border border-slate-200 bg-white px-12 text-sm font-medium text-slate-700 shadow-sm placeholder:text-slate-400"
                placeholder="Cerca per artista, album, EAN, label, country..."
                value={filters.global || ''}
                onChange={(event) =>
                  setFilters({ ...filters, global: event.target.value })
                }
              />
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                  <path
                    d="m21 21-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-5 xl:flex">
              <CompactMultiSelectFilter
                label="Stato"
                value={multiFilters.status}
                options={multiFilterOptions.status}
                isOpen={openMultiFilter === 'status'}
                onToggle={() =>
                  setOpenMultiFilter(openMultiFilter === 'status' ? null : 'status')
                }
                onChange={(value) => setMultiFilters({ ...multiFilters, status: value })}
              />

              <CompactMultiSelectFilter
                label="Tipo"
                value={multiFilters.type}
                options={multiFilterOptions.type}
                isOpen={openMultiFilter === 'type'}
                onToggle={() =>
                  setOpenMultiFilter(openMultiFilter === 'type' ? null : 'type')
                }
                onChange={(value) => setMultiFilters({ ...multiFilters, type: value })}
              />

              <CompactMultiSelectFilter
                label="Attivo"
                value={multiFilters.is_active}
                options={multiFilterOptions.is_active}
                isOpen={openMultiFilter === 'is_active'}
                onToggle={() =>
                  setOpenMultiFilter(openMultiFilter === 'is_active' ? null : 'is_active')
                }
                onChange={(value) =>
                  setMultiFilters({ ...multiFilters, is_active: value })
                }
              />

              <CompactMultiSelectFilter
                label="URL"
                value={multiFilters.has_url}
                options={multiFilterOptions.has_url}
                isOpen={openMultiFilter === 'has_url'}
                onToggle={() =>
                  setOpenMultiFilter(openMultiFilter === 'has_url' ? null : 'has_url')
                }
                onChange={(value) => setMultiFilters({ ...multiFilters, has_url: value })}
              />

              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
                onClick={() => setFiltersOpen(!filtersOpen)}
              >
                <FilterIcon />
                Filtri
                {activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
              </button>
            </div>
          </section>

          <section className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="Monitor attivi"
              value={String(activeMonitorCount)}
              subtitle={`${monitors.length} record totali`}
              tone="teal"
              icon={<WaveIcon />}
            />

            <MetricCard
              title="In target"
              value={String(inTargetCount)}
              subtitle={monitors.length ? `${Math.round((inTargetCount / monitors.length) * 100)}% del totale` : '0% del totale'}
              tone="green"
              icon={<TargetIcon />}
            />

            <MetricCard
              title="Senza URL"
              value={String(withoutUrlCount)}
              subtitle="Da completare"
              tone="orange"
              icon={
                <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                  <path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  <path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              }
            />

            <MetricCard
              title="Ultimo controllo"
              value={lastCheckedAt ? formatDate(lastCheckedAt) : '-'}
              subtitle="Aggiornato da GitHub Actions"
              tone="dark"
              icon={<ClockIcon />}
            />
          </section>

          {filtersOpen && (
            <section className="mpm-card mb-5 rounded-3xl p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-black uppercase tracking-wide text-[#2B403E]">
                  Filtri avanzati
                </h3>

                <button
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                  onClick={clearAllFilters}
                >
                  Pulisci filtri
                </button>
              </div>

              <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
                <CompactMultiSelectFilter
                  label="Genere"
                  value={multiFilters.genre}
                  options={multiFilterOptions.genre}
                  isOpen={openMultiFilter === 'genre'}
                  onToggle={() =>
                    setOpenMultiFilter(openMultiFilter === 'genre' ? null : 'genre')
                  }
                  onChange={(value) => setMultiFilters({ ...multiFilters, genre: value })}
                />

                <CompactMultiSelectFilter
                  label="Cond. Medimops"
                  value={multiFilters.medimops_condition}
                  options={multiFilterOptions.medimops_condition}
                  isOpen={openMultiFilter === 'medimops_condition'}
                  onToggle={() =>
                    setOpenMultiFilter(
                      openMultiFilter === 'medimops_condition'
                        ? null
                        : 'medimops_condition'
                    )
                  }
                  onChange={(value) =>
                    setMultiFilters({ ...multiFilters, medimops_condition: value })
                  }
                />

                <CompactMultiSelectFilter
                  label="Cond. Momox"
                  value={multiFilters.momox_condition}
                  options={multiFilterOptions.momox_condition}
                  isOpen={openMultiFilter === 'momox_condition'}
                  onToggle={() =>
                    setOpenMultiFilter(
                      openMultiFilter === 'momox_condition' ? null : 'momox_condition'
                    )
                  }
                  onChange={(value) =>
                    setMultiFilters({ ...multiFilters, momox_condition: value })
                  }
                />
              </div>

              <div className="mt-3 grid gap-2 md:grid-cols-3 lg:grid-cols-6">
                {[
                  ['artist', 'Filtro artista'],
                  ['album', 'Filtro album'],
                  ['best_price', 'Filtro Best€'],
                  ['ean_code', 'Filtro EAN'],
                  ['edition', 'Filtro label'],
                  ['release_year', 'Filtro anno'],
                  ['country', 'Filtro country'],
                  ['medimops_current_price', 'Filtro Medimops €'],
                  ['momox_current_price', 'Filtro Momox €'],
                  ['last_checked_at', 'Filtro ultimo rilievo'],
                  ['last_error', 'Filtro dettaglio errore']
                ].map(([key, placeholder]) => (
                  <input
                    key={key}
                    className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-[#24BFBF]"
                    placeholder={placeholder}
                    value={filters[key] || ''}
                    onChange={(event) =>
                      setFilters({ ...filters, [key]: event.target.value })
                    }
                  />
                ))}
              </div>
            </section>
          )}

          <section className="mpm-card overflow-hidden rounded-3xl">
            <div className="flex flex-col gap-2 border-b border-slate-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-black text-[#12201f]">Monitor</h2>
                <p className="text-sm font-medium text-slate-500">
                  Record visibili: {filtered.length} • Ordinamento default: Artista, Anno, Titolo, Country
                </p>
              </div>
            </div>

            <div className="mpm-scrollbar overflow-x-auto">
              <table className="min-w-[1680px] border-collapse text-sm">
                <thead>
                  <tr className="bg-white text-left">
                    <th className="whitespace-nowrap border-b border-slate-200 px-3 py-3">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleAllVisible}
                        title="Seleziona tutte le righe visibili"
                      />
                    </th>
                    <SortableHeader label="Azioni" activeSortKey={sortKey} sortAsc={sortAsc} onDoubleClick={handleHeaderDoubleClick} />
                    <SortableHeader label="Stato" sortKey="status" activeSortKey={sortKey} sortAsc={sortAsc} onDoubleClick={handleHeaderDoubleClick} />
                    <SortableHeader label="URL" sortKey="has_url" activeSortKey={sortKey} sortAsc={sortAsc} onDoubleClick={handleHeaderDoubleClick} />
                    <SortableHeader label="Dettaglio" activeSortKey={sortKey} sortAsc={sortAsc} onDoubleClick={handleHeaderDoubleClick} />
                    <SortableHeader label="Attivo" sortKey="is_active" activeSortKey={sortKey} sortAsc={sortAsc} onDoubleClick={handleHeaderDoubleClick} />
                    <SortableHeader label="Tipo" sortKey="type" activeSortKey={sortKey} sortAsc={sortAsc} onDoubleClick={handleHeaderDoubleClick} />
                    <SortableHeader label="Artista" sortKey="artist" activeSortKey={sortKey} sortAsc={sortAsc} onDoubleClick={handleHeaderDoubleClick} />
                    <SortableHeader label="Album" sortKey="album" activeSortKey={sortKey} sortAsc={sortAsc} onDoubleClick={handleHeaderDoubleClick} />
                    <SortableHeader label="Best€" sortKey="best_price" activeSortKey={sortKey} sortAsc={sortAsc} onDoubleClick={handleHeaderDoubleClick} />
                    <SortableHeader label="Medimops €" sortKey="medimops_current_price" activeSortKey={sortKey} sortAsc={sortAsc} onDoubleClick={handleHeaderDoubleClick} />
                    <SortableHeader label="Medimops Cond." sortKey="medimops_condition" activeSortKey={sortKey} sortAsc={sortAsc} onDoubleClick={handleHeaderDoubleClick} />
                    <SortableHeader label="Momox €" sortKey="momox_current_price" activeSortKey={sortKey} sortAsc={sortAsc} onDoubleClick={handleHeaderDoubleClick} />
                    <SortableHeader label="Momox Cond." sortKey="momox_condition" activeSortKey={sortKey} sortAsc={sortAsc} onDoubleClick={handleHeaderDoubleClick} />
                    <SortableHeader label="Ultimo Rilievo" sortKey="last_checked_at" activeSortKey={sortKey} sortAsc={sortAsc} onDoubleClick={handleHeaderDoubleClick} />
                    <SortableHeader label="EAN" sortKey="ean_code" activeSortKey={sortKey} sortAsc={sortAsc} onDoubleClick={handleHeaderDoubleClick} />
                    <SortableHeader label="Label" sortKey="edition" activeSortKey={sortKey} sortAsc={sortAsc} onDoubleClick={handleHeaderDoubleClick} />
                    <SortableHeader label="Anno" sortKey="release_year" activeSortKey={sortKey} sortAsc={sortAsc} onDoubleClick={handleHeaderDoubleClick} />
                    <SortableHeader label="Country" sortKey="country" activeSortKey={sortKey} sortAsc={sortAsc} onDoubleClick={handleHeaderDoubleClick} />
                    <SortableHeader label="Medimops T" sortKey="medimops_target_price" activeSortKey={sortKey} sortAsc={sortAsc} onDoubleClick={handleHeaderDoubleClick} />
                    <SortableHeader label="Momox T" sortKey="momox_target_price" activeSortKey={sortKey} sortAsc={sortAsc} onDoubleClick={handleHeaderDoubleClick} />
                    <SortableHeader label="Genere" sortKey="genre" activeSortKey={sortKey} sortAsc={sortAsc} onDoubleClick={handleHeaderDoubleClick} />
                  </tr>
                </thead>

                <tbody>
                  {filtered.map((monitor) => {
                    const bestPrice = getBestPrice(monitor);
                    const alreadyInCart = cartIds.includes(monitor.id);

                    return (
                      <tr key={monitor.id} className="border-b border-slate-100 bg-white align-top hover:bg-slate-50/70">
                        <td className="px-3 py-4">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(monitor.id)}
                            onChange={() => toggleSelected(monitor.id)}
                          />
                        </td>

                        <td className="px-3 py-4">
                          <div className="flex items-center justify-start gap-1.5">
                            <button
                              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#2B403E] hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                              disabled={alreadyInCart}
                              onClick={() => addMonitorToCart(monitor)}
                              title={alreadyInCart ? 'Già nel carrello' : 'Aggiungi al carrello'}
                              aria-label={alreadyInCart ? 'Già nel carrello' : 'Aggiungi al carrello'}
                            >
                              <CartIcon />
                            </button>

                            <button
                              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#2B403E] hover:bg-slate-50"
                              onClick={() => editMonitor(monitor)}
                              title="Modifica"
                              aria-label="Modifica"
                            >
                              <EditIcon />
                            </button>

                            <button
                              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-red-100 bg-white text-red-600 hover:bg-red-50 disabled:opacity-50"
                              disabled={busy}
                              onClick={() => deleteMonitor(monitor.id)}
                              title="Elimina"
                              aria-label="Elimina"
                            >
                              <TrashIcon />
                            </button>

                            <button
                              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-100 bg-white text-[#24BFBF] hover:bg-cyan-50 disabled:opacity-50"
                              disabled={busy}
                              onClick={() => checkOne(monitor.id)}
                              title="Controlla ora con GitHub Actions"
                              aria-label="Controlla ora con GitHub Actions"
                            >
                              <CheckIcon />
                            </button>
                          </div>
                        </td>

                        <td className="px-3 py-4"><StatusBadge monitor={monitor} /></td>
                        <td className="px-3 py-4"><UrlStatusCell monitor={monitor} /></td>
                        <td className="px-3 py-4"><DetailCell value={monitor.last_error} /></td>
                        <td className="px-3 py-4">
                          <span className={`inline-flex h-6 w-10 items-center rounded-full p-1 ${monitor.is_active ? 'bg-[#24BFBF]' : 'bg-slate-200'}`}>
                            <span className={`h-4 w-4 rounded-full bg-white shadow ${monitor.is_active ? 'ml-4' : ''}`} />
                          </span>
                        </td>
                        <td className="px-3 py-4">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-black ${monitor.type === 'CD' ? 'bg-cyan-50 text-[#168c95]' : 'bg-orange-50 text-[#d97825]'}`}>
                            {monitor.type}
                          </span>
                        </td>
                        <td className="px-3 py-4 font-bold text-[#12201f]">{monitor.artist}</td>
                        <td className="px-3 py-4 text-slate-700">{monitor.album}</td>
                        <td className="px-3 py-4 font-black text-[#12201f]">{formatEuro(bestPrice)}</td>

                        <td className="px-3 py-4">
                          <LinkedPrice
                            value={monitor.medimops_current_price}
                            url={monitor.medimops_url}
                            className={sitePriceClass(
                              monitor.medimops_current_price,
                              monitor.medimops_target_price
                            )}
                          />
                        </td>

                        <td className="px-3 py-4">{conditionBadge(monitor.medimops_condition)}</td>

                        <td className="px-3 py-4">
                          <LinkedPrice
                            value={monitor.momox_current_price}
                            url={monitor.momox_url}
                            className={sitePriceClass(
                              monitor.momox_current_price,
                              monitor.momox_target_price
                            )}
                          />
                        </td>

                        <td className="px-3 py-4">{conditionBadge(monitor.momox_condition)}</td>
                        <td className="px-3 py-4 text-slate-600">{formatDate(monitor.last_checked_at)}</td>
                        <td className="px-3 py-4 text-slate-600">{monitor.ean_code || '-'}</td>
                        <td className="px-3 py-4 text-slate-600">{monitor.edition || '-'}</td>
                        <td className="px-3 py-4 text-slate-600">{monitor.release_year || '-'}</td>
                        <td className="px-3 py-4 text-slate-600">{monitor.country || '-'}</td>
                        <td className="px-3 py-4 text-slate-500">{formatEuro(monitor.medimops_target_price)}</td>
                        <td className="px-3 py-4 text-slate-500">{formatEuro(monitor.momox_target_price)}</td>
                        <td className="px-3 py-4 text-slate-600">{monitor.genre}</td>
                      </tr>
                    );
                  })}

                  {filtered.length === 0 && (
                    <tr>
                      <td className="p-8 text-center text-slate-500" colSpan={22}>
                        Nessun monitor trovato.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {isImportOpen && (
            <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#2B403E]/60 p-4 backdrop-blur-sm sm:items-center">
              <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-black text-[#12201f]">Importa CSV</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Trascina qui il file CSV oppure selezionalo dal computer.
                      Se anche una sola riga contiene errori, non verrà importato nulla.
                    </p>
                  </div>

                  <button
                    className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                    onClick={() => setIsImportOpen(false)}
                    aria-label="Chiudi"
                  >
                    <CloseIcon />
                  </button>
                </div>

                <input
                  ref={csvInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={handleCsvInputChange}
                />

                <div
                  className={`rounded-3xl border-2 border-dashed p-8 text-center ${
                    dragActive ? 'border-[#24BFBF] bg-cyan-50' : 'border-slate-300 bg-slate-50'
                  }`}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setDragActive(true);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setDragActive(true);
                  }}
                  onDragLeave={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setDragActive(false);
                  }}
                  onDrop={handleImportDrop}
                >
                  <div className="text-lg font-black text-slate-800">
                    Trascina qui il CSV
                  </div>
                  <div className="mt-2 text-sm text-slate-500">oppure</div>

                  <button
                    type="button"
                    disabled={busy}
                    className="mpm-btn-primary mt-4 rounded-xl px-4 py-2 font-bold disabled:opacity-50"
                    onClick={() => csvInputRef.current?.click()}
                  >
                    Scegli file CSV
                  </button>
                </div>

                <div className="mt-4 rounded-2xl bg-orange-50 p-3 text-sm font-semibold text-orange-900">
                  Campi obbligatori: Genere, Tipo, Artista, Album, EAN, Target,
                  URL Medimops. URL Momox viene generato automaticamente da URL Medimops.
                </div>
              </div>
            </div>
          )}

          {isFormOpen && (
            <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#2B403E]/60 p-4 backdrop-blur-sm sm:items-center">
              <div className="w-full max-w-6xl rounded-3xl bg-white p-6 shadow-2xl">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-black text-[#12201f]">
                      {form.id ? 'Modifica monitor' : 'Nuovo monitor'}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Inserisci i dati del disco. Inserendo URL Medimops, URL Momox viene generato automaticamente.
                    </p>
                  </div>

                  <button
                    className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                    onClick={closeMonitorModal}
                    aria-label="Chiudi"
                  >
                    <CloseIcon />
                  </button>
                </div>

                <form onSubmit={saveMonitor} className="space-y-5">
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                    <label className="text-sm font-bold text-slate-700">
                      Genere
                      <select
                        required
                        className="mt-1 w-full rounded-xl border border-slate-200 p-2 outline-none focus:border-[#24BFBF]"
                        value={form.genre}
                        onChange={(event) =>
                          setForm({ ...form, genre: event.target.value as MonitorGenre })
                        }
                      >
                        {MONITOR_GENRES.map((genre) => (
                          <option key={genre} value={genre}>{genre}</option>
                        ))}
                      </select>
                    </label>

                    <label className="text-sm font-bold text-slate-700">
                      Tipo
                      <select
                        className="mt-1 w-full rounded-xl border border-slate-200 p-2 outline-none focus:border-[#24BFBF]"
                        value={form.type}
                        onChange={(event) =>
                          setForm({ ...form, type: event.target.value as MonitorType })
                        }
                      >
                        <option>CD</option>
                        <option>LP</option>
                      </select>
                    </label>

                    <label className="text-sm font-bold text-slate-700">
                      Artista
                      <input
                        required
                        className="mt-1 w-full rounded-xl border border-slate-200 p-2 outline-none focus:border-[#24BFBF]"
                        value={form.artist}
                        onChange={(event) => setForm({ ...form, artist: event.target.value })}
                      />
                    </label>

                    <label className="text-sm font-bold text-slate-700">
                      Album
                      <input
                        required
                        className="mt-1 w-full rounded-xl border border-slate-200 p-2 outline-none focus:border-[#24BFBF]"
                        value={form.album}
                        onChange={(event) => setForm({ ...form, album: event.target.value })}
                      />
                    </label>

                    <label className="text-sm font-bold text-slate-700">
                      Label
                      <input
                        className="mt-1 w-full rounded-xl border border-slate-200 p-2 outline-none focus:border-[#24BFBF]"
                        value={form.edition}
                        onChange={(event) => setForm({ ...form, edition: event.target.value })}
                      />
                    </label>

                    <label className="text-sm font-bold text-slate-700">
                      EAN
                      <input
                        inputMode="numeric"
                        maxLength={32}
                        className="mt-1 w-full rounded-xl border border-slate-200 p-2 outline-none focus:border-[#24BFBF]"
                        value={form.ean_code}
                        onChange={(event) =>
                          setForm({ ...form, ean_code: normalizeEan(event.target.value) })
                        }
                      />
                    </label>

                    <label className="text-sm font-bold text-slate-700">
                      Anno
                      <input
                        type="number"
                        inputMode="numeric"
                        min="1900"
                        max="2100"
                        className="mt-1 w-full rounded-xl border border-slate-200 p-2 outline-none focus:border-[#24BFBF]"
                        value={form.release_year}
                        onChange={(event) =>
                          setForm({ ...form, release_year: event.target.value })
                        }
                      />
                    </label>

                    <label className="text-sm font-bold text-slate-700">
                      Country
                      <input
                        maxLength={3}
                        className="mt-1 w-full rounded-xl border border-slate-200 p-2 uppercase outline-none focus:border-[#24BFBF]"
                        value={form.country}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            country: event.target.value.toUpperCase().slice(0, 3)
                          })
                        }
                      />
                    </label>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <h3 className="mb-3 text-sm font-black uppercase tracking-wide text-[#2B403E]">Medimops</h3>

                    <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
                      <label className="text-sm font-bold text-slate-700">
                        URL Medimops
                        <input
                          type="url"
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2 outline-none focus:border-[#24BFBF]"
                          value={form.medimops_url}
                          onChange={(event) => updateMedimopsUrl(event.target.value)}
                        />
                      </label>

                      <label className="text-sm font-bold text-slate-700">
                        Prezzo Target Medimops
                        <input
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2 outline-none focus:border-[#24BFBF]"
                          placeholder="es. 10,00"
                          value={form.medimops_target_price}
                          onChange={(event) => updateMedimopsTargetPrice(event.target.value)}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <h3 className="mb-3 text-sm font-black uppercase tracking-wide text-[#2B403E]">Momox</h3>

                    <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
                      <label className="text-sm font-bold text-slate-700">
                        URL Momox
                        <input
                          type="url"
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2 outline-none focus:border-[#24BFBF]"
                          value={form.momox_url}
                          onChange={(event) =>
                            setForm({ ...form, momox_url: event.target.value })
                          }
                        />
                      </label>

                      <label className="text-sm font-bold text-slate-700">
                        Prezzo Target Momox
                        <input
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2 outline-none focus:border-[#24BFBF]"
                          placeholder="es. 10,00"
                          value={form.momox_target_price}
                          onChange={(event) =>
                            setForm({ ...form, momox_target_price: event.target.value })
                          }
                        />
                      </label>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-orange-100 bg-orange-50 p-4">
                    <h3 className="mb-3 text-sm font-black uppercase tracking-wide text-[#2B403E]">Amazon</h3>

                    <div className="grid gap-3 lg:grid-cols-[260px_220px_1fr]">
                      <label className="text-sm font-bold text-slate-700">
                        ASIN Amazon
                        <input
                          maxLength={10}
                          className="mt-1 w-full rounded-xl border border-orange-100 bg-white p-2 uppercase outline-none focus:border-[#F2A25C]"
                          placeholder="es. B0DVH4P8DB"
                          value={form.amazon_asin}
                          onChange={(event) =>
                            setForm({ ...form, amazon_asin: normalizeAsin(event.target.value) })
                          }
                        />
                      </label>

                      <label className="text-sm font-bold text-slate-700">
                        Prezzo Target Amazon
                        <input
                          className="mt-1 w-full rounded-xl border border-orange-100 bg-white p-2 outline-none focus:border-[#F2A25C]"
                          placeholder="es. 10,00"
                          value={form.amazon_target_price}
                          onChange={(event) =>
                            setForm({ ...form, amazon_target_price: event.target.value })
                          }
                        />
                      </label>

                      <div className="text-sm text-slate-600">
                        <div className="font-bold text-slate-700">
                          URL generati automaticamente
                        </div>
                        <div className="mt-1 space-y-1 break-all text-xs">
                          <div>FR: {amazonFrUrl || '-'}</div>
                          <div>DE: {amazonDeUrl || '-'}</div>
                          <div>IT: {amazonItUrl || '-'}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    <label className="text-sm font-bold text-slate-700">
                      Email specifica, opzionale
                      <input
                        type="email"
                        className="mt-1 w-full rounded-xl border border-slate-200 p-2 outline-none focus:border-[#24BFBF]"
                        placeholder="Lascia vuoto per usare l’email predefinita"
                        value={form.alert_email}
                        onChange={(event) =>
                          setForm({ ...form, alert_email: event.target.value })
                        }
                      />
                    </label>

                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                      <input
                        type="checkbox"
                        checked={form.is_active}
                        onChange={(event) =>
                          setForm({ ...form, is_active: event.target.checked })
                        }
                      />
                      Attivo
                    </label>
                  </div>

                  <div className="flex gap-3">
                    <button
                      disabled={busy}
                      className="mpm-btn-primary rounded-xl px-5 py-2 font-bold disabled:opacity-50"
                    >
                      Salva
                    </button>

                    <button
                      type="button"
                      className="rounded-xl border border-slate-200 px-5 py-2 font-bold text-slate-700 hover:bg-slate-50"
                      onClick={closeMonitorModal}
                    >
                      Annulla
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}