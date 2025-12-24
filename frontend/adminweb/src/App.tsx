import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Protected from './components/Protected';
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

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/"
        element={
          <Protected>
            <Layout><Dashboard /></Layout>
          </Protected>
        }
      />
      <Route
        path="/orders"
        element={
          <Protected roles={['admin','manager','account','shipping']}>
            <Layout><OrdersList /></Layout>
          </Protected>
        }
      />
      <Route
        path="/orders/:id"
        element={
          <Protected roles={['admin','manager','account','shipping']}>
            <Layout><OrderDetail /></Layout>
          </Protected>
        }
      />
      <Route
        path="/products"
        element={
          <Protected roles={['admin','manager']}>
            <Layout><Products /></Layout>
          </Protected>
        }
      />
      <Route
        path="/users"
        element={
          <Protected roles={['admin']}>
            <Layout><Users /></Layout>
          </Protected>
        }
      />
      <Route
        path="/roles"
        element={
          <Protected roles={['admin']}>
            <Layout><Roles /></Layout>
          </Protected>
        }
      />
      <Route
        path="/po"
        element={
          <Protected roles={['purchasing','admin','manager']}>
            <Layout><POList /></Layout>
          </Protected>
        }
      />
      <Route
        path="/receiving"
        element={
          <Protected roles={['purchasing','admin','manager']}>
            <Layout><ReceivingList /></Layout>
          </Protected>
        }
      />
      <Route
        path="/issues"
        element={
          <Protected roles={['admin','manager','account','shipping','purchasing']}>
            <Layout><Issues /></Layout>
          </Protected>
        }
      />
      <Route
        path="/audit"
        element={
          <Protected roles={['admin','manager']}>
            <Layout><AuditLogs /></Layout>
          </Protected>
        }
      />
      <Route
        path="/inventory"
        element={
          <Protected roles={['admin','manager']}>
            <Layout><Inventory /></Layout>
          </Protected>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}