import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Home, Users, Bell, Menu, X, LogOut, User, Plus } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center space-x-8">
            <Link to="/" className="flex items-center space-x-2">
              <Home className="h-7 w-7 text-indigo-600" />
              <span className="text-xl font-bold text-gray-900">RentMate</span>
            </Link>
            <div className="hidden md:flex items-center space-x-6">
              <Link to="/listings" className="text-gray-600 hover:text-indigo-600 font-medium transition-colors">
                Listings
              </Link>
              <Link to="/roommates" className="text-gray-600 hover:text-indigo-600 font-medium transition-colors">
                Find Roommates
              </Link>
              {user?.role === 'landlord' && (
                <Link to="/listings/create" className="flex items-center space-x-1 text-indigo-600 hover:text-indigo-800 font-medium">
                  <Plus className="h-4 w-4" />
                  <span>Post Listing</span>
                </Link>
              )}
            </div>
          </div>

          <div className="hidden md:flex items-center space-x-4">
            {user ? (
              <>
                <Link to="/dashboard" className="flex items-center space-x-2 text-gray-700 hover:text-indigo-600">
                  <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                    <span className="text-indigo-700 font-semibold text-sm">{user.first_name[0]}</span>
                  </div>
                  <span className="font-medium">{user.first_name}</span>
                </Link>
                <button onClick={handleLogout} className="text-gray-500 hover:text-red-600 transition-colors">
                  <LogOut className="h-5 w-5" />
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-gray-600 hover:text-indigo-600 font-medium">Sign In</Link>
                <Link to="/register" className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors">
                  Get Started
                </Link>
              </>
            )}
          </div>

          <div className="md:hidden flex items-center">
            <button onClick={() => setMenuOpen(!menuOpen)} className="text-gray-600">
              {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {menuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 px-4 py-4 space-y-3">
          <Link to="/listings" className="block text-gray-700 font-medium" onClick={() => setMenuOpen(false)}>Listings</Link>
          <Link to="/roommates" className="block text-gray-700 font-medium" onClick={() => setMenuOpen(false)}>Find Roommates</Link>
          {user ? (
            <>
              <Link to="/dashboard" className="block text-gray-700 font-medium" onClick={() => setMenuOpen(false)}>Dashboard</Link>
              <button onClick={handleLogout} className="block text-red-600 font-medium">Logout</button>
            </>
          ) : (
            <>
              <Link to="/login" className="block text-gray-700 font-medium" onClick={() => setMenuOpen(false)}>Sign In</Link>
              <Link to="/register" className="block bg-indigo-600 text-white px-4 py-2 rounded-lg text-center font-medium" onClick={() => setMenuOpen(false)}>Get Started</Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
