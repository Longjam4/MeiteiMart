import { create } from "zustand";

export const useCartStore = create((set) => ({
  items: [],
  addItem: (product, storeId) =>
    set((state) => {
      const existing = state.items.find((item) => item.product === product._id);
      if (existing) {
        return {
          items: state.items.map((item) =>
            item.product === product._id ? { ...item, quantity: item.quantity + 1 } : item
          ),
        };
      }
      return {
        items: [
          ...state.items,
          {
            product: product._id,
            name: product.name,
            price: product.price,
            unit: product.unit,
            quantity: 1,
            store: storeId,
            image: product.images?.[0] || "",
            stock: product.stock,
          },
        ],
      };
    }),
  decrement: (productId) =>
    set((state) => {
      const existing = state.items.find((item) => item.product === productId);
      if (!existing) return state;
      if (existing.quantity <= 1) {
        return { items: state.items.filter((item) => item.product !== productId) };
      }
      return {
        items: state.items.map((item) =>
          item.product === productId ? { ...item, quantity: item.quantity - 1 } : item
        ),
      };
    }),
  removeItem: (productId) =>
    set((state) => ({ items: state.items.filter((item) => item.product !== productId) })),
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
  clear: () => set({ items: [] }),
}));
