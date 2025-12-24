import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const KEY = 'aw_cart_v1';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch {}
  }, [items]);

  // item shape:
  // { productId, productName, preorder, variantId, size, color, price, qty, imageUrl? }
  const add = (entry) => {
    setItems(prev => {
      const idx = prev.findIndex(x =>
        x.productId === entry.productId &&
        x.variantId === entry.variantId &&
        String(x.size||'') === String(entry.size||'') &&
        String(x.color||'') === String(entry.color||'')
      );
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + entry.qty };
        return next;
      }
      return [...prev, entry];
    });
  };

  const setQty = (i, qty) => {
    setItems(prev => {
      const next = [...prev];
      if (qty <= 0) next.splice(i,1);
      else next[i] = { ...next[i], qty };
      return next;
    });
  };

  const removeAt = (i) => setItems(prev => prev.filter((_,idx)=>idx!==i));
  const clear = () => setItems([]);

  const totals = useMemo(() => ({
    count: items.reduce((s,x)=>s+x.qty,0),
    amount: items.reduce((s,x)=>s + Number(x.price||0)*Number(x.qty||0), 0)
  }), [items]);

  // แปลงเป็น payload สำหรับ backend
  const toOrderItems = () => items.map(x => ({
    product: x.productId,            // <- สำคัญ
    productName: x.productName,      // เผื่อแสดงฝั่งหลังบ้าน
    size: x.size,
    color: x.color,
    price: Number(x.price||0),
    qty: Number(x.qty||0)
  }));

  const value = { items, add, setQty, removeAt, clear, totals, toOrderItems };
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);