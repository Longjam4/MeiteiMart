import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { useCartStore } from "../store/cartStore.js";
import { CATEGORY_IMAGES } from "../data/categories.js";

export default function StoreDetail() {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const addItem = useCartStore((s) => s.addItem);
  const items = useCartStore((s) => s.items);
  const cartCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const cartTotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    setStore(null);
    setProducts([]);
    Promise.all([
      api.get(`/stores/${storeId}`),
      api.get("/products", { params: { store: storeId, limit: 100 } }),
    ])
      .then(([storeResponse, productResponse]) => {
        if (cancelled) return;
        setStore(storeResponse.data.data.store);
        setProducts(productResponse.data.data.products);
      })
      .catch((error) => {
        if (cancelled) return;
        setStore(null);
        setProducts([]);
        setLoadError(error.response?.data?.message || error.message || "Unable to load this store.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  const cartHasOtherStore = items.length > 0 && items[0].store !== storeId;

  const categoryNames = [
    ...new Map(
      products.map((product) => {
        const category = product.category;
        const slug = typeof category === "object" ? category.slug : category;
        const categoryName = typeof category === "object" ? category.name : slug;
        return [slug, { slug, name: categoryName || slug }];
      })
    ).values(),
  ];

  const filteredProducts = products.filter((p) => {
    const productCategory = typeof p.category === "object" ? p.category.slug : p.category;
    const matchesCategory = activeCategory === "all" || productCategory === activeCategory;
    const matchesSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  function getQuantity(productId) {
    return items.find((i) => i.product === productId)?.quantity || 0;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-4 pb-24 sm:pb-8">
      {/* Breadcrumb */}
      <Link to="/" className="flex items-center gap-1 text-sm text-gray-500 hover:text-brand-600 mb-3 transition-colors">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to stores
      </Link>

      {loadError && (
        <div role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {loadError}
        </div>
      )}

      {/* Store header */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-4">
        <div className="h-40 sm:h-48 overflow-hidden relative">
          <img
            src={store?.logoUrl || ""}
            alt={store?.name}
            className="w-full h-full object-cover"
          />
          {store?.promo && (
            <div className="absolute top-3 left-3 bg-blue-600/90 text-white text-sm font-bold px-3 py-1.5 rounded-lg backdrop-blur-sm">
              {store.promo}
            </div>
          )}
        </div>
        <div className="p-4">
          <h1 className="text-2xl font-bold mb-1">{store?.name || "Store"}</h1>
          <p className="text-sm text-gray-500 mb-3">{store?.description || store?.tags?.join(" • ")}</p>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="flex items-center gap-1 font-semibold">
              <span className="bg-green-600 text-white px-1.5 py-0.5 rounded text-xs">★</span>
              {store?.rating?.toFixed(1) || "0.0"}
            </span>
            <span className="text-gray-300">|</span>
            <span className="text-gray-600">{store?.avgPrepTimeMinutes || 15} min prep</span>
            <span className="text-gray-300">|</span>
            <span className="text-gray-600">{store?.address?.city || "Local delivery"}</span>
            {store?.minOrderValue > 0 && (
              <>
                <span className="text-gray-300">|</span>
                <span className="text-gray-600">₹{store.minOrderValue} min order</span>
              </>
            )}
          </div>
        </div>
      </div>

      {cartHasOtherStore && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-sm text-amber-700">
          Your cart has items from a different store. Adding items here will replace your current cart.
        </div>
      )}

      {/* Search within store */}
      <div className="relative mb-4">
        <svg className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
        </svg>
        <input
          type="text"
          placeholder="Search in this store..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white border border-gray-200 rounded-xl pl-12 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      {/* Category filter tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4 pb-1">
        <button
          onClick={() => setActiveCategory("all")}
          className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            activeCategory === "all" ? "bg-brand-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-brand-300"
          }`}
        >
          All Items
        </button>
        {categoryNames.map((cat) => (
          <button
            key={cat.slug}
            onClick={() => setActiveCategory(cat.slug)}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              activeCategory === cat.slug ? "bg-brand-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-brand-300"
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Product list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 flex gap-4 animate-pulse">
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-full mb-1" />
                <div className="h-3 bg-gray-200 rounded w-1/4" />
              </div>
              <div className="w-24 h-24 bg-gray-200 rounded-xl" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredProducts.map((p) => {
            const qty = getQuantity(p._id);
            const discount = p.mrp && p.mrp > p.price ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : 0;
            return (
              <div key={p._id} className="bg-white rounded-xl border border-gray-100 p-4 flex gap-4 hover:shadow-md transition-shadow">
                <div className="flex-1">
                  <h3 className="font-semibold text-base mb-0.5">{p.name}</h3>
                  <p className="text-xs text-gray-500 mb-1.5 line-clamp-2">{p.description}</p>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base">₹{p.price}</span>
                    {discount > 0 && (
                      <>
                        <span className="text-xs text-gray-400 line-through">₹{p.mrp}</span>
                        <span className="text-xs text-green-600 font-semibold">{discount}% OFF</span>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{p.unit}</p>
                </div>
                <div className="relative shrink-0">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden bg-gray-100">
                    <img
                      src={p.images?.[0] || CATEGORY_IMAGES[p.category?.slug] || ""}
                      alt={p.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  {qty === 0 ? (
                    <button
                      onClick={() => addItem(p, storeId)}
                      disabled={p.stock <= 0}
                      className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-white border-2 border-brand-600 text-brand-600 font-bold text-sm px-5 py-1.5 rounded-xl shadow-sm hover:bg-brand-50 disabled:opacity-50 transition-colors whitespace-nowrap"
                    >
                      {p.stock <= 0 ? "OUT OF STOCK" : "ADD +"}
                    </button>
                  ) : (
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-brand-600 text-white font-bold text-sm rounded-xl shadow-sm flex items-center">
                      <button
                        onClick={() => useCartStore.getState().decrement(p._id)}
                        className="px-3 py-1.5 hover:bg-brand-700 rounded-l-xl transition-colors"
                      >
                        −
                      </button>
                      <span className="px-1 py-1.5 min-w-[24px] text-center">{qty}</span>
                      <button
                        onClick={() => addItem(p, storeId)}
                        disabled={qty >= p.stock}
                        className="px-3 py-1.5 hover:bg-brand-700 rounded-r-xl disabled:opacity-50 transition-colors"
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {filteredProducts.length === 0 && !loading && (
            <div className="text-center py-12">
              <p className="text-gray-500">No products found in this category.</p>
            </div>
          )}
        </div>
      )}

      {/* Floating cart bar (Swiggy-style) */}
      {cartCount > 0 && (
        <div className="fixed bottom-16 sm:bottom-4 left-4 right-4 sm:left-1/2 sm:-translate-x-1/2 sm:w-96 z-30 animate-slide-up">
          <button
            onClick={() => navigate("/cart")}
            className="w-full bg-brand-600 hover:bg-brand-700 text-white rounded-2xl px-5 py-3.5 flex items-center justify-between shadow-lg transition-colors"
          >
            <span className="font-semibold">
              {cartCount} item{cartCount > 1 ? "s" : ""} • ₹{cartTotal}
            </span>
            <span className="font-bold flex items-center gap-1">
              View Cart
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
