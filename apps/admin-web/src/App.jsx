import { Routes, Route } from "react-router-dom";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Roles from "./pages/Roles.jsx";
import AdminUsers from "./pages/AdminUsers.jsx";
import SellerUsers from "./pages/SellerUsers.jsx";
import DeliveryUsers from "./pages/DeliveryUsers.jsx";
import SupportUsers from "./pages/SupportUsers.jsx";
import CustomerUsers from "./pages/CustomerUsers.jsx";
import Categories from "./pages/Categories.jsx";
import Products from "./pages/Products.jsx";
import Services from "./pages/Services.jsx";
import Orders from "./pages/Orders.jsx";
import Sellers from "./pages/Sellers.jsx";
import DeliveryPartners from "./pages/DeliveryPartners.jsx";
import AppLayout from "./layouts/AppLayout.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="roles" element={<ProtectedRoute permission="role:manage"><Roles /></ProtectedRoute>} />
        <Route path="users/admins" element={<ProtectedRoute permission="user:manage"><AdminUsers /></ProtectedRoute>} />
        <Route path="users/sellers" element={<ProtectedRoute permission="user:manage"><SellerUsers /></ProtectedRoute>} />
        <Route path="users/delivery" element={<ProtectedRoute permission="user:manage"><DeliveryUsers /></ProtectedRoute>} />
        <Route path="users/support" element={<ProtectedRoute permission="user:manage"><SupportUsers /></ProtectedRoute>} />
        <Route path="users/customers" element={<ProtectedRoute permission="user:manage"><CustomerUsers /></ProtectedRoute>} />
        <Route path="categories" element={<Categories />} />
        <Route path="products" element={<ProtectedRoute permission="product:approve"><Products /></ProtectedRoute>} />
        <Route path="services" element={<ProtectedRoute permission="service:manage"><Services /></ProtectedRoute>} />
        <Route path="orders" element={<Orders />} />
        <Route path="sellers" element={<ProtectedRoute permission="store:approve"><Sellers /></ProtectedRoute>} />
        <Route
          path="delivery-partners"
          element={
            <ProtectedRoute permission="delivery-partner:manage">
              <DeliveryPartners />
            </ProtectedRoute>
          }
        />
      </Route>
    </Routes>
  );
}
