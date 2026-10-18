import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],
      addItem: (product, storeId) =>
        set((state) => {
          const isDifferentStore = state.items.length > 0 && state.items[0].store !== storeId;
          const baseItems = isDifferentStore ? [] : state.items;

          const existing = baseItems.find((i) => i.product === product._id);
          if (existing) {
            return {
              items: baseItems.map((i) =>
                i.product === product._id ? { ...i, quantity: i.quantity + 1 } : i
              ),
            };
          }
          return {
            items: [
              ...baseItems,
              { product: product._id, name: product.name, price: product.price, unit: product.unit, quantity: 1, store: storeId, image: product.images?.[0] },
            ],
          };
        }),
      syncProducts: (products) =>
        set((state) => {
          const productsById = new Map(products.map((product) => [product._id, product]));
          return {
            items: state.items.map((item) => {
              const product = productsById.get(item.product);
              if (!product) return item;
              return {
                ...item,
                name: product.name,
                price: product.price,
                unit: product.unit,
                image: product.images?.[0] || "",
                stock: product.stock,
              };
            }),
          };
        }),
      decrement: (productId) =>
        set((state) => {
          const existing = state.items.find((i) => i.product === productId);
          if (!existing) return state;
          if (existing.quantity <= 1) {
            return { items: state.items.filter((i) => i.product !== productId) };
          }
          return {
            items: state.items.map((i) =>
              i.product === productId ? { ...i, quantity: i.quantity - 1 } : i
            ),
          };
        }),
      removeItem: (productId) => set((state) => ({ items: state.items.filter((i) => i.product !== productId) })),
      clear: () => set({ items: [] }),
      total: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
      itemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    { name: "meiteimart-customer-cart" }
  )
);
