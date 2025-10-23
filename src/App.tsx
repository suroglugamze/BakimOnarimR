import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import FaultReport from './pages/FaultReport';
import Assignment from './pages/Assignment';
import Maintenance from './pages/Maintenance';
import Machines from './pages/Machines';
import Reports from './pages/Reports';
import MaintenanceCalendar from './pages/MaintenanceCalendar';
import Admin from './pages/Admin';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="fault-report" element={
              <ProtectedRoute requiredRoles={['admin', 'manager', 'department_manager']}>
                <FaultReport />
              </ProtectedRoute>
            } />
            <Route path="assignment" element={
              <ProtectedRoute requiredRoles={['admin', 'manager', 'department_manager']}>
                <Assignment />
              </ProtectedRoute>
            } />
            <Route path="maintenance" element={
              <ProtectedRoute requiredRoles={['admin', 'manager', 'maintenance_personnel']}>
                <Maintenance />
              </ProtectedRoute>
            } />
            <Route path="reports" element={
              <ProtectedRoute requiredRoles={['admin', 'manager', 'department_manager']}>
                <Reports />
              </ProtectedRoute>
            } />
            <Route path="maintenance-calendar" element={
              <ProtectedRoute requiredRoles={['admin', 'manager', 'department_manager', 'maintenance_personnel']}>
                <MaintenanceCalendar />
              </ProtectedRoute>
            } />
            <Route path="machines" element={
              <ProtectedRoute requiredRoles={['admin', 'manager']}>
                <Machines />
              </ProtectedRoute>
            } />
            <Route path="admin" element={
              <ProtectedRoute requiredRoles={['admin']}>
                <Admin />
              </ProtectedRoute>
            } />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;