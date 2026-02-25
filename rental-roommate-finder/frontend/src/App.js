import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './hooks/useAuth';

// Pages
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ListingsPage from './pages/ListingsPage';
import ListingDetailPage from './pages/ListingDetailPage';
import CreateListingPage from './pages/CreateListingPage';
import RoommatesPage from './pages/RoommatesPage';
import RoommateProfilePage from './pages/RoommateProfilePage';
import DashboardPage from './pages/DashboardPage';
import NotFoundPage from './pages/NotFoundPage';
import Navbar from './components/layout/Navbar';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 60000 } }
});

function PrivateRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex justify-center mt-20"><div className="animate-spin h-8 w-8 border-4 border-indigo-600 rounded-full border-t-transparent" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <div className="min-h-screen bg-gray-50">
            <Navbar />
            <main>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/listings" element={<ListingsPage />} />
                <Route path="/listings/:id" element={<ListingDetailPage />} />
                <Route path="/listings/create" element={
                  <PrivateRoute roles={['landlord', 'admin']}><CreateListingPage /></PrivateRoute>
                } />
                <Route path="/roommates" element={<RoommatesPage />} />
                <Route path="/roommates/:userId" element={<RoommateProfilePage />} />
                <Route path="/dashboard" element={
                  <PrivateRoute><DashboardPage /></PrivateRoute>
                } />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </main>
          </div>
          <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
