import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { apiFetch, type AuthUser } from './lib/api';
import { Layout } from './components/Layout';
import { FoundationDashboard } from './pages/FoundationDashboard';
import { UsersPage } from './pages/UsersPage';
import { JoinManagementPage } from './pages/JoinManagementPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { ModulePreviewPage } from './pages/ModulePreviewPage';

export const App: React.FC = () => {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    apiFetch<AuthUser>('/api/v1/admin/me').then((res) => {
      if (res.success && res.data) setUser(res.data);
    }).catch(() => setUser(null));
  }, []);

  return (
    <BrowserRouter>
      <Layout user={user}>
        <Routes>
          <Route path="/" element={<FoundationDashboard user={user} />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/join-requests" element={<JoinManagementPage />} />
          <Route path="/audit-logs" element={<AuditLogsPage />} />
          <Route path="/roadmap/:moduleKey" element={<ModulePreviewPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
};

export default App;
