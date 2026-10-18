import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";
import { useGeolocation } from "../lib/useGeolocation.js";
import { CATEGORY_IMAGES } from "../data/categories.js";

const DEFAULT_LOCATION = { lat: 24.82, lng: 93.94 };

export default function Stores() {
  const { position, error: geoError } = useGeolocation();
  const [stores, setStores] = useState([]);
  const [categories, setCategories] = useState([]);
  const [services, setServices] = useState([]);
  const [serviceLoading, setServiceLoading] = useState(true);
  const [serviceError, setServiceError] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [storeError, setStoreError] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const [productResults, setProductResults] = useState([]);
  const [productSearchLoading, setProductSearchLoading] = useState(false);
  const [productSearchError, setProductSearchError] = useState("");
  const navigate = useNavigate();
  const location = position || DEFAULT_LOCATION;

  useEffect(() => {
    setLoading(true);
    setStoreError("");
    api
      .get("/stores/nearby", { params: { lat: location.lat, lng: location.lng, radiusKm: 15 } })
      .then((res) => {
        setStores(res.data.data.stores);
      })
      .catch((error) => {
        setStores([]);
        setStoreError(error.response?.data?.message || error.message || "Unable to load nearby stores.");
      })
      .finally(() => setLoading(false));
  }, [location.lat, location.lng]);

  useEffect(() => {
    let cancelled = false;
    api
      .get("/categories")
      .then((res) => {
        if (!cancelled) setCategories(res.data.data.categories);
      })
      .catch((error) => {
        if (!cancelled) {
          setCategories([]);
          setCategoryError(error.response?.data?.message || error.message || "Unable to load categories.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    api.get("/services")
      .then((res) => {
        if (!cancelled) setServices(res.data.data.services);
      })
      .catch((error) => {
        if (!cancelled) {
          setServices([]);
          setServiceError(error.response?.data?.message || error.message || "Unable to load services.");
        }
      })
      .finally(() => {
        if (!cancelled) setServiceLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const query = searchQuery.trim();
    if (!query) {
      setProductResults([]);
      setProductSearchError("");
      setProductSearchLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      setProductSearchLoading(true);
      setProductSearchError("");
      api
        .get("/products", { params: { search: query, limit: 8 }, signal: controller.signal })
        .then((res) => setProductResults(res.data.data.products))
        .catch((error) => {
          if (!controller.signal.aborted) {
            setProductResults([]);
            setProductSearchError(error.response?.data?.message || error.message || "Unable to search products.");
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setProductSearchLoading(false);
        });
    }, 250);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [searchQuery]);

  const filteredStores = searchQuery
    ? stores.filter(
        (s) =>
          s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.tags?.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : stores;

  return (
    <div className="max-w-6xl mx-auto px-4 py-4 pb-20 sm:pb-8">
      {/* Location bar */}
      <div className="flex items-center gap-2 mb-4 text-sm">
        <svg className="w-5 h-5 text-brand-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <circle cx="12" cy="11" r="2.5" />
        </svg>
        <div>
          <p className="font-semibold text-gray-900">Deliver to {position ? "Current Location" : "Imphal"}</p>
          <p className="text-xs text-gray-500">
            {geoError
              ? "Using Imphal as the delivery location"
              : position
                ? `${position.lat.toFixed(2)}, ${position.lng.toFixed(2)}`
                : "Checking your location; using Imphal meanwhile"}
          </p>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative mb-6">
        <svg className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
        </svg>
        <input
          type="text"
          placeholder="Search for stores, products..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white border border-gray-200 rounded-2xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent shadow-sm"
        />
      </div>

      {searchQuery.trim() && (
        <section className="mb-6 rounded-2xl border border-gray-100 bg-white p-4">
          <h2 className="mb-3 text-base font-bold">Matching products</h2>
          {productSearchLoading && <p className="text-sm text-gray-500">Searching products...</p>}
          {productSearchError && <p className="text-sm text-red-600">{productSearchError}</p>}
          {!productSearchLoading && !productSearchError && productResults.length === 0 && (
            <p className="text-sm text-gray-500">No matching products found.</p>
          )}
          <div className="space-y-2">
            {productResults.map((product) => (
              <Link
                key={product._id}
                to={`/stores/${product.store?._id}`}
                className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 p-3 hover:bg-brand-50"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{product.name}</span>
                  <span className="block truncate text-xs text-gray-500">{product.store?.name}</span>
                </span>
                <span className="shrink-0 font-bold text-brand-600">₹{product.price}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mb-8 rounded-2xl bg-[#16213a] p-5 text-white sm:p-7">
        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-orange-400">
          All-in-one online services platform
        </p>
        <h1 className="text-2xl font-extrabold sm:text-3xl">More than food delivery</h1>
        <p className="mb-5 mt-2 text-sm text-slate-300 sm:text-base">
          One app for everyday delivery, goods transport, event rentals and household help.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
          {serviceLoading && <p className="text-sm text-slate-300">Loading services...</p>}
          {serviceError && <p className="text-sm text-red-200">{serviceError}</p>}
          {!serviceLoading && !serviceError && services.length === 0 && (
            <p className="text-sm text-slate-300">No services are available right now.</p>
          )}
          {services.map((service) => (
            <article
              key={service._id}
              className="flex min-h-32 items-center gap-4 bg-white p-4 text-gray-900 shadow-md sm:p-5"
            >
              {service.imageUrl ? (
                <img src={service.imageUrl} alt="" className="h-14 w-14 shrink-0 object-cover shadow-md" />
              ) : (
                <span
                  className="flex h-14 w-14 shrink-0 items-center justify-center text-base font-extrabold text-white shadow-md"
                  style={{ backgroundColor: service.accent }}
                >
                  {service.number}
                </span>
              )}
              <div>
                <h2 className="text-base font-bold leading-snug sm:text-lg">{service.title}</h2>
                <p className="mt-2 text-xs leading-relaxed text-gray-600 sm:text-sm">
                  {service.description}
                </p>
                <p className="mt-2 text-xs font-bold" style={{ color: service.accent }}>
                  Booking: {service.booking}
                </p>
              </div>
            </article>
          ))}
        </div>
        <p className="mt-5 bg-slate-700/70 px-4 py-3 text-center text-xs font-semibold text-slate-200 sm:text-sm">
          Shared platform: customer app • provider app • payments • booking management • tracking • support
        </p>
      </section>

      {/* Category carousel */}
      <div className="mb-8">
        <h2 className="text-lg font-bold mb-3">Shop by Category</h2>
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
          {categories.map((cat) => (
            <Link
              key={cat.slug}
              to={`/category/${cat.slug}`}
              className="flex flex-col items-center gap-1.5 shrink-0 group"
            >
              <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gray-100 shadow-sm group-hover:shadow-md group-hover:scale-105 transition-all">
                <img
                  src={cat.imageUrl || CATEGORY_IMAGES[cat.slug] || ""}
                  alt={cat.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              <span className="text-xs font-medium text-gray-600 text-center w-16 leading-tight">
                {cat.name.split(" ")[0]}
              </span>
            </Link>
          ))}
          {categoryError && <p className="text-sm text-red-600">{categoryError}</p>}
          {!categoryError && categories.length === 0 && (
            <p className="text-sm text-gray-500">No categories are available yet.</p>
          )}
        </div>
      </div>

      {/* Promo banner */}
      <div className="mb-8 bg-gradient-to-r from-brand-500 to-brand-700 rounded-2xl p-6 text-white relative overflow-hidden">
        <div className="relative z-10">
          <p className="text-xs font-semibold uppercase tracking-wide opacity-90 mb-1">Quick Commerce</p>
          <h3 className="text-2xl font-bold mb-1">Groceries in 15 minutes</h3>
          <p className="text-sm opacity-90 mb-3">Daily essentials, fresh produce & more</p>
          <button
            onClick={() => navigate(stores[0] ? `/stores/${stores[0]._id}` : "/")}
            className="bg-white text-brand-700 font-semibold text-sm px-4 py-2 rounded-xl hover:bg-brand-50 transition-colors"
          >
            Order Now
          </button>
        </div>
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-20">
          <img
            src="https://images.pexels.com/photos/9705821/pexels-photo-9705821.jpeg?auto=compress&cs=tinysrgb&h=650&w=940"
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
      </div>

      {/* Stores section */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold">{searchQuery ? "Search Results" : "Stores Near You"}</h2>
        <span className="text-sm text-gray-500">{filteredStores.length} stores</span>
      </div>

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 animate-pulse">
              <div className="w-full h-32 bg-gray-200 rounded-xl mb-3" />
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-3 bg-gray-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {!loading && (
        storeError ? (
          <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{storeError}</p>
        ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStores.map((store) => (
            <Link
              key={store._id}
              to={`/stores/${store._id}`}
              className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg hover:border-brand-200 transition-all group"
            >
              <div className="relative h-36 overflow-hidden">
                <img
                  src={store.logoUrl || store.image || "https://images.pexels.com/photos/9705821/pexels-photo-9705821.jpeg?auto=compress&cs=tinysrgb&h=650&w=940"}
                  alt={store.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
                {store.promo && (
                  <div className="absolute top-2 left-2 bg-blue-600/90 text-white text-xs font-bold px-2 py-1 rounded-lg backdrop-blur-sm">
                    {store.promo}
                  </div>
                )}
                <div className="absolute bottom-2 right-2 bg-white/95 backdrop-blur-sm rounded-lg px-2 py-1 text-xs font-semibold text-gray-700 shadow-sm">
                  {store.etaMinutes ? `${store.etaMinutes} min` : "ETA unavailable"}
                </div>
              </div>
              <div className="p-3">
                <h3 className="font-bold text-base mb-0.5 group-hover:text-brand-600 transition-colors">{store.name}</h3>
                <p className="text-xs text-gray-500 mb-2 line-clamp-1">{store.description || store.tags?.join(" • ")}</p>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1 font-semibold text-gray-700">
                    <span className="text-green-600">★</span>
                    {store.rating?.toFixed(1) || "0.0"}
                    {store.ratingCount && <span className="text-gray-400 font-normal">({store.ratingCount > 999 ? `${(store.ratingCount / 1000).toFixed(1)}k` : store.ratingCount})</span>}
                  </span>
                  <span className="text-gray-300">•</span>
                  {Number.isFinite(store.distanceKm) && (
                    <>
                      <span className="text-gray-300">•</span>
                      <span className="text-gray-600">{store.distanceKm.toFixed(1)} km</span>
                    </>
                  )}
                  {store.minOrderValue > 0 && (
                    <>
                      <span className="text-gray-300">•</span>
                      <span className="text-gray-500">₹{store.minOrderValue} min</span>
                    </>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
        )
      )}

      {!loading && filteredStores.length === 0 && (
        <div className="text-center py-16">
          <p className="text-gray-500 text-lg">
            {searchQuery ? "No stores found matching your search." : "No stores are serving this location yet."}
          </p>
          <button onClick={() => setSearchQuery("")} className="text-brand-600 font-semibold mt-2 hover:underline">
            Clear search
          </button>
        </div>
      )}
    </div>
  );
}
