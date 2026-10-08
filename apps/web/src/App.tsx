import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/authStore';
import LoginPage from './pages/LoginPage';
import TablesPage from './pages/TablesPage';
import OrderPage from './pages/OrderPage';
import ManagementPage from './pages/ManagementPage';
import NotificationsPage from './pages/NotificationsPage';
import PaymentPage from './pages/PaymentPage';

const queryClient = new QueryClient({defaultOptions:{queries:{networkMode:'always'}}});

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={window.location.pathname.match(/^\/(pos|captain)(?:\/|$)/)?.[1] ? '/'+window.location.pathname.split('/')[1] : '/'}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/tables"
            element={
              <PrivateRoute>
                <TablesPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/order"
            element={
              <PrivateRoute>
                <OrderPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/payment"
            element={
              <PrivateRoute>
                <PaymentPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/manage"
            element={
              <PrivateRoute>
                <ManagementPage />
              </PrivateRoute>
            }
          />
          <Route path="/notifications" element={<PrivateRoute><NotificationsPage /></PrivateRoute>} />
          <Route path="/" element={<Navigate to="/tables" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
