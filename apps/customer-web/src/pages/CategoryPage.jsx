import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { CATEGORY_IMAGES } from "../data/categories.js";

export default function CategoryPage() {
  const { slug } = useParams();
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setProducts([]);
    setStores([]);
    setCategories([]);
    Promise.all([
      api.get("/categories"),
      api.get("/products", { params: { category: slug, limit: 100 } }),
    ])
      .then(([categoryResponse, productResponse]) => {
        if (cancelled) return;
        const nextProducts = productResponse.data.data.products;
        const uniqueStores = new Map();
        nextProducts.forEach((product) => {
          const store = product.store;
          if (store?._id) uniqueStores.set(store._id, store);
        });
        setCategories(categoryResponse.data.data.categories);
        setProducts(nextProducts);
        setStores([...uniqueStores.values()]);
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(requestError.response?.data?.message || requestError.message || "Unable to load this category.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const category = categories.find((item) => item.slug === slug);
  const categoryName = category?.name || "Category";
  const storeCount = stores.length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-4 pb-20 sm:pb-8">
      <Link to="/" className="flex items-center gap-1 text-sm text-gray-500 hover:text-brand-600 mb-3 transition-colors">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to home
      </Link>

      {/* Category banner */}
      <div className="relative h-40 rounded-2xl overflow-hidden mb-6">
        <img
          src={category?.imageUrl || CATEGORY_IMAGES[slug] || ""}
          alt={categoryName}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-4 left-4 text-white">
          <p className="text-3xl mb-1">🛍️</p>
          <h1 className="text-2xl font-bold">{categoryName}</h1>
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold">Stores with {categoryName.toLowerCase()}</h2>
        {!loading && <span className="text-sm text-gray-500">{storeCount} stores</span>}
      </div>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {loading && <p className="py-8 text-center text-sm text-gray-500">Loading category...</p>}
      {!loading && !error && products.length === 0 && (
        <p className="rounded-xl bg-white p-8 text-center text-sm text-gray-500">
          No products are currently available in this category.
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stores.map((store) => (
          <Link
            key={store._id}
            to={`/stores/${store._id}`}
            className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg hover:border-brand-200 transition-all group"
          >
            <div className="relative h-32 overflow-hidden">
              <img
                src={store.logoUrl || category?.imageUrl || CATEGORY_IMAGES[slug] || ""}
                alt={store.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
              {store.promo && (
                <div className="absolute top-2 left-2 bg-blue-600/90 text-white text-xs font-bold px-2 py-1 rounded-lg backdrop-blur-sm">
                  {store.promo}
                </div>
              )}
            </div>
            <div className="p-3">
              <h3 className="font-bold text-base mb-0.5 group-hover:text-brand-600 transition-colors">{store.name}</h3>
              <p className="text-xs text-gray-500 mb-2 line-clamp-1">{store.description}</p>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1 font-semibold">
                  <span className="text-green-600">★</span>
                  {store.rating?.toFixed(1)}
                </span>
                <span className="text-gray-300">•</span>
                <span className="text-gray-600">{store.avgPrepTimeMinutes || 15} min prep</span>
                <span className="text-gray-300">•</span>
                <span className="text-gray-600">{store.address?.city || "Delivery available"}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
