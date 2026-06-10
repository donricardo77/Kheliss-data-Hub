import { createContext, useContext, useState, useEffect, useCallback } from "react";

export interface CartItem {
  productId: string;
  network: "MTN" | "Telecel" | "AirtelTigo";
  name: string;
  description: string;
  userPrice: number;
  agentPrice: number;
  dataAmount: string;
  recipientPhone: string;
}

interface CartContextType {
  item: CartItem | null;
  setItem: (item: CartItem | null) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextType>({
  item: null,
  setItem: () => {},
  clearCart: () => {},
});

const CART_STORAGE_PREFIX = "cart_";

/**
 * Get cart storage key for a specific user
 * Users who aren't logged in get a "guest" key
 */
function getCartKey(userId?: string) {
  return userId ? `${CART_STORAGE_PREFIX}${userId}` : `${CART_STORAGE_PREFIX}guest`;
}

/**
 * Load cart from localStorage for a specific user
 */
function loadCartFromStorage(userId?: string): CartItem | null {
  try {
    const key = getCartKey(userId);
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

/**
 * Save cart to localStorage for a specific user
 */
function saveCartToStorage(userId: string | undefined, item: CartItem | null) {
  try {
    const key = getCartKey(userId);
    if (item) {
      localStorage.setItem(key, JSON.stringify(item));
    } else {
      localStorage.removeItem(key);
    }
  } catch {
    // Fail silently if localStorage is unavailable
  }
}

export function CartProvider({ children, userId }: { children: React.ReactNode; userId?: string }) {
  const [item, setItemState] = useState<CartItem | null>(() => {
    // Load cart for current user on mount
    return loadCartFromStorage(userId);
  });

  // Update localStorage whenever item changes
  useEffect(() => {
    saveCartToStorage(userId, item);
  }, [item, userId]);

  // Reload cart whenever userId changes (handles login/logout transitions)
  useEffect(() => {
    // When userId changes, always load the new user's cart
    // This handles both login/logout and switching between accounts
    const newCart = loadCartFromStorage(userId);
    setItemState(newCart);
  }, [userId]);
  
  // Force clear cart and localStorage when logging out (userId becomes undefined)
  useEffect(() => {
    if (userId === undefined) {
      setItemState(null);
      // Clear all user carts to prevent cross-contamination
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(CART_STORAGE_PREFIX)) {
          localStorage.removeItem(key);
        }
      });
    }
  }, [userId]);

  const setItem = useCallback((newItem: CartItem | null) => {
    setItemState(newItem);
  }, []);

  const clearCart = useCallback(() => {
    setItemState(null);
  }, []);

  return (
    <CartContext.Provider value={{ item, setItem, clearCart }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
