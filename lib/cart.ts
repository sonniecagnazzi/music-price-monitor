export type CartItem = {
  id: string;
  type: 'CD' | 'LP';
  artist: string;
  album: string;
  edition: string | null;
  ean_code: string | null;
  medimops_url: string | null;
  medimops_current_price: number | null;
  is_ignored?: boolean;
};

export const CART_STORAGE_KEY = 'music-price-monitor-cart-v1';

type GetCartItemsOptions = {
  includeIgnored?: boolean;
};

function isBrowser() {
  return typeof window !== 'undefined';
}

function normalizeCartItem(item: CartItem): CartItem {
  return {
    id: item.id,
    type: item.type,
    artist: item.artist,
    album: item.album,
    edition: item.edition ?? null,
    ean_code: item.ean_code ?? null,
    medimops_url: item.medimops_url ?? null,
    medimops_current_price: item.medimops_current_price ?? null,
    is_ignored: Boolean(item.is_ignored)
  };
}

export function getCartItems(options: GetCartItemsOptions = {}): CartItem[] {
  if (!isBrowser()) return [];

  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);

    if (!raw) return [];

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) return [];

    const normalizedItems = parsed
      .filter((item) => {
        return (
          item &&
          typeof item.id === 'string' &&
          typeof item.artist === 'string' &&
          typeof item.album === 'string'
        );
      })
      .map((item) => normalizeCartItem(item as CartItem));

    if (options.includeIgnored) {
      return normalizedItems;
    }

    return normalizedItems.filter((item) => !item.is_ignored);
  } catch {
    return [];
  }
}

export function saveCartItems(items: CartItem[]) {
  if (!isBrowser()) return;

  const normalizedItems = items.map(normalizeCartItem);

  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(normalizedItems));
  window.dispatchEvent(new Event('music-price-monitor-cart-updated'));
}

export function addCartItem(item: CartItem) {
  const current = getCartItems({ includeIgnored: true });
  const alreadyExists = current.some((cartItem) => cartItem.id === item.id);

  if (alreadyExists) {
    return current;
  }

  const next = [
    ...current,
    normalizeCartItem({
      ...item,
      is_ignored: false
    })
  ];

  saveCartItems(next);

  return next;
}

export function removeCartItem(id: string) {
  const current = getCartItems({ includeIgnored: true });
  const next = current.filter((item) => item.id !== id);

  saveCartItems(next);

  return next;
}

export function toggleCartItemIgnored(id: string) {
  const current = getCartItems({ includeIgnored: true });

  const next = current.map((item) => {
    if (item.id !== id) return item;

    return {
      ...item,
      is_ignored: !item.is_ignored
    };
  });

  saveCartItems(next);

  return next;
}

export function clearCartItems() {
  saveCartItems([]);

  return [];
}

export function isItemInCart(id: string) {
  return getCartItems({ includeIgnored: true }).some((item) => item.id === id);
}
