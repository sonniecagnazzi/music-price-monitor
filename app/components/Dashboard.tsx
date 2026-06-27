'use client';

import { useEffect, useMemo, useState } from 'react';
import type { LastStatus, Monitor, MonitorInput, MonitorType } from '@/lib/types';
import { formatDate, formatEuro, toNumberFromItalianInput } from '@/lib/format';
import { buildAmazonUrl } from '@/lib/amazon-scraper';

type SortKey =
  | 'artist'
  | 'album'
  | 'type'
  | 'best_price'
  | 'medimops_target_price'
  | 'medimops_current_price'
  | 'momox_target_price'
  | 'momox_current_price'
  | 'amazon_target_price'
  | 'amazon_fr_current_price'
  | 'amazon_de_current_price'
  | 'amazon_it_current_price'
  | 'last_checked_at'
  | 'release_year'
  | 'ean_code';

type MultiFilterKey = 'status' | 'type' | 'is_active';

type FormState = {
  id?: string;
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
  is_active: []
};

const multiFilterOptions: Record<MultiFilterKey, string[]> = {
  status: ['In target', 'ok'],
  type: ['CD', 'LP'],
  is_active: ['Sì', 'No']
};

const statusLabels: Record<LastStatus | 'never_checked', string> = {
  never_checked: 'mai controllato',
  ok: 'ok',
  below_target: 'In target',
  error: 'errore'
};

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
      <path
        d="M4 7h16"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M10 11v6M14 11v6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M6.5 7 7.5 21h9L17.5 7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M9 7V4h6v3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none">
      <path
        d="M6 6l12 12M18 6 6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none">
      <path
        d="m6 9 6 6 6-6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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

  const labelText = value.length === 0 ? 'Tutti' : value.join(', ');

  return (
    <div className="relative">
      <label className="mb-1 block text-xs font-medium text-slate-600">
        {label}
      </label>

      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2 text-left text-sm hover:bg-slate-50"
        onClick={onToggle}
      >
        <span className="truncate">{labelText}</span>
        <ChevronDownIcon />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-30 mt-2 w-full min-w-56 rounded-xl border bg-white p-2 shadow-lg">
          <input
            className="mb-2 w-full rounded-lg border p-2 text-sm"
            placeholder={`Cerca ${label.toLowerCase()}`}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <div className="max-h-44 overflow-y-auto">
            {visibleOptions.map((option) => (
              <label
                key={option}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50"
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
              className="mt-2 w-full rounded-lg border px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
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

function isSiteInTarget(
  currentPrice: number | null,
  targetPrice: number | null
): boolean {
  return (
    currentPrice !== null &&
    targetPrice !== null &&
    currentPrice <= targetPrice
  );
}

function getBestPrice(monitor: Monitor): number | null {
  const prices = [
    monitor.medimops_current_price,
    monitor.momox_current_price,
    monitor.amazon_fr_current_price,
    monitor.amazon_de_current_price,
    monitor.amazon_it_current_price
  ].filter((price): price is number => price !== null);

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

  const amazonFrInTarget = isSiteInTarget(
    monitor.amazon_fr_current_price,
    monitor.amazon_target_price
  );

  const amazonDeInTarget = isSiteInTarget(
    monitor.amazon_de_current_price,
    monitor.amazon_target_price
  );

  const amazonItInTarget = isSiteInTarget(
    monitor.amazon_it_current_price,
    monitor.amazon_target_price
  );

  if (
    medimopsInTarget ||
    momoxInTarget ||
    amazonFrInTarget ||
    amazonDeInTarget ||
    amazonItInTarget
  ) {
    return 'below_target';
  }

  return monitor.last_status || 'never_checked';
}

function sitePriceClass(
  currentPrice: number | null,
  targetPrice: number | null
) {
  return isSiteInTarget(currentPrice, targetPrice)
    ? 'font-semibold text-green-700'
    : 'font-semibold';
}

function compareNullableNumbers(
  left: number | null,
  right: number | null
): number {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;

  return left - right;
}

function compareValues(a: Monitor, b: Monitor, key: SortKey): number {
  if (key === 'best_price') {
    return compareNullableNumbers(getBestPrice(a), getBestPrice(b));
  }

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

function countActiveFilters(
  filters: Record<string, string>,
  multiFilters: MultiFilters
) {
  const textCount = Object.values(filters).filter(
    (value) => value.trim().length > 0
  ).length;

  const multiCount = Object.values(multiFilters).reduce(
    (total, values) => total + values.length,
    0
  );

  return textCount + multiCount;
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
  if (!url || value === null) {
    return <span className={className}>{formatEuro(value)}</span>;
  }

  return (
    <a
      className={`${className} underline decoration-dotted underline-offset-4 hover:text-blue-700`}
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
  if (!value) {
    return <span className="text-slate-400">-</span>;
  }

  return (
    <details className="max-w-80">
      <summary className="cursor-pointer whitespace-nowrap text-xs font-semibold text-red-700 underline decoration-dotted underline-offset-4">
        Vedi errore
      </summary>
      <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-red-200 bg-red-50 p-2 text-xs leading-relaxed text-red-900">
        {value}
      </div>
    </details>
  );
}

export default function Dashboard() {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [multiFilters, setMultiFilters] =
    useState<MultiFilters>(emptyMultiFilters);
  const [sortKey, setSortKey] = useState<SortKey>('artist');
  const [sortAsc, setSortAsc] = useState(true);
  const [message, setMessage] = useState('Caricamento...');
  const [busy, setBusy] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [openMultiFilter, setOpenMultiFilter] =
    useState<MultiFilterKey | null>(null);

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

  const activeFilterCount = countActiveFilters(filters, multiFilters);

  const filtered = useMemo(() => {
    const lower = (value: unknown) => String(value ?? '').toLowerCase();

    return monitors
      .filter((monitor) => {
        const status = getDisplayStatus(monitor);
        const statusLabel = statusLabels[status];
        const activeLabel = monitor.is_active ? 'Sì' : 'No';
        const bestPrice = getBestPrice(monitor);

        if (
          multiFilters.status.length > 0 &&
          !multiFilters.status.includes(statusLabel)
        ) {
          return false;
        }

        if (
          multiFilters.type.length > 0 &&
          !multiFilters.type.includes(monitor.type)
        ) {
          return false;
        }

        if (
          multiFilters.is_active.length > 0 &&
          !multiFilters.is_active.includes(activeLabel)
        ) {
          return false;
        }

        const row: Record<string, unknown> = {
          ...monitor,
          best_price:
            bestPrice === null ? '' : `${bestPrice} ${formatEuro(bestPrice)}`
        };

        return Object.entries(filters).every(
          ([key, filterValue]) =>
            !filterValue ||
            lower(row[key]).includes(filterValue.toLowerCase())
        );
      })
      .sort((a, b) => {
        const primary = compareValues(a, b, sortKey);

        if (primary !== 0) {
          return sortAsc ? primary : -primary;
        }

        const byArtist = compareValues(a, b, 'artist');

        if (byArtist !== 0) return byArtist;

        return compareValues(a, b, 'release_year');
      });
  }, [monitors, filters, multiFilters, sortKey, sortAsc]);

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
      medimops_target_price: numberToItalianInput(
        monitor.medimops_target_price
      ),
      momox_url: monitor.momox_url || '',
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
        momox_target_price: shouldSyncMomox
          ? value
          : previous.momox_target_price
      };
    });
  }

  async function saveMonitor(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setBusy(true);
    setMessage('Salvataggio...');

    const input: MonitorInput = {
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

      momox_url: form.momox_url.trim() || null,
      momox_target_price: targetInputToNumber(form.momox_target_price),

      amazon_asin: form.amazon_asin.trim()
        ? normalizeAsin(form.amazon_asin)
        : null,
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

      if (!response.ok) {
        throw new Error(json.error || 'Errore salvataggio');
      }

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

      if (!response.ok) {
        throw new Error(json.error || 'Errore eliminazione');
      }

      await loadData();
      setMessage('Monitor eliminato.');
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Errore eliminazione'
      );
    } finally {
      setBusy(false);
    }
  }

  async function checkOne(id: string) {
    setBusy(true);
    setMessage('Controllo prezzo in corso...');

    try {
      const response = await fetch(`/api/monitors/${id}/check`, {
        method: 'POST'
      });

      const json = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(json.error || 'Errore controllo');
      }

      await loadData();
      setMessage('Controllo completato.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Errore controllo');
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
      `Vuoi controllare ora tutti i ${filtered.length} record visibili nel datagrid?`
    );

    if (!confirmed) return;

    setBusy(true);

    let checked = 0;
    let failed = 0;

    try {
      for (const monitor of filtered) {
        checked += 1;
        setMessage(
          `Controllo ${checked}/${filtered.length}: ${monitor.artist} - ${monitor.album}`
        );

        const response = await fetch(`/api/monitors/${monitor.id}/check`, {
          method: 'POST'
        });

        const json = (await response.json()) as { error?: string };

        if (!response.ok) {
          failed += 1;
          console.error(
            `Errore controllo ${monitor.artist} - ${monitor.album}`,
            json.error
          );
        }
      }

      await loadData();

      if (failed > 0) {
        setMessage(
          `Controllo datagrid completato: ${checked - failed} ok, ${failed} errori.`
        );
      } else {
        setMessage(
          `Controllo datagrid completato: ${checked} record controllati.`
        );
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Errore durante controllo datagrid'
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

  function badge(monitor: Monitor) {
    const value = getDisplayStatus(monitor);

    const cls =
      value === 'error'
        ? 'bg-red-100 text-red-800'
        : value === 'below_target'
          ? 'bg-green-100 text-green-800'
          : value === 'ok'
            ? 'bg-blue-100 text-blue-800'
            : 'bg-slate-100 text-slate-700';

    return (
      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${cls}`}>
        {statusLabels[value]}
      </span>
    );
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
    <main className="mx-auto max-w-7xl p-4 sm:p-6">
      <div className="mb-4 rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Music Price Monitor</h1>
            <p className="mt-2 text-slate-600">
              Dashboard italiana per monitorare prezzi CD/LP su Momox,
              Medimops e Amazon.
            </p>
          </div>

          <button
            className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white shadow-sm hover:bg-blue-800"
            onClick={openNewMonitorModal}
          >
            Nuovo monitor
          </button>
        </div>

        <p className="mt-4 rounded-lg bg-slate-100 p-3 text-sm">
          Stato: {message}
        </p>
      </div>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Monitor</h2>
            <p className="mt-1 text-sm text-slate-500">
              Record visibili: {filtered.length}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              className="inline-flex items-center gap-2 rounded-lg bg-green-700 px-4 py-2 font-semibold text-white shadow-sm hover:bg-green-800 disabled:opacity-50"
              disabled={busy || filtered.length === 0}
              onClick={checkVisibleRows}
            >
              <CheckIcon />
              Controlla tutto il datagrid
            </button>

            <button
              className="rounded-lg border px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={() => setFiltersOpen(!filtersOpen)}
            >
              {filtersOpen ? 'Nascondi filtri' : 'Mostra filtri'}
              {activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </button>

            <select
              className="rounded-lg border p-2"
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value as SortKey)}
            >
              <option value="artist">Artista</option>
              <option value="album">Album</option>
              <option value="type">Tipo</option>
              <option value="best_price">Best€</option>
              <option value="medimops_current_price">Medimops €</option>
              <option value="momox_current_price">Momox €</option>
              <option value="amazon_fr_current_price">Amazon FR €</option>
              <option value="amazon_de_current_price">Amazon DE €</option>
              <option value="amazon_it_current_price">Amazon IT €</option>
              <option value="medimops_target_price">Medimops T</option>
              <option value="momox_target_price">Momox T</option>
              <option value="amazon_target_price">Amazon T</option>
              <option value="last_checked_at">Data ultimo rilievo</option>
              <option value="ean_code">EAN</option>
              <option value="release_year">Anno</option>
            </select>

            <button
              className="rounded-lg border px-3"
              onClick={() => setSortAsc(!sortAsc)}
            >
              {sortAsc ? 'Crescente' : 'Decrescente'}
            </button>
          </div>
        </div>

        {filtersOpen && (
          <div className="mb-4 rounded-xl border bg-slate-50 p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-700">Filtri</h3>

              <button
                className="rounded-lg border bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
                onClick={clearAllFilters}
              >
                Pulisci filtri
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <CompactMultiSelectFilter
                label="Stato"
                value={multiFilters.status}
                options={multiFilterOptions.status}
                isOpen={openMultiFilter === 'status'}
                onToggle={() =>
                  setOpenMultiFilter(
                    openMultiFilter === 'status' ? null : 'status'
                  )
                }
                onChange={(value) =>
                  setMultiFilters({ ...multiFilters, status: value })
                }
              />

              <CompactMultiSelectFilter
                label="Tipo"
                value={multiFilters.type}
                options={multiFilterOptions.type}
                isOpen={openMultiFilter === 'type'}
                onToggle={() =>
                  setOpenMultiFilter(openMultiFilter === 'type' ? null : 'type')
                }
                onChange={(value) =>
                  setMultiFilters({ ...multiFilters, type: value })
                }
              />

              <CompactMultiSelectFilter
                label="Attivo"
                value={multiFilters.is_active}
                options={multiFilterOptions.is_active}
                isOpen={openMultiFilter === 'is_active'}
                onToggle={() =>
                  setOpenMultiFilter(
                    openMultiFilter === 'is_active' ? null : 'is_active'
                  )
                }
                onChange={(value) =>
                  setMultiFilters({ ...multiFilters, is_active: value })
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
                ['amazon_asin', 'Filtro ASIN'],
                ['medimops_current_price', 'Filtro Medimops €'],
                ['momox_current_price', 'Filtro Momox €'],
                ['amazon_fr_current_price', 'Filtro Amazon FR €'],
                ['amazon_de_current_price', 'Filtro Amazon DE €'],
                ['amazon_it_current_price', 'Filtro Amazon IT €'],
                ['last_checked_at', 'Filtro ultimo rilievo'],
                ['last_error', 'Filtro dettaglio errore']
              ].map(([key, placeholder]) => (
                <input
                  key={key}
                  className="rounded-lg border bg-white p-2 text-sm"
                  placeholder={placeholder}
                  value={filters[key] || ''}
                  onChange={(event) =>
                    setFilters({ ...filters, [key]: event.target.value })
                  }
                />
              ))}
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-100 text-left">
                {[
                  'Azioni',
                  'Stato',
                  'Dettaglio',
                  'Attivo',
                  'Tipo',
                  'Artista',
                  'Album',
                  'Best€',
                  'Medimops €',
                  'Momox €',
                  'Amazon FR €',
                  'Amazon DE €',
                  'Amazon IT €',
                  'Ultimo Rilievo',
                  'EAN',
                  'Label',
                  'Anno',
                  'Country',
                  'ASIN',
                  'Medimops T',
                  'Momox T',
                  'Amazon T'
                ].map((heading) => (
                  <th key={heading} className="border-b p-2">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {filtered.map((monitor) => {
                const bestPrice = getBestPrice(monitor);
                const rowAmazonFrUrl = monitor.amazon_asin
                  ? buildAmazonUrl(monitor.amazon_asin, 'FR')
                  : null;
                const rowAmazonDeUrl = monitor.amazon_asin
                  ? buildAmazonUrl(monitor.amazon_asin, 'DE')
                  : null;
                const rowAmazonItUrl = monitor.amazon_asin
                  ? buildAmazonUrl(monitor.amazon_asin, 'IT')
                  : null;

                return (
                  <tr key={monitor.id} className="border-b align-top">
                    <td className="p-2">
                      <div className="flex items-center justify-start gap-2">
                        <button
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border text-slate-700 hover:bg-slate-50"
                          onClick={() => editMonitor(monitor)}
                          title="Modifica"
                          aria-label="Modifica"
                        >
                          <EditIcon />
                        </button>

                        <button
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50"
                          disabled={busy}
                          onClick={() => deleteMonitor(monitor.id)}
                          title="Elimina"
                          aria-label="Elimina"
                        >
                          <TrashIcon />
                        </button>

                        <button
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                          disabled={busy}
                          onClick={() => checkOne(monitor.id)}
                          title="Controlla ora"
                          aria-label="Controlla ora"
                        >
                          <CheckIcon />
                        </button>
                      </div>
                    </td>

                    <td className="p-2">{badge(monitor)}</td>
                    <td className="p-2">
                      <DetailCell value={monitor.last_error} />
                    </td>
                    <td className="p-2">{monitor.is_active ? 'Sì' : 'No'}</td>
                    <td className="p-2">{monitor.type}</td>
                    <td className="p-2 font-medium">{monitor.artist}</td>
                    <td className="p-2">{monitor.album}</td>

                    <td className="p-2 font-bold text-slate-900">
                      {formatEuro(bestPrice)}
                    </td>

                    <td className="p-2">
                      <LinkedPrice
                        value={monitor.medimops_current_price}
                        url={monitor.medimops_url}
                        className={sitePriceClass(
                          monitor.medimops_current_price,
                          monitor.medimops_target_price
                        )}
                      />
                    </td>

                    <td className="p-2">
                      <LinkedPrice
                        value={monitor.momox_current_price}
                        url={monitor.momox_url}
                        className={sitePriceClass(
                          monitor.momox_current_price,
                          monitor.momox_target_price
                        )}
                      />
                    </td>

                    <td className="p-2">
                      <LinkedPrice
                        value={monitor.amazon_fr_current_price}
                        url={rowAmazonFrUrl}
                        className={sitePriceClass(
                          monitor.amazon_fr_current_price,
                          monitor.amazon_target_price
                        )}
                      />
                    </td>

                    <td className="p-2">
                      <LinkedPrice
                        value={monitor.amazon_de_current_price}
                        url={rowAmazonDeUrl}
                        className={sitePriceClass(
                          monitor.amazon_de_current_price,
                          monitor.amazon_target_price
                        )}
                      />
                    </td>

                    <td className="p-2">
                      <LinkedPrice
                        value={monitor.amazon_it_current_price}
                        url={rowAmazonItUrl}
                        className={sitePriceClass(
                          monitor.amazon_it_current_price,
                          monitor.amazon_target_price
                        )}
                      />
                    </td>

                    <td className="p-2">
                      {formatDate(monitor.last_checked_at)}
                    </td>
                    <td className="p-2">{monitor.ean_code || '-'}</td>
                    <td className="p-2">{monitor.edition || '-'}</td>
                    <td className="p-2">{monitor.release_year || '-'}</td>
                    <td className="p-2">{monitor.country || '-'}</td>
                    <td className="p-2">{monitor.amazon_asin || '-'}</td>

                    <td className="p-2 text-slate-500">
                      {formatEuro(monitor.medimops_target_price)}
                    </td>
                    <td className="p-2 text-slate-500">
                      {formatEuro(monitor.momox_target_price)}
                    </td>
                    <td className="p-2 text-slate-500">
                      {formatEuro(monitor.amazon_target_price)}
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td className="p-4 text-center text-slate-500" colSpan={22}>
                    Nessun monitor trovato.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:items-center">
          <div className="w-full max-w-6xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">
                  {form.id ? 'Modifica monitor' : 'Nuovo monitor'}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Inserisci i dati del disco e almeno un controllo tra
                  Medimops, Momox o Amazon.
                </p>
              </div>

              <button
                className="rounded-lg border p-2 text-slate-600 hover:bg-slate-50"
                onClick={closeMonitorModal}
                aria-label="Chiudi"
              >
                <CloseIcon />
              </button>
            </div>

            <form onSubmit={saveMonitor} className="space-y-5">
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                <label className="text-sm font-medium">
                  Tipo
                  <select
                    className="mt-1 w-full rounded-lg border p-2"
                    value={form.type}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        type: event.target.value as MonitorType
                      })
                    }
                  >
                    <option>CD</option>
                    <option>LP</option>
                  </select>
                </label>

                <label className="text-sm font-medium">
                  Artista
                  <input
                    required
                    className="mt-1 w-full rounded-lg border p-2"
                    value={form.artist}
                    onChange={(event) =>
                      setForm({ ...form, artist: event.target.value })
                    }
                  />
                </label>

                <label className="text-sm font-medium">
                  Album
                  <input
                    required
                    className="mt-1 w-full rounded-lg border p-2"
                    value={form.album}
                    onChange={(event) =>
                      setForm({ ...form, album: event.target.value })
                    }
                  />
                </label>

                <label className="text-sm font-medium">
                  Label
                  <input
                    className="mt-1 w-full rounded-lg border p-2"
                    value={form.edition}
                    onChange={(event) =>
                      setForm({ ...form, edition: event.target.value })
                    }
                  />
                </label>

                <label className="text-sm font-medium">
                  EAN
                  <input
                    inputMode="numeric"
                    maxLength={32}
                    className="mt-1 w-full rounded-lg border p-2"
                    value={form.ean_code}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        ean_code: normalizeEan(event.target.value)
                      })
                    }
                  />
                </label>

                <label className="text-sm font-medium">
                  Anno
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1900"
                    max="2100"
                    className="mt-1 w-full rounded-lg border p-2"
                    value={form.release_year}
                    onChange={(event) =>
                      setForm({ ...form, release_year: event.target.value })
                    }
                  />
                </label>

                <label className="text-sm font-medium">
                  Country
                  <input
                    maxLength={3}
                    className="mt-1 w-full rounded-lg border p-2 uppercase"
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

              <div className="rounded-xl border bg-slate-50 p-4">
                <h3 className="mb-3 text-sm font-semibold text-slate-700">
                  Medimops
                </h3>

                <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
                  <label className="text-sm font-medium">
                    URL Medimops
                    <input
                      type="url"
                      className="mt-1 w-full rounded-lg border bg-white p-2"
                      value={form.medimops_url}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          medimops_url: event.target.value
                        })
                      }
                    />
                  </label>

                  <label className="text-sm font-medium">
                    Prezzo Target Medimops
                    <input
                      className="mt-1 w-full rounded-lg border bg-white p-2"
                      placeholder="es. 10,00"
                      value={form.medimops_target_price}
                      onChange={(event) =>
                        updateMedimopsTargetPrice(event.target.value)
                      }
                    />
                  </label>
                </div>
              </div>

              <div className="rounded-xl border bg-slate-50 p-4">
                <h3 className="mb-3 text-sm font-semibold text-slate-700">
                  Momox
                </h3>

                <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
                  <label className="text-sm font-medium">
                    URL Momox
                    <input
                      type="url"
                      className="mt-1 w-full rounded-lg border bg-white p-2"
                      value={form.momox_url}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          momox_url: event.target.value
                        })
                      }
                    />
                  </label>

                  <label className="text-sm font-medium">
                    Prezzo Target Momox
                    <input
                      className="mt-1 w-full rounded-lg border bg-white p-2"
                      placeholder="es. 10,00"
                      value={form.momox_target_price}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          momox_target_price: event.target.value
                        })
                      }
                    />
                  </label>
                </div>
              </div>

              <div className="rounded-xl border bg-amber-50 p-4">
                <h3 className="mb-3 text-sm font-semibold text-slate-700">
                  Amazon
                </h3>

                <div className="grid gap-3 lg:grid-cols-[260px_220px_1fr]">
                  <label className="text-sm font-medium">
                    ASIN Amazon
                    <input
                      maxLength={10}
                      className="mt-1 w-full rounded-lg border bg-white p-2 uppercase"
                      placeholder="es. B0DVH4P8DB"
                      value={form.amazon_asin}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          amazon_asin: normalizeAsin(event.target.value)
                        })
                      }
                    />
                  </label>

                  <label className="text-sm font-medium">
                    Prezzo Target Amazon
                    <input
                      className="mt-1 w-full rounded-lg border bg-white p-2"
                      placeholder="es. 10,00"
                      value={form.amazon_target_price}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          amazon_target_price: event.target.value
                        })
                      }
                    />
                  </label>

                  <div className="text-sm text-slate-600">
                    <div className="font-medium text-slate-700">
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
                <label className="text-sm font-medium">
                  Email specifica, opzionale
                  <input
                    type="email"
                    className="mt-1 w-full rounded-lg border p-2"
                    placeholder="Lascia vuoto per usare l’email predefinita"
                    value={form.alert_email}
                    onChange={(event) =>
                      setForm({ ...form, alert_email: event.target.value })
                    }
                  />
                </label>

                <label className="flex items-center gap-2 text-sm font-medium">
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
                  className="rounded-lg bg-blue-700 px-5 py-2 font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
                >
                  Salva
                </button>

                <button
                  type="button"
                  className="rounded-lg border px-5 py-2 font-semibold text-slate-700 hover:bg-slate-50"
                  onClick={closeMonitorModal}
                >
                  Annulla
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
