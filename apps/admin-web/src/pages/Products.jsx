import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api.js";

export default function Products() {
  const [products, setProducts] = useState([]);
  const [filter, setFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/products/manage", {
        params: { status: filter, limit: 200 },
      });
      setProducts(response.data.data.products);
    } catch (requestError) {
      setProducts([]);
      setError(requestError.response?.data?.message || requestError.message || "Unable to load products.");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  async function approveProduct(product) {
    setBusyId(product._id);
    setError("");
    setNotice("");
    try {
      await api.patch(`/products/${product._id}/approve`);
      setNotice(`${product.name} is approved and available in the customer catalogue.`);
      await loadProducts();
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || "Unable to approve product.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Product catalogue</h2>
          <p className="mt-1 text-sm text-gray-500">Review seller-submitted products before they appear to customers.</p>
        </div>
        <label className="text-sm font-medium">
          Show
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="ml-2 rounded-lg border border-gray-300 bg-white px-3 py-2"
          >
            <option value="pending">Pending approval</option>
            <option value="approved">Approved</option>
            <option value="all">All products</option>
          </select>
        </label>
      </div>

      {(error || notice) && (
        <p role={error ? "alert" : "status"} className={`mb-4 rounded-lg p-3 text-sm ${error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
          {error || notice}
        </p>
      )}

      {loading ? <p className="text-sm text-gray-500">Loading products...</p> : (
        <div className="space-y-3">
          {products.map((product) => (
            <article key={product._id} className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 sm:flex-row">
              {product.images?.[0] ? (
                <img src={product.images[0]} alt={product.name} className="h-24 w-24 rounded-lg bg-gray-100 object-cover" />
              ) : (
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xs text-gray-400">No image</div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{product.name}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${product.isApproved ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                    {product.isApproved ? "Approved" : "Pending"}
                  </span>
                  {!product.isActive && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">Inactive</span>}
                </div>
                <p className="mt-1 text-sm text-gray-600">{product.description || "No description"}</p>
                <p className="mt-2 text-xs text-gray-500">
                  Store: {product.store?.name || "Unknown"} · Category: {product.category?.name || "Unknown"}
                </p>
                <p className="mt-1 text-sm font-semibold">
                  ₹{product.price} · MRP ₹{product.mrp} · Stock {product.stock} {product.unit}
                </p>
              </div>
              {!product.isApproved && product.isActive && (
                <button
                  type="button"
                  onClick={() => approveProduct(product)}
                  disabled={busyId === product._id}
                  className="self-start rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {busyId === product._id ? "Approving..." : "Approve"}
                </button>
              )}
            </article>
          ))}
          {!products.length && <p className="rounded-xl bg-white p-8 text-center text-sm text-gray-500">No products match this filter.</p>}
        </div>
      )}
    </div>
  );
}
