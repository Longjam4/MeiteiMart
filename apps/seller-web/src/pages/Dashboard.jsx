import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { useAuthStore } from "../store/authStore.js";
import { useNavigate } from "react-router-dom";

const EMPTY_STORE = {
  name: "",
  description: "",
  logoUrl: "",
  minOrderValue: 0,
  deliveryFee: 15,
  freeDeliveryThreshold: 199,
  avgPrepTimeMinutes: 15,
  address: {
    line1: "",
    city: "Imphal",
    state: "Manipur",
    postalCode: "",
    lat: 24.82,
    lng: 93.94,
  },
};

const EMPTY_PRODUCT = {
  name: "",
  slug: "",
  category: "",
  description: "",
  unit: "1 pc",
  mrp: "",
  price: "",
  stock: "",
  images: [],
};

async function uploadImage(file, folder) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("folder", folder);
  const response = await api.post("/uploads", formData);
  return response.data.data.url;
}

function getErrorMessage(error, fallback) {
  return error.response?.data?.message || error.message || fallback;
}

export default function Dashboard() {
  const [store, setStore] = useState(null);
  const [storeForm, setStoreForm] = useState(EMPTY_STORE);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [orders, setOrders] = useState([]);
  const [productForm, setProductForm] = useState(EMPTY_PRODUCT);
  const [editingProductId, setEditingProductId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingStore, setSavingStore] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [activeTab, setActiveTab] = useState("products");
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const storeResponse = await api.get("/stores/me");
      const currentStore = storeResponse.data.data.store;
      const [productResponse, orderResponse, categoryResponse] = await Promise.all([
        api.get("/products/mine"),
        api.get("/orders"),
        api.get("/categories"),
      ]);
      setStore(currentStore);
      setStoreForm({
        name: currentStore.name || "",
        description: currentStore.description || "",
        logoUrl: currentStore.logoUrl || "",
        minOrderValue: currentStore.minOrderValue ?? 0,
        deliveryFee: currentStore.deliveryFee ?? 15,
        freeDeliveryThreshold: currentStore.freeDeliveryThreshold ?? 199,
        avgPrepTimeMinutes: currentStore.avgPrepTimeMinutes ?? 15,
        address: {
          ...EMPTY_STORE.address,
          ...currentStore.address,
          lat: currentStore.address?.location?.coordinates?.[1] ?? EMPTY_STORE.address.lat,
          lng: currentStore.address?.location?.coordinates?.[0] ?? EMPTY_STORE.address.lng,
        },
      });
      setProducts(productResponse.data.data.products);
      setOrders(orderResponse.data.data.orders);
      setCategories(categoryResponse.data.data.categories);
    } catch (requestError) {
      if (requestError.response?.status === 404) {
        setStore(null);
      } else {
        setError(getErrorMessage(requestError, "Unable to load seller data."));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleImageUpload(event, target) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    setNotice("");
    setUploading(true);
    try {
      const imageUrl = await uploadImage(
        file,
        target === "store" ? "store-images" : "product-images"
      );
      if (target === "store") {
        setStoreForm((current) => ({ ...current, logoUrl: imageUrl }));
      } else {
        setProductForm((current) => ({ ...current, images: [...current.images, imageUrl] }));
      }
      setNotice("Image uploaded. Save the form to publish it.");
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Image upload failed."));
    } finally {
      setUploading(false);
    }
  }

  function updateAddress(field, value) {
    setStoreForm((current) => ({
      ...current,
      address: { ...current.address, [field]: value },
    }));
  }

  async function saveStore(event) {
    event.preventDefault();
    setSavingStore(true);
    setError("");
    setNotice("");
    const payload = {
      ...storeForm,
      deliveryFee: Number(storeForm.deliveryFee),
      freeDeliveryThreshold: Number(storeForm.freeDeliveryThreshold),
      minOrderValue: Number(storeForm.minOrderValue),
      avgPrepTimeMinutes: Number(storeForm.avgPrepTimeMinutes),
      address: {
        ...storeForm.address,
        lat: Number(storeForm.address.lat),
        lng: Number(storeForm.address.lng),
      },
    };
    try {
      if (store) {
        await api.patch("/stores/me", payload);
        setNotice("Store details and delivery pricing saved.");
      } else {
        await api.post("/stores", payload);
        setNotice("Store submitted for admin approval.");
      }
      await load();
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Unable to save store details."));
    } finally {
      setSavingStore(false);
    }
  }

  function startProductEdit(product) {
    setEditingProductId(product._id);
    setProductForm({
      name: product.name,
      slug: product.slug,
      category: product.category?._id || product.category || "",
      description: product.description || "",
      unit: product.unit || "1 pc",
      mrp: String(product.mrp),
      price: String(product.price),
      stock: String(product.stock),
      images: product.images || [],
    });
    setError("");
    setNotice("");
    setActiveTab("products");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetProductForm() {
    setEditingProductId(null);
    setProductForm(EMPTY_PRODUCT);
  }

  async function saveProduct(event) {
    event.preventDefault();
    setSavingProduct(true);
    setError("");
    setNotice("");
    const payload = {
      ...productForm,
      slug: productForm.slug.trim().toLowerCase().replace(/\s+/g, "-"),
      mrp: Number(productForm.mrp),
      price: Number(productForm.price),
      stock: Number(productForm.stock),
    };
    try {
      if (editingProductId) {
        await api.patch(`/products/${editingProductId}`, payload);
        setNotice("Product updated. It will be visible to customers after admin approval if required.");
      } else {
        await api.post("/products", payload);
        setNotice("Product submitted. An admin must approve it before customers can see it.");
      }
      resetProductForm();
      await load();
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Unable to save product."));
    } finally {
      setSavingProduct(false);
    }
  }

  async function deactivateProduct(product) {
    if (!window.confirm(`Remove "${product.name}" from sale?`)) return;
    setError("");
    setNotice("");
    try {
      await api.delete(`/products/${product._id}`);
      setNotice("Product removed from the customer catalogue.");
      await load();
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Unable to remove product."));
    }
  }

  async function handleLogout() {
    try {
      await api.post("/auth/logout");
    } finally {
      logout();
      navigate("/login");
    }
  }

  if (loading) {
    return <div className="mx-auto max-w-5xl p-6 text-sm text-gray-500">Loading seller dashboard...</div>;
  }

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-700">Seller Dashboard</h1>
          <p className="text-sm text-gray-500">Manage store information, products, and orders.</p>
        </div>
        <button type="button" onClick={handleLogout} className="text-sm text-red-600">Sign out</button>
      </header>

      {(error || notice) && (
        <p role={error ? "alert" : "status"} className={`mb-4 rounded-lg p-3 text-sm ${error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
          {error || notice}
        </p>
      )}

      {!store ? (
        <StoreForm
          storeForm={storeForm}
          setStoreForm={setStoreForm}
          updateAddress={updateAddress}
          handleImageUpload={handleImageUpload}
          uploading={uploading}
          saving={savingStore}
          onSubmit={saveStore}
        />
      ) : (
        <>
          <section className="mb-6 flex flex-wrap items-center gap-4 rounded-xl border border-gray-200 bg-white p-4">
            {store.logoUrl ? <img src={store.logoUrl} alt="" className="h-16 w-16 rounded-lg object-cover" /> : null}
            <div>
              <h2 className="font-semibold">{store.name}</h2>
              <p className="text-sm text-gray-500">{store.address?.city || "Set store location"} · {store.status}</p>
            </div>
            <p className={`ml-auto rounded-full px-3 py-1 text-xs font-semibold ${store.status === "APPROVED" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
              {store.status === "APPROVED" ? "Customer-visible" : "Awaiting admin approval"}
            </p>
          </section>

          <div className="mb-5 flex gap-2 border-b border-gray-200">
            {[
              ["products", `Products (${products.length})`],
              ["store", "Store & delivery settings"],
              ["orders", `Orders (${orders.length})`],
            ].map(([tab, label]) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`border-b-2 px-3 py-2 text-sm font-medium ${activeTab === tab ? "border-brand-600 text-brand-700" : "border-transparent text-gray-500"}`}
              >
                {label}
              </button>
            ))}
          </div>

          {activeTab === "store" && (
            <StoreForm
              storeForm={storeForm}
              setStoreForm={setStoreForm}
              updateAddress={updateAddress}
              handleImageUpload={handleImageUpload}
              uploading={uploading}
              saving={savingStore}
              onSubmit={saveStore}
              editing
            />
          )}

          {activeTab === "products" && (
            <>
              <form onSubmit={saveProduct} className="mb-6 grid gap-3 rounded-xl border border-gray-200 bg-white p-5 sm:grid-cols-2">
                <h2 className="text-lg font-semibold sm:col-span-2">{editingProductId ? "Edit product" : "Add a product"}</h2>
                <label className="text-sm font-medium">
                  Product name
                  <input
                    required minLength={2} value={productForm.name}
                    onChange={(event) => setProductForm({ ...productForm, name: event.target.value, slug: editingProductId ? productForm.slug : event.target.value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") })}
                    className="mt-1 w-full rounded-lg border px-3 py-2 font-normal"
                  />
                </label>
                <label className="text-sm font-medium">
                  URL slug
                  <input required value={productForm.slug} onChange={(event) => setProductForm({ ...productForm, slug: event.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" />
                </label>
                <label className="text-sm font-medium">
                  Category
                  <select required value={productForm.category} onChange={(event) => setProductForm({ ...productForm, category: event.target.value })} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 font-normal">
                    <option value="">Choose a category</option>
                    {categories.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}
                  </select>
                </label>
                <label className="text-sm font-medium">
                  Unit / pack size
                  <input required value={productForm.unit} onChange={(event) => setProductForm({ ...productForm, unit: event.target.value })} placeholder="500 g, 1 L, 1 pc" className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" />
                </label>
                <label className="text-sm font-medium">
                  MRP (₹)
                  <input required type="number" min="0.01" step="0.01" value={productForm.mrp} onChange={(event) => setProductForm({ ...productForm, mrp: event.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" />
                </label>
                <label className="text-sm font-medium">
                  Selling price (₹)
                  <input required type="number" min="0.01" step="0.01" value={productForm.price} onChange={(event) => setProductForm({ ...productForm, price: event.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" />
                </label>
                <label className="text-sm font-medium">
                  Stock quantity
                  <input required type="number" min="0" step="1" value={productForm.stock} onChange={(event) => setProductForm({ ...productForm, stock: event.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" />
                </label>
                <label className="text-sm font-medium sm:col-span-2">
                  Description
                  <textarea value={productForm.description} onChange={(event) => setProductForm({ ...productForm, description: event.target.value })} rows={2} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" />
                </label>
                <div className="sm:col-span-2">
                  <label className="text-sm font-medium">
                    Product photos
                    <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => handleImageUpload(event, "product")} className="mt-1 block w-full rounded-lg border px-3 py-2 font-normal" />
                  </label>
                  {uploading && <p className="mt-1 text-xs text-gray-500">Uploading image...</p>}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {productForm.images.map((url) => (
                      <div key={url} className="relative">
                        <img src={url} alt="Product preview" className="h-20 w-20 rounded-lg object-cover" />
                        <button type="button" onClick={() => setProductForm((current) => ({ ...current, images: current.images.filter((image) => image !== url) }))} className="absolute -right-2 -top-2 rounded-full bg-white px-1.5 text-sm text-red-600 shadow">×</button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 sm:col-span-2">
                  <button disabled={savingProduct || uploading || !categories.length} className="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white disabled:opacity-50">
                    {savingProduct ? "Saving..." : editingProductId ? "Save product" : "Submit product"}
                  </button>
                  {editingProductId && <button type="button" onClick={resetProductForm} className="rounded-lg border px-4 py-2">Cancel</button>}
                  {!categories.length && <p className="self-center text-xs text-amber-700">An admin must add a category before products can be listed.</p>}
                </div>
                {!editingProductId && <p className="text-xs text-gray-500 sm:col-span-2">New products are reviewed by an admin before they appear in customer searches.</p>}
              </form>

              <div className="space-y-3">
                {products.map((product) => (
                  <article key={product._id} className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-4">
                    {product.images?.[0] ? <img src={product.images[0]} alt="" className="h-16 w-16 rounded-lg object-cover" /> : <div className="h-16 w-16 rounded-lg bg-gray-100" />}
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium">{product.name}</h3>
                      <p className="text-xs text-gray-500">{product.category?.name} · {product.unit} · Stock {product.stock} · ₹{product.price}</p>
                      <p className={`mt-1 text-xs font-medium ${!product.isActive ? "text-gray-500" : product.isApproved ? "text-green-700" : "text-amber-700"}`}>
                        {!product.isActive ? "Removed from sale" : product.isApproved ? "Approved and visible to customers" : "Awaiting admin approval"}
                      </p>
                    </div>
                    {product.isActive && (
                      <>
                        <button type="button" onClick={() => startProductEdit(product)} className="rounded-md border px-3 py-1.5 text-sm">Edit</button>
                        <button type="button" onClick={() => deactivateProduct(product)} className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600">Remove</button>
                      </>
                    )}
                  </article>
                ))}
                {!products.length && <p className="rounded-xl bg-white p-8 text-center text-sm text-gray-500">No products yet. Add your first product above.</p>}
              </div>
            </>
          )}

          {activeTab === "orders" && (
            <div className="space-y-2">
              {orders.map((order) => (
                <article key={order._id} className="flex justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4">
                  <div>
                    <p className="font-medium">{order.orderNumber}</p>
                    <p className="text-xs text-gray-500">{order.items?.length || 0} items · ₹{order.grandTotal}</p>
                  </div>
                  <span className="text-sm font-semibold text-brand-700">{order.status}</span>
                </article>
              ))}
              {!orders.length && <p className="rounded-xl bg-white p-8 text-center text-sm text-gray-500">No orders for this store yet.</p>}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StoreForm({ storeForm, setStoreForm, updateAddress, handleImageUpload, uploading, saving, onSubmit, editing = false }) {
  return (
    <form onSubmit={onSubmit} className="grid max-w-3xl gap-4 rounded-xl border border-gray-200 bg-white p-5 sm:grid-cols-2">
      <h2 className="text-lg font-semibold sm:col-span-2">{editing ? "Store and delivery settings" : "Set up your store"}</h2>
      <label className="text-sm font-medium">
        Store name
        <input required minLength={2} value={storeForm.name} onChange={(event) => setStoreForm({ ...storeForm, name: event.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" />
      </label>
      <label className="text-sm font-medium">
        Description
        <input value={storeForm.description} onChange={(event) => setStoreForm({ ...storeForm, description: event.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" />
      </label>
      <label className="text-sm font-medium sm:col-span-2">
        Store logo / cover image
        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => handleImageUpload(event, "store")} className="mt-1 block w-full rounded-lg border px-3 py-2 font-normal" />
        {uploading && <span className="mt-1 block text-xs text-gray-500">Uploading image...</span>}
        {storeForm.logoUrl && <img src={storeForm.logoUrl} alt="Store preview" className="mt-2 h-24 w-36 rounded-lg object-cover" />}
      </label>

      <h3 className="font-medium sm:col-span-2">Pickup and delivery location</h3>
      <label className="text-sm font-medium sm:col-span-2">
        Street address
        <input required minLength={3} value={storeForm.address.line1} onChange={(event) => updateAddress("line1", event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" />
      </label>
      <label className="text-sm font-medium">
        City
        <input required value={storeForm.address.city} onChange={(event) => updateAddress("city", event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" />
      </label>
      <label className="text-sm font-medium">
        State
        <input required value={storeForm.address.state} onChange={(event) => updateAddress("state", event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" />
      </label>
      <label className="text-sm font-medium">
        PIN code
        <input required minLength={4} value={storeForm.address.postalCode} onChange={(event) => updateAddress("postalCode", event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" />
      </label>
      <label className="text-sm font-medium">
        Latitude
        <input required type="number" step="any" min="-90" max="90" value={storeForm.address.lat} onChange={(event) => updateAddress("lat", event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" />
      </label>
      <label className="text-sm font-medium">
        Longitude
        <input required type="number" step="any" min="-180" max="180" value={storeForm.address.lng} onChange={(event) => updateAddress("lng", event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" />
      </label>

      <h3 className="font-medium sm:col-span-2">Delivery settings</h3>
      <label className="text-sm font-medium">
        Minimum order value (₹)
        <input required type="number" min="0" step="0.01" value={storeForm.minOrderValue} onChange={(event) => setStoreForm({ ...storeForm, minOrderValue: event.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" />
      </label>
      <label className="text-sm font-medium">
        Delivery fee (₹)
        <input required type="number" min="0" step="0.01" value={storeForm.deliveryFee} onChange={(event) => setStoreForm({ ...storeForm, deliveryFee: event.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" />
      </label>
      <label className="text-sm font-medium">
        Free delivery from (₹)
        <input required type="number" min="0" step="0.01" value={storeForm.freeDeliveryThreshold} onChange={(event) => setStoreForm({ ...storeForm, freeDeliveryThreshold: event.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" />
      </label>
      <label className="text-sm font-medium">
        Average preparation time (minutes)
        <input required type="number" min="1" step="1" value={storeForm.avgPrepTimeMinutes} onChange={(event) => setStoreForm({ ...storeForm, avgPrepTimeMinutes: event.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" />
      </label>
      <button disabled={saving || uploading} className="self-end rounded-lg bg-brand-600 px-4 py-2 font-medium text-white disabled:opacity-50">
        {saving ? "Saving..." : editing ? "Save store settings" : "Submit store for approval"}
      </button>
      {!editing && <p className="text-xs text-gray-500 sm:col-span-2">Your store and its products become customer-visible after admin approval.</p>}
    </form>
  );
}
