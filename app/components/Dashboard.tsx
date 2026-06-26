'use client';

import { useEffect, useMemo, useState } from 'react';
import type {
  LastStatus,
  Monitor,
  MonitorInput,
  MonitorSite,
  MonitorType
} from '@/lib/types';
import { formatDate, formatEuro, toNumberFromItalianInput } from '@/lib/format';

type SortKey =
  | 'artist'
  | 'album'
  | 'target_price'
  | 'current_price'
  | 'last_checked_at';

type FormState = {
  id?: string;
  type: MonitorType;
  artist: string;
  album: string;
  edition: string;
  site: MonitorSite;
  url: string;
  target_price: string;
  alert_email: string;
  is_active: boolean;
};

const emptyForm: FormState = {
  type: 'CD',
  artist: '',
  album: '',
  edition: '',
  site: 'Momox',
  url: '',
  target_price: '0,00',
  alert_email: '',
  is_active: true
};

const statusLabels: Record<LastStatus | 'never_checked', string> = {
  never_checked: 'mai controllato',
  ok: 'ok',
  below_target: 'sotto target',
  error: 'errore'
};

export default function Dashboard() {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sortKey, setSortKey] = useState<SortKey>('artist');
  const [sortAsc, setSortAsc] = useState(true);
  const [message, setMessage] = useState('Caricamento...');
  const [busy, setBusy] = useState(false);

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

  const filtered = useMemo(() => {
    const lower = (value: unknown) => String(value ?? '').toLowerCase();

    return monitors
      .filter((monitor) => {
        const status = monitor.last_status || 'never_checked';
        const row: Record<string, unknown> = {
          ...monitor,
          status,
          is_active: monitor.is_active ? 'attivo' : 'disattivo'
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
  }, [monitors, filters, sortKey, sortAsc]);

  function startNew() {
    setForm(emptyForm);
    setMessage('Nuovo monitor: compila il form e premi Salva.');
  }

  function editMonitor(monitor: Monitor) {
    setForm({
      id: monitor.id,
      type: monitor.type,
      artist: monitor.artist,
      album: monitor.album,
      edition: monitor.edition || '',
      site: monitor.site,
      url: monitor.url,
      target_price: String(monitor.target_price).replace('.', ','),
      alert_email: monitor.alert_email || '',
      is_active: monitor.is_active
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
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
      site: form.site,
      url: form.url,
      target_price: toNumberFromItalianInput(form.target_price),
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

  function badge(
    status: LastStatus | null,
    current: number | null,
    target: number
  ) {
    const value = status || 'never_checked';

    const cls =
      value === 'error'
        ? 'bg-red-100 text-red-800'
        : value === 'below_target' || (current !== null && current <= target)
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
        <h1 className="text-3xl font-bold">Music Price Monitor</h1>
        <p className="mt-2 text-slate-600">
          Dashboard italiana per monitorare prezzi CD/LP su Momox e Medimops.
        </p>
        <p className="mt-3 rounded-lg bg-slate-100 p-3 text-sm">
          Stato: {message}
        </p>
      </div>

      <section className="mb-6 rounded-2xl bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">
            {form.id ? 'Modifica monitor' : 'Nuovo monitor'}
          </h2>
          <button className="rounded-lg border px-4 py-2" onClick={startNew}>
            Nuovo monitor
          </button>
        </div>

        <form
          onSubmit={saveMonitor}
          className="grid gap-3 md:grid-cols-2 lg:grid-cols-3"
        >
          <label className="text-sm font-medium">
            Tipo
            <select
              className="mt-1 w-full rounded-lg border p-2"
              value={form.type}
              onChange={(event) =>
                setForm({ ...form, type: event.target.value as MonitorType })
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
            Edizione
            <input
              className="mt-1 w-full rounded-lg border p-2"
              value={form.edition}
              onChange={(event) =>
                setForm({ ...form, edition: event.target.value })
              }
            />
          </label>

          <label className="text-sm font-medium">
            Sito
            <select
              className="mt-1 w-full rounded-lg border p-2"
              value={form.site}
              onChange={(event) =>
                setForm({ ...form, site: event.target.value as MonitorSite })
              }
            >
              <option>Momox</option>
              <option>Medimops</option>
            </select>
          </label>

          <label className="text-sm font-medium">
            Prezzo target
            <input
              required
              className="mt-1 w-full rounded-lg border p-2"
              value={form.target_price}
              onChange={(event) =>
                setForm({ ...form, target_price: event.target.value })
              }
            />
          </label>

          <label className="text-sm font-medium lg:col-span-2">
            URL
            <input
              required
              type="url"
              className="mt-1 w-full rounded-lg border p-2"
              value={form.url}
              onChange={(event) =>
                setForm({ ...form, url: event.target.value })
              }
            />
          </label>

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

          <button
            disabled={busy}
            className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-50"
          >
            Salva
          </button>
        </form>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="text-xl font-semibold">Monitor</h2>

          <div className="flex gap-2">
            <select
              className="rounded-lg border p-2"
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value as SortKey)}
            >
              <option value="artist">Artista</option>
              <option value="album">Album</option>
              <option value="target_price">Prezzo target</option>
              <option value="current_price">Prezzo attuale</option>
              <option value="last_checked_at">Data ultimo rilievo</option>
            </select>

            <button
              className="rounded-lg border px-3"
              onClick={() => setSortAsc(!sortAsc)}
            >
              {sortAsc ? 'Crescente' : 'Decrescente'}
            </button>
          </div>
        </div>

        <div className="mb-4 grid gap-2 md:grid-cols-3 lg:grid-cols-6">
          {[
            'type',
            'artist',
            'album',
            'edition',
            'site',
            'url',
            'target_price',
            'current_price',
            'last_checked_at',
            'is_active'
          ].map((key) => (
            <input
              key={key}
              className="rounded-lg border p-2 text-sm"
              placeholder={`Filtro ${key}`}
              value={filters[key] || ''}
              onChange={(event) =>
                setFilters({ ...filters, [key]: event.target.value })
              }
            />
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-100 text-left">
                {[
                  'Stato',
                  'Tipo',
                  'Artista',
                  'Album',
                  'Edizione',
                  'Sito',
                  'URL',
                  'Target',
                  'Attuale',
                  'Ultimo rilievo',
                  'Attivo',
                  'Errore',
                  'Azioni'
                ].map((heading) => (
                  <th key={heading} className="border-b p-2">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {filtered.map((monitor) => {
                const under =
                  monitor.current_price !== null &&
                  monitor.current_price <= monitor.target_price;

                return (
                  <tr key={monitor.id} className="border-b align-top">
                    <td className="p-2">
                      {badge(
                        monitor.last_status,
                        monitor.current_price,
                        monitor.target_price
                      )}
                    </td>
                    <td className="p-2">{monitor.type}</td>
                    <td className="p-2 font-medium">{monitor.artist}</td>
                    <td className="p-2">{monitor.album}</td>
                    <td className="p-2">{monitor.edition || '-'}</td>
                    <td className="p-2">{monitor.site}</td>
                    <td className="max-w-xs truncate p-2">
                      <a
                        className="text-blue-700 underline"
                        href={monitor.url}
                        target="_blank"
                      >
                        apri
                      </a>
                    </td>
                    <td className="p-2">{formatEuro(monitor.target_price)}</td>
                    <td
                      className={`p-2 font-semibold ${
                        under ? 'text-green-700' : ''
                      }`}
                    >
                      {formatEuro(monitor.current_price)}
                    </td>
                    <td className="p-2">
                      {formatDate(monitor.last_checked_at)}
                    </td>
                    <td className="p-2">{monitor.is_active ? 'Sì' : 'No'}</td>
                    <td className="max-w-xs p-2 text-red-700">
                      {monitor.last_error || '-'}
                    </td>
                    <td className="space-y-2 p-2">
                      <button
                        className="block rounded border px-3 py-1"
                        onClick={() => editMonitor(monitor)}
                      >
                        Modifica
                      </button>
                      <button
                        className="block rounded border px-3 py-1"
                        disabled={busy}
                        onClick={() => checkOne(monitor.id)}
                      >
                        Controlla ora
                      </button>
                      <button
                        className="block rounded border border-red-300 px-3 py-1 text-red-700"
                        disabled={busy}
                        onClick={() => deleteMonitor(monitor.id)}
                      >
                        Elimina
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td className="p-4 text-center text-slate-500" colSpan={13}>
                    Nessun monitor trovato.
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
