export type CartItem = {
  id: string;
  type: 'CD' | 'LP';
  artist: string;
  album: string;
  edition: string | null;
  ean_code: string | null;
  medimops_url: string | null;
  medimops_current_price: number | null;
};

export const CART_STORAGE_KEY = 'music-price-monitor-cart-v1';

function isBrowser() {
  return typeof window !== 'undefined';
}

export function getCartItems(): CartItem[] {
  if (!isBrowser()) return [];

  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);

    if (!raw) return [];

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item) => {
      return (
        item &&
        typeof item.id === 'string' &&
        typeof item.artist === 'string' &&
        typeof item.album === 'string'
      );
    }) as CartItem[];
  } catch {
    return [];
  }
}

export function saveCartItems(items: CartItem[]) {
  if (!isBrowser()) return;

  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event('music-price-monitor-cart-updated'));
}

export function addCartItem(item: CartItem) {
  const current = getCartItems();
  const alreadyExists = current.some((cartItem) => cartItem.id === item.id);

  if (alreadyExists) {
    return current;
  }

  const next = [...current, item];

  saveCartItems(next);

  return next;
}

export function removeCartItem(id: string) {
  const current = getCartItems();
  const next = current.filter((item) => item.id !== id);

  saveCartItems(next);

  return next;
}

export function clearCartItems() {
  saveCartItems([]);

  return [];
}

export function isItemInCart(id: string) {
  return getCartItems().some((item) => item.id === id);
}
