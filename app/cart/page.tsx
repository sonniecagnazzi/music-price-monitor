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

type DiscountMode = 'percent' | 'euro';

type CalculatedRow = {
  item: CartItem;
  basePrice: number | null;
  discountAmount: number;
  discountedPrice: number | null;
  shippingShare: number;
  finalPrice: number | null;
  isIgnored: boolean;
};

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

function getMedimopsShippingCost(activeItemCount: number): number {
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

export default function CartPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [discountMode, setDiscountMode] = useState<DiscountMode>('percent');
  const [discountValue, setDiscountValue] = useState('');

  useEffect(() => {
    setItems(getCartItems({ includeIgnored: true }));
  }, []);

  const discountNumber = parseItalianNumber(discountValue);

  const activeItems = useMemo(() => {
    return items.filter((item) => !item.is_ignored);
  }, [items]);

  const activeItemsWithPrice = useMemo(() => {
    return activeItems.filter((item) => item.medimops_current_price !== null);
  }, [activeItems]);

  const activeItemCount = activeItems.length;
  const activePriceItemCount = activeItemsWithPrice.length;

  const shippingCost = getMedimopsShippingCost(activeItemCount);
  const shippingShare =
    activeItemCount === 0 ? 0 : roundMoney(shippingCost / activeItemCount);

  const euroDiscountShare =
    discountMode === 'euro' && activePriceItemCount > 0
      ? roundMoney(discountNumber / activePriceItemCount)
      : 0;

  const calculatedRows = useMemo<CalculatedRow[]>(() => {
    return items.map((item) => {
      const isIgnored = Boolean(item.is_ignored);
      const basePrice = item.medimops_current_price;

      if (isIgnored) {
        return {
          item,
          basePrice,
          discountAmount: 0,
          discountedPrice: basePrice,
          shippingShare: 0,
          finalPrice: basePrice,
          isIgnored
        };
      }

      if (basePrice === null) {
        return {
          item,
          basePrice: null,
          discountAmount: 0,
          discountedPrice: null,
          shippingShare,
          finalPrice: null,
          isIgnored
        };
      }

      if (discountMode === 'percent') {
        const discount = calculatePercentDiscount(basePrice, discountNumber);

        return {
          item,
          basePrice,
          discountAmount: discount.discountAmount,
          discountedPrice: discount.discountedPrice,
          shippingShare,
          finalPrice: roundMoney(discount.discountedPrice + shippingShare),
          isIgnored
        };
      }

      const discountAmount = Math.min(basePrice, euroDiscountShare);
      const discountedPrice = Math.max(0, roundMoney(basePrice - discountAmount));

      return {
        item,
        basePrice,
        discountAmount,
        discountedPrice,
        shippingShare,
        finalPrice: roundMoney(discountedPrice + shippingShare),
        isIgnored
      };
    });
  }, [
    items,
    discountMode,
    discountNumber,
    euroDiscountShare,
    shippingShare
  ]);

  const activeRows = calculatedRows.filter((row) => !row.isIgnored);

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

  const ignoredCount = calculatedRows.filter((row) => row.isIgnored).length;

  const missingPriceCount = activeRows.filter(
    (row) => row.basePrice === null
  ).length;

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

  return (
    <main className="mx-auto max-w-7xl p-4 sm:p-6">
      <div className="mb-4 rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Carrello Medimops</h1>
            <p className="mt-2 text-slate-600">
              Simulazione carrello con sconto e spedizione Medimops
              ammortizzata sugli articoli attivi.
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
                ? 'Lo sconto percentuale viene applicato a ogni riga.'
                : 'Lo sconto in euro viene diviso sugli articoli attivi con prezzo Medimops.'}
            </span>
          </label>

          <div className="rounded-xl bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase text-slate-500">
              Spedizione Medimops
            </div>
            <div className="mt-1 text-xl font-bold">
              {formatEuro(shippingCost)}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {activeItemCount === 0
                ? 'Nessun articolo attivo'
                : `${activeItemCount} articoli attivi × ${formatEuro(
                    shippingShare
                  )} cad.`}
            </div>
          </div>

          <div className="rounded-xl bg-green-50 p-3">
            <div className="text-xs font-semibold uppercase text-green-700">
              Totale finale
            </div>
            <div className="mt-1 text-xl font-bold text-green-900">
              {formatEuro(totalFinal)}
            </div>
            <div className="mt-1 text-xs text-green-800">
              Prezzi scontati + spedizione
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-5">
          <div className="rounded-xl border p-3">
            <div className="text-xs font-semibold uppercase text-slate-500">
              Totale prezzi iniziali
            </div>
            <div className="mt-1 text-lg font-bold">
              {formatEuro(totalBase)}
            </div>
          </div>

          <div className="rounded-xl border p-3">
            <div className="text-xs font-semibold uppercase text-slate-500">
              Sconto totale applicato
            </div>
            <div className="mt-1 text-lg font-bold">
              {formatEuro(totalDiscount)}
            </div>
            {discountMode === 'euro' && activePriceItemCount > 0 && (
              <div className="mt-1 text-xs text-slate-500">
                {formatEuro(euroDiscountShare)} per articolo con prezzo
              </div>
            )}
          </div>

          <div className="rounded-xl border p-3">
            <div className="text-xs font-semibold uppercase text-slate-500">
              Totale scontato
            </div>
            <div className="mt-1 text-lg font-bold">
              {formatEuro(totalDiscounted)}
            </div>
          </div>

          <div className="rounded-xl border p-3">
            <div className="text-xs font-semibold uppercase text-slate-500">
              Articoli attivi
            </div>
            <div className="mt-1 text-lg font-bold">{activeItemCount}</div>
          </div>

          <div className="rounded-xl border p-3">
            <div className="text-xs font-semibold uppercase text-slate-500">
              Articoli ignorati
            </div>
            <div className="mt-1 text-lg font-bold">{ignoredCount}</div>
          </div>
        </div>

        {missingPriceCount > 0 && (
          <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            Attenzione: {missingPriceCount} articolo/i attivi non hanno ancora
            un prezzo Medimops rilevato. Quelle righe non entrano nei totali dei
            prezzi, ma contano ancora come articoli attivi per la spedizione.
          </div>
        )}
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-xl font-semibold">Articoli</h2>

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-100 text-left">
                <th className="border-b p-2">Azioni</th>
                <th className="border-b p-2">Stato</th>
                <th className="border-b p-2">Artista</th>
                <th className="border-b p-2">Titolo</th>
                <th className="border-b p-2">Label</th>
                <th className="border-b p-2">Prezzo Medimops</th>
                <th className="border-b p-2">Sconto riga</th>
                <th className="border-b p-2">Prezzo scontato</th>
                <th className="border-b p-2">Quota spedizione</th>
                <th className="border-b p-2">Prezzo finale articolo</th>
              </tr>
            </thead>

            <tbody>
              {calculatedRows.map((row) => (
                <tr
                  key={row.item.id}
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
                        onClick={() => handleToggleIgnored(row.item.id)}
                      >
                        {row.isIgnored ? 'Riattiva' : 'Ignora'}
                      </button>

                      <button
                        className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50"
                        onClick={() => handleRemove(row.item.id)}
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

                  <td className="p-2 font-medium">{row.item.artist}</td>
                  <td className="p-2">{row.item.album}</td>
                  <td className="p-2">{row.item.edition || '-'}</td>

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

              {calculatedRows.length === 0 && (
                <tr>
                  <td className="p-4 text-center text-slate-500" colSpan={10}>
                    Il carrello è vuoto. Torna alla dashboard e aggiungi qualche
                    disco.
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
