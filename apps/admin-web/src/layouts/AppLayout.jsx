import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore.js";
import { api } from "../lib/api.js";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", permission: null },
  { to: "/roles", label: "Roles & Permissions", permission: "role:manage" },
  { to: "/users/admins", label: "Admin Users", permission: "user:manage" },
  { to: "/users/sellers", label: "Seller Users", permission: "user:manage" },
  { to: "/users/delivery", label: "Delivery Users", permission: "user:manage" },
  { to: "/users/support", label: "Support Users", permission: "user:manage" },
  { to: "/users/customers", label: "Customer Users", permission: "user:manage" },
  { to: "/categories", label: "Categories", permission: "category:read" },
  { to: "/products", label: "Products", permission: "product:approve" },
  { to: "/services", label: "Customer Services", permission: "service:manage" },
  { to: "/orders", label: "Orders", permission: "order:read:any" },
  { to: "/sellers", label: "Seller Stores", permission: "store:approve" },
  { to: "/delivery-partners", label: "Delivery Approvals", permission: "delivery-partner:manage" },
];

export default function AppLayout() {
  const user = useAuthStore((s) => s.user);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await api.post("/auth/logout");
    } finally {
      logout();
      navigate("/login");
    }
  }

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-xl font-bold text-brand-700">MeiteiMart</h1>
          <p className="text-xs text-gray-500">Admin Portal</p>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {NAV_ITEMS.filter((item) => !item.permission || hasPermission(item.permission)).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2 text-sm font-medium ${
                  isActive ? "bg-brand-50 text-brand-700" : "text-gray-600 hover:bg-gray-100"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-200">
          <p className="text-sm font-medium">{user?.name}</p>
          <p className="text-xs text-gray-500">{user?.role}</p>
          <button type="button" onClick={handleLogout} className="mt-2 text-sm text-red-600 hover:underline">
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}
