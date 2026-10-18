import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api.js";

const EMPTY_SERVICE = {
  number: "",
  slug: "",
  title: "",
  description: "",
  booking: "",
  accent: "#158a49",
  imageUrl: "",
  sortOrder: 0,
};

async function uploadImage(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("folder", "service-images");
  const response = await api.post("/uploads", formData);
  return response.data.data.url;
}

export default function Services() {
  const [services, setServices] = useState([]);
  const [form, setForm] = useState(EMPTY_SERVICE);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadServices = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/services/manage");
      setServices(response.data.data.services);
    } catch (requestError) {
      setServices([]);
      setError(requestError.response?.data?.message || requestError.message || "Unable to load services.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  function editService(service) {
    setEditingId(service._id);
    setForm({
      number: service.number,
      slug: service.slug,
      title: service.title,
      description: service.description || "",
      booking: service.booking || "",
      accent: service.accent || "#158a49",
      imageUrl: service.imageUrl || "",
      sortOrder: service.sortOrder || 0,
    });
    setError("");
    setNotice("");
  }

  async function handleImage(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const imageUrl = await uploadImage(file);
      setForm((current) => ({ ...current, imageUrl }));
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || "Image upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function saveService(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    const payload = {
      ...form,
      slug: form.slug.trim().toLowerCase().replace(/\s+/g, "-"),
      sortOrder: Number(form.sortOrder) || 0,
    };
    try {
      if (editingId) {
        await api.patch(`/services/${editingId}`, payload);
        setNotice("Service updated. Customers will see the new content.");
      } else {
        await api.post("/services", payload);
        setNotice("Service added to the customer home.");
      }
      setEditingId(null);
      setForm(EMPTY_SERVICE);
      await loadServices();
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || "Unable to save service.");
    } finally {
      setSaving(false);
    }
  }

  async function deactivateService(service) {
    if (!window.confirm(`Hide "${service.title}" from customers?`)) return;
    setError("");
    setNotice("");
    try {
      await api.delete(`/services/${service._id}`);
      setNotice("Service hidden from the customer home.");
      await loadServices();
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || "Unable to deactivate service.");
    }
  }

  async function activateService(service) {
    setError("");
    setNotice("");
    try {
      await api.patch(`/services/${service._id}`, { isActive: true });
      setNotice("Service is visible on the customer home.");
      await loadServices();
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || "Unable to activate service.");
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold">Customer home services</h2>
        <p className="mt-1 text-sm text-gray-500">Edit the service cards and images displayed in the customer apps.</p>
      </div>
      {(error || notice) && <p role={error ? "alert" : "status"} className={`mb-4 rounded-lg p-3 text-sm ${error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>{error || notice}</p>}

      <form onSubmit={saveService} className="mb-8 grid gap-4 rounded-xl border border-gray-200 bg-white p-5 md:grid-cols-2">
        <h3 className="text-lg font-semibold md:col-span-2">{editingId ? "Edit service" : "Add service"}</h3>
        <label className="text-sm font-medium">Number
          <input required value={form.number} onChange={(event) => setForm({ ...form, number: event.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" placeholder="01" />
        </label>
        <label className="text-sm font-medium">URL slug
          <input required pattern="[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*" value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" placeholder="goods-home-delivery" />
        </label>
        <label className="text-sm font-medium md:col-span-2">Title
          <input required minLength={2} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" />
        </label>
        <label className="text-sm font-medium md:col-span-2">Description
          <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={2} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" />
        </label>
        <label className="text-sm font-medium">Booking label
          <input value={form.booking} onChange={(event) => setForm({ ...form, booking: event.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" placeholder="Per order" />
        </label>
        <label className="text-sm font-medium">Accent color
          <input type="color" value={form.accent} onChange={(event) => setForm({ ...form, accent: event.target.value })} className="mt-1 block h-10 w-20 rounded border p-1" />
        </label>
        <label className="text-sm font-medium">Display order
          <input type="number" min="0" value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: event.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" />
        </label>
        <label className="text-sm font-medium">Service image
          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleImage} className="mt-1 block w-full rounded-lg border px-3 py-2 font-normal" />
          {uploading && <span className="mt-1 block text-xs text-gray-500">Uploading image...</span>}
          {form.imageUrl && <img src={form.imageUrl} alt="Service preview" className="mt-2 h-24 w-36 rounded-lg object-cover" />}
        </label>
        <div className="flex items-end gap-2">
          <button disabled={saving || uploading} className="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white disabled:opacity-50">{saving ? "Saving..." : editingId ? "Save changes" : "Add service"}</button>
          {editingId && <button type="button" onClick={() => { setEditingId(null); setForm(EMPTY_SERVICE); }} className="rounded-lg border px-4 py-2">Cancel</button>}
        </div>
      </form>

      {loading ? <p className="text-sm text-gray-500">Loading services...</p> : (
        <div className="grid gap-4 md:grid-cols-2">
          {services.map((service) => (
            <article key={service._id} className="flex gap-4 rounded-xl border border-gray-200 bg-white p-4">
              {service.imageUrl ? <img src={service.imageUrl} alt="" className="h-20 w-20 shrink-0 rounded-lg object-cover" /> : (
                <span className="flex h-14 w-14 shrink-0 items-center justify-center self-center font-bold text-white" style={{ backgroundColor: service.accent }}>{service.number}</span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-400">{service.number} · {service.slug}</p>
                <h3 className="font-semibold">{service.title}</h3>
                {!service.isActive && <p className="text-xs font-semibold text-amber-700">Hidden from customers</p>}
                <p className="mt-1 text-sm text-gray-600">{service.description}</p>
                <p className="mt-2 text-xs font-semibold" style={{ color: service.accent }}>Booking: {service.booking}</p>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => editService(service)} className="rounded-md border px-3 py-1.5 text-sm">Edit</button>
                  {service.isActive ? (
                    <button type="button" onClick={() => deactivateService(service)} className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600">Hide</button>
                  ) : (
                    <button type="button" onClick={() => activateService(service)} className="rounded-md border border-green-200 px-3 py-1.5 text-sm text-green-700">Show</button>
                  )}
                </div>
              </div>
            </article>
          ))}
          {!services.length && <p className="text-sm text-gray-500">No active services yet.</p>}
        </div>
      )}
    </div>
  );
}
