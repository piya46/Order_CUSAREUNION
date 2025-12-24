// src/App.tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Protected from './components/Protected';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import OrdersList from './pages/Orders/OrdersList';
import OrderDetail from './pages/Orders/OrdersDetail';
import Products from './pages/Products/Products';
import Users from './pages/Users/Users';
import Roles from './pages/Roles/Roles';
import POList from './pages/PurchaseOrders/POList';
import ReceivingList from './pages/Receivings/ReceivingList';
import Issues from './pages/Issues/Issues';
import AuditLogs from './pages/Audit/AuditLogs';
import Inventory from './pages/Inventory';
import SupplierList from './pages/Suppliers/SupplierList';
import Forbidden from './pages/Forbidden';

export default function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/403" element={<Forbidden />} />

      {/* Protected Routes (Require Login) */}
      <Route
        path="/"
        element={
          <Protected>
            <Layout><Dashboard /></Layout>
          </Protected>
        }
      />

      {/* --- Order Management --- */}
      <Route
        path="/orders"
        element={
          <Protected permissions={['order:manage']}>
            <Layout><OrdersList /></Layout>
          </Protected>
        }
      />
      <Route
        path="/orders/:id"
        element={
          <Protected permissions={['order:manage']}>
            <Layout><OrderDetail /></Layout>
          </Protected>
        }
      />

      {/* --- Product & Inventory --- */}
      <Route
        path="/products"
        element={
          <Protected permissions={['product:manage']}>
            <Layout><Products /></Layout>
          </Protected>
        }
      />
      <Route
        path="/inventory"
        element={
          <Protected permissions={['product:manage']}>
            <Layout><Inventory /></Layout>
          </Protected>
        }
      />

      {/* --- Purchasing & Suppliers (Supply Chain) --- */}
      <Route
        path="/po"
        element={
          <Protected permissions={['po:manage']}>
            <Layout><POList /></Layout>
          </Protected>
        }
      />
      <Route
        path="/suppliers"
        element={
          <Protected permissions={['po:manage']}>
            <Layout><SupplierList /></Layout>
          </Protected>
        }
      />
      <Route
        path="/receiving"
        element={
          <Protected permissions={['receiving:manage']}>
            <Layout><ReceivingList /></Layout>
          </Protected>
        }
      />

      {/* --- Admin System --- */}
      <Route
        path="/users"
        element={
          <Protected permissions={['user:manage']}>
            <Layout><Users /></Layout>
          </Protected>
        }
      />
      <Route
        path="/roles"
        element={
          <Protected permissions={['role:manage']}>
            <Layout><Roles /></Layout>
          </Protected>
        }
      />
      <Route
        path="/audit"
        element={
          <Protected permissions={['audit:manage']}>
            <Layout><AuditLogs /></Layout>
          </Protected>
        }
      />

      {/* --- Support --- */}
      <Route
        path="/issues"
        element={
          <Protected permissions={['issue:manage']}>
            <Layout><Issues /></Layout>
          </Protected>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}