'use client';

import { useEffect, useMemo, useState } from 'react';
import type {
  LastStatus,
  Monitor,
  MonitorInput,
  MonitorType
} from '@/lib/types';
import { formatDate, formatEuro, toNumberFromItalianInput } from '@/lib/format';

type SortKey =
  | 'artist'
  | 'album'
  | 'type'
  | 'medimops_target_price'
  | 'medimops_current_price'
  | 'momox_target_price'
  | 'momox_current_price'
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
  alert_email: '',
  is_active: true
};

const emptyMultiFilters: MultiFilters = {
  status: [],
  type: [],
  is_active: []
};

const statusLabels: Record<LastStatus | 'never_checked', string> = {
  never_checked: 'mai controllato',
  ok: 'ok',
  below_target: 'in target',
  error: 'errore'
};

function EditIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
    >
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
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
    >
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
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
    >
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

function ExternalLinkIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M14 5h5v5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 14 19 5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M19 14v5H5V5h5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M6 6l12 12M18 6 6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, 'it')
  );
}

function selectedValuesFromSelect(
  event: React.ChangeEvent<HTMLSelectElement>
) {
  return Array.from(event.target.selectedOptions).map((option) => option.value);
}

function MultiSelectFilter({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string[];
  options: string[];
  onChange: (value: string[]) => void;
}) {
  return (
    <label className="text-xs font-medium text-slate-600">
      {label}
      <select
        multiple
        className="mt-1 h-20 w-full rounded-lg border p-2 text-sm"
        value={value}
        onChange={(event) => onChange(selectedValuesFromSelect(event))}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
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

function sitePriceClass(
  currentPrice: number | null,
  targetPrice: number | null
) {
  return isSiteInTarget(currentPrice, targetPrice)
    ? 'font-semibold text-green-700'
    : 'font-semibold';
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

  const multiFilterOptions = useMemo(() => {
    return {
      status: uniqueSorted(
        monitors.map((monitor) => {
          const status = monitor.last_status || 'never_checked';
          return statusLabels[status];
        })
      ),
      type: uniqueSorted(monitors.map((monitor) => monitor.type)),
      is_active: uniqueSorted(
        monitors.map((monitor) => (monitor.is_active ? 'Sì' : 'No'))
      )
    };
  }, [monitors]);

  const filtered = useMemo(() => {
    const lower = (value: unknown) => String(value ?? '').toLowerCase();

    return monitors
      .filter((monitor) => {
        const status = monitor.last_status || 'never_checked';
        const statusLabel = statusLabels[status];
        const activeLabel = monitor.is_active ? 'Sì' : 'No';

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
          ...monitor
        };

        return Object.entries(filters).every(
          ([key, filterValue]) =>
            !filterValue ||
            lower(row[key]).includes(filterValue.toLowerCase())
        );
      })
      .sort((a, b) => {
        const left = a[sortKey] ?? '';
        const right = b[sortKey] ?? '';

        const result =
          typeof left === 'number' && typeof right === 'number'
            ? left - right
            : String(left).localeCompare(String(right));

        return sortAsc ? result : -result;
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
      alert_email: monitor.alert_email || '',
      is_active: monitor.is_active
    });

    setIsFormOpen(true);
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
  }

  function badge(
    status: LastStatus | null,
    medimopsCurrentPrice: number | null,
    medimopsTargetPrice: number | null,
    momoxCurrentPrice: number | null,
    momoxTargetPrice: number | null
  ) {
    const medimopsInTarget = isSiteInTarget(
      medimopsCurrentPrice,
      medimopsTargetPrice
    );
    const momoxInTarget = isSiteInTarget(momoxCurrentPrice, momoxTargetPrice);
    const value =
      medimopsInTarget || momoxInTarget ? 'below_target' : status || 'never_checked';

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

  return (
    <main className="mx-auto max-w-7xl p-4 sm:p-6">
      <div className="mb-6 rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Music Price Monitor</h1>
            <p className="mt-2 text-slate-600">
              Dashboard italiana per monitorare prezzi CD/LP su Momox e
              Medimops.
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
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
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

            <select
              className="rounded-lg border p-2"
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value as SortKey)}
            >
              <option value="artist">Artista</option>
              <option value="album">Album</option>
              <option value="type">Tipo</option>
              <option value="medimops_current_price">
                Medimops prezzo attuale
              </option>
              <option value="medimops_target_price">
                Medimops prezzo target
              </option>
              <option value="momox_current_price">Momox prezzo attuale</option>
              <option value="momox_target_price">Momox prezzo target</option>
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

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <MultiSelectFilter
              label="Stato"
              value={multiFilters.status}
              options={multiFilterOptions.status}
              onChange={(value) =>
                setMultiFilters({ ...multiFilters, status: value })
              }
            />

            <MultiSelectFilter
              label="Tipo"
              value={multiFilters.type}
              options={multiFilterOptions.type}
              onChange={(value) =>
                setMultiFilters({ ...multiFilters, type: value })
              }
            />

            <MultiSelectFilter
              label="Attivo"
              value={multiFilters.is_active}
              options={multiFilterOptions.is_active}
              onChange={(value) =>
                setMultiFilters({ ...multiFilters, is_active: value })
              }
            />
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-3 lg:grid-cols-7">
            {[
              ['artist', 'Filtro artista'],
              ['album', 'Filtro album'],
              ['ean_code', 'Filtro EAN'],
              ['edition', 'Filtro label'],
              ['release_year', 'Filtro anno'],
              ['country', 'Filtro country'],
              ['medimops_url', 'Filtro Medimops URL'],
              ['momox_url', 'Filtro Momox URL'],
              ['medimops_target_price', 'Filtro Medimops target'],
              ['medimops_current_price', 'Filtro Medimops attuale'],
              ['momox_target_price', 'Filtro Momox target'],
              ['momox_current_price', 'Filtro Momox attuale'],
              ['last_checked_at', 'Filtro ultimo rilievo']
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

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-100 text-left">
                {[
                  'Azioni',
                  'URL',
                  'Stato',
                  'Attivo',
                  'Tipo',
                  'Artista',
                  'Album',
                  'Medimops Target',
                  'Medimops Attuale',
                  'Momox Target',
                  'Momox Attuale',
                  'Ultimo Rilievo',
                  'EAN',
                  'Label',
                  'Anno',
                  'Country'
                ].map((heading) => (
                  <th key={heading} className="border-b p-2">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {filtered.map((monitor) => {
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

                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        {monitor.medimops_url && (
                          <a
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border text-blue-700 hover:bg-blue-50"
                            href={monitor.medimops_url}
                            target="_blank"
                            rel="noreferrer"
                            title="Apri Medimops"
                            aria-label="Apri Medimops"
                          >
                            <span className="sr-only">Medimops</span>
                            <ExternalLinkIcon />
                          </a>
                        )}

                        {monitor.momox_url && (
                          <a
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border text-purple-700 hover:bg-purple-50"
                            href={monitor.momox_url}
                            target="_blank"
                            rel="noreferrer"
                            title="Apri Momox"
                            aria-label="Apri Momox"
                          >
                            <span className="sr-only">Momox</span>
                            <ExternalLinkIcon />
                          </a>
                        )}
                      </div>
                    </td>

                    <td className="p-2">
                      {badge(
                        monitor.last_status,
                        monitor.medimops_current_price,
                        monitor.medimops_target_price,
                        monitor.momox_current_price,
                        monitor.momox_target_price
                      )}
                    </td>
                    <td className="p-2">{monitor.is_active ? 'Sì' : 'No'}</td>
                    <td className="p-2">{monitor.type}</td>
                    <td className="p-2 font-medium">{monitor.artist}</td>
                    <td className="p-2">{monitor.album}</td>
                    <td className="p-2">
                      {formatEuro(monitor.medimops_target_price)}
                    </td>
                    <td
                      className={`p-2 ${sitePriceClass(
                        monitor.medimops_current_price,
                        monitor.medimops_target_price
                      )}`}
                    >
                      {formatEuro(monitor.medimops_current_price)}
                    </td>
                    <td className="p-2">
                      {formatEuro(monitor.momox_target_price)}
                    </td>
                    <td
                      className={`p-2 ${sitePriceClass(
                        monitor.momox_current_price,
                        monitor.momox_target_price
                      )}`}
                    >
                      {formatEuro(monitor.momox_current_price)}
                    </td>
                    <td className="p-2">
                      {formatDate(monitor.last_checked_at)}
                    </td>
                    <td className="p-2">{monitor.ean_code || '-'}</td>
                    <td className="p-2">{monitor.edition || '-'}</td>
                    <td className="p-2">{monitor.release_year || '-'}</td>
                    <td className="p-2">{monitor.country || '-'}</td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td className="p-4 text-center text-slate-500" colSpan={16}>
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
                  Inserisci i dati del disco e almeno un URL con prezzo target
                  tra Medimops e Momox.
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
                        setForm({
                          ...form,
                          medimops_target_price: event.target.value
                        })
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
