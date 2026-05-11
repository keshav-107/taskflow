import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import ProtectedLayout from './components/ProtectedLayout';

import Login from './pages/Login';

// Owner pages
import OwnerDashboard from './pages/owner/Dashboard';
import OwnerTasks from './pages/owner/Tasks';
import CreateTask from './pages/owner/CreateTask';
import OwnerTaskDetail from './pages/owner/TaskDetail';
import Vendors from './pages/owner/Vendors';
import Ledger from './pages/owner/Ledger';

// Vendor pages
import VendorDashboard from './pages/vendor/Dashboard';
import VendorTasks from './pages/vendor/Tasks';
import VendorTaskDetail from './pages/vendor/TaskDetail';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Navigate to="/login" replace />} />

            {/* Owner routes */}
            <Route element={<ProtectedLayout role="owner" />}>
              <Route path="/owner/dashboard" element={<OwnerDashboard />} />
              <Route path="/owner/tasks" element={<OwnerTasks />} />
              <Route path="/owner/tasks/new" element={<CreateTask />} />
              <Route path="/owner/tasks/:id" element={<OwnerTaskDetail />} />
              <Route path="/owner/vendors" element={<Vendors />} />
              <Route path="/owner/ledger" element={<Ledger />} />
            </Route>

            {/* Vendor routes */}
            <Route element={<ProtectedLayout role="vendor" />}>
              <Route path="/vendor/dashboard" element={<VendorDashboard />} />
              <Route path="/vendor/tasks" element={<VendorTasks />} />
              <Route path="/vendor/tasks/:id" element={<VendorTaskDetail />} />
            </Route>

            {/* Catch all */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
