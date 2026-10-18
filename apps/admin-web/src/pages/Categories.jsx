import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { useAuthStore } from "../store/authStore.js";

const EMPTY_FORM = { name: "", slug: "", imageUrl: "", parent: "", sortOrder: 0 };

async function uploadImage(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("folder", "category-images");
  const response = await api.post("/uploads", formData);
  return response.data.data.url;
}

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const hasPermission = useAuthStore((state) => state.hasPermission);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/categories");
      setCategories(response.data.data.categories);
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || "Unable to load categories.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  function beginEdit(category) {
    setEditingId(category._id);
    setForm({
      name: category.name,
      slug: category.slug,
      imageUrl: category.imageUrl || "",
      parent: category.parent?._id || category.parent || "",
      sortOrder: category.sortOrder || 0,
    });
    setError("");
    setNotice("");
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function handleImageChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const imageUrl = await uploadImage(file);
      setForm((current) => ({ ...current, imageUrl }));
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || "Image upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function saveCategory(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    const payload = {
      ...form,
      slug: form.slug.trim().toLowerCase().replace(/\s+/g, "-"),
      parent: form.parent || null,
      sortOrder: Number(form.sortOrder) || 0,
    };
    try {
      if (editingId) {
        await api.patch(`/categories/${editingId}`, payload);
        setNotice("Category updated. Customers will see the changes in the catalogue.");
      } else {
        await api.post("/categories", payload);
        setNotice("Category created and added to the customer catalogue.");
      }
      resetForm();
      await loadCategories();
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || "Unable to save category.");
    } finally {
      setSaving(false);
    }
  }

  async function deactivateCategory(category) {
    if (!window.confirm(`Deactivate "${category.name}"? It will no longer appear to customers.`)) return;
    setError("");
    setNotice("");
    try {
      await api.delete(`/categories/${category._id}`);
      setNotice("Category deactivated.");
      await loadCategories();
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || "Unable to deactivate category.");
    }
  }

  const canCreate = hasPermission("category:create");
  const canUpdate = hasPermission("category:update");
  const canDelete = hasPermission("category:delete");

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold">Customer catalogue categories</h2>
        <p className="mt-1 text-sm text-gray-500">
          Manage category names, ordering and images shown in the customer app.
        </p>
      </div>

      {(error || notice) && (
        <p role={error ? "alert" : "status"} className={`mb-4 rounded-lg p-3 text-sm ${error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
          {error || notice}
        </p>
      )}

      {(canCreate || (editingId && canUpdate)) && (
        <form onSubmit={saveCategory} className="mb-8 grid gap-4 rounded-xl border border-gray-200 bg-white p-5 md:grid-cols-2">
          <h3 className="md:col-span-2 text-lg font-semibold">{editingId ? "Edit category" : "Create category"}</h3>
          <label className="text-sm font-medium">
            Category name
            <input
              required
              minLength={2}
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-normal"
              placeholder="Fresh produce"
            />
          </label>
          <label className="text-sm font-medium">
            URL slug
            <input
              required
              pattern="[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*"
              value={form.slug}
              onChange={(event) => setForm({ ...form, slug: event.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-normal"
              placeholder="fresh-produce"
            />
          </label>
          <label className="text-sm font-medium">
            Parent category
            <select
              value={form.parent}
              onChange={(event) => setForm({ ...form, parent: event.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-normal"
            >
              <option value="">Top-level category</option>
              {categories.filter((category) => !category.parent && category._id !== editingId).map((category) => (
                <option key={category._id} value={category._id}>{category.name}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            Display order
            <input
              type="number"
              min="0"
              value={form.sortOrder}
              onChange={(event) => setForm({ ...form, sortOrder: event.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-normal"
            />
          </label>
          <div className="md:col-span-2">
            <label className="text-sm font-medium">
              Category image
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleImageChange}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 font-normal"
              />
            </label>
            {uploading && <p className="mt-2 text-xs text-gray-500">Uploading image...</p>}
            {form.imageUrl && <img src={form.imageUrl} alt="Category preview" className="mt-3 h-24 w-36 rounded-lg bg-gray-100 object-cover" />}
          </div>
          <div className="flex gap-2 md:col-span-2">
            <button disabled={saving || uploading} className="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white disabled:opacity-50">
              {saving ? "Saving..." : editingId ? "Save category" : "Create category"}
            </button>
            {editingId && <button type="button" onClick={resetForm} className="rounded-lg border border-gray-300 px-4 py-2">Cancel</button>}
          </div>
        </form>
      )}

      {loading ? <p className="text-sm text-gray-500">Loading categories...</p> : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <article key={category._id} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              {category.imageUrl ? (
                <img src={category.imageUrl} alt={category.name} className="h-36 w-full object-cover" />
              ) : (
                <div className="flex h-36 items-center justify-center bg-gray-100 text-sm text-gray-400">No category image</div>
              )}
              <div className="p-4">
                <h3 className="font-medium">{category.name}</h3>
                <p className="text-xs text-gray-400">{category.slug} · order {category.sortOrder || 0}</p>
                <p className="mt-1 text-xs text-gray-500">
                  {category.parent ? `Subcategory of ${categories.find((item) => item._id === (category.parent?._id || category.parent))?.name || "category"}` : "Top-level category"}
                </p>
                <div className="mt-3 flex gap-2">
                  {canUpdate && <button type="button" onClick={() => beginEdit(category)} className="rounded-md border px-3 py-1.5 text-sm">Edit</button>}
                  {canDelete && <button type="button" onClick={() => deactivateCategory(category)} className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600">Deactivate</button>}
                </div>
              </div>
            </article>
          ))}
          {!categories.length && <p className="text-sm text-gray-500">No active categories.</p>}
        </div>
      )}
    </div>
  );
}
