// Dashboard Page
import React from 'react';
import { useQuery } from 'react-query';
import { useAuth } from '../hooks/useAuth';
import { listingsAPI, roommatesAPI, notificationsAPI } from '../services/api';
import { Home, Users, Bell, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: myListings } = useQuery('myListings', listingsAPI.myListings, { enabled: user?.role === 'landlord' });
  const { data: requests } = useQuery('roommateRequests', roommatesAPI.getMyRequests);
  const { data: notifications, refetch: refetchNotifs } = useQuery('notifications', notificationsAPI.getAll);

  const handleRequestAction = async (id, status) => {
    try {
      await roommatesAPI.updateRequest(id, status);
      toast.success(`Request ${status}`);
    } catch { toast.error('Failed'); }
  };

  const markRead = async (id) => {
    await notificationsAPI.markRead(id);
    refetchNotifs();
  };

  const unread = notifications?.data?.filter(n => !n.is_read) || [];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-gray-500">Welcome back, {user?.first_name}!</p>
        </div>
        {user?.role === 'landlord' && (
          <button onClick={() => navigate('/listings/create')}
            className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-indigo-700 transition-colors">
            + Post Listing
          </button>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Landlord listings */}
        {user?.role === 'landlord' && (
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Home className="h-5 w-5 text-indigo-600" /> My Listings</h2>
            {myListings?.data?.length === 0 ? (
              <p className="text-gray-500 text-sm">No listings yet. <button onClick={() => navigate('/listings/create')} className="text-indigo-600 underline">Post one!</button></p>
            ) : (
              <div className="space-y-3">
                {myListings?.data?.slice(0, 5).map(l => (
                  <div key={l.id} onClick={() => navigate(`/listings/${l.id}`)}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-indigo-50 cursor-pointer">
                    <div>
                      <p className="font-medium text-sm">{l.title}</p>
                      <p className="text-xs text-gray-500">{l.city}, {l.state} · ${parseInt(l.rent).toLocaleString()}/mo</p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded-lg ${l.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{l.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Roommate Requests */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Users className="h-5 w-5 text-purple-600" /> Roommate Requests</h2>
          {requests?.received?.filter(r => r.status === 'pending').length === 0 ? (
            <p className="text-gray-500 text-sm">No pending requests</p>
          ) : (
            <div className="space-y-3">
              {requests?.received?.filter(r => r.status === 'pending').map(r => (
                <div key={r.id} className="p-3 bg-gray-50 rounded-xl">
                  <p className="font-medium text-sm">{r.first_name} {r.last_name}</p>
                  {r.message && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{r.message}</p>}
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => handleRequestAction(r.id, 'accepted')}
                      className="flex-1 bg-green-600 text-white text-xs py-1.5 rounded-lg hover:bg-green-700">Accept</button>
                    <button onClick={() => handleRequestAction(r.id, 'rejected')}
                      className="flex-1 bg-red-100 text-red-600 text-xs py-1.5 rounded-lg hover:bg-red-200">Decline</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className={`bg-white rounded-2xl border border-gray-100 p-6 ${user?.role === 'landlord' ? '' : 'lg:col-span-2'}`}>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Bell className="h-5 w-5 text-orange-500" /> Notifications
            {unread.length > 0 && <span className="bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">{unread.length}</span>}
          </h2>
          {notifications?.data?.length === 0 ? (
            <p className="text-gray-500 text-sm">No notifications yet</p>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {notifications?.data?.map(n => (
                <div key={n.id} onClick={() => markRead(n.id)}
                  className={`p-3 rounded-xl cursor-pointer ${n.is_read ? 'bg-gray-50' : 'bg-indigo-50 border border-indigo-100'}`}>
                  <div className="flex items-start justify-between">
                    <p className="font-medium text-sm">{n.title}</p>
                    {!n.is_read && <div className="w-2 h-2 bg-indigo-600 rounded-full mt-1 flex-shrink-0" />}
                  </div>
                  {n.body && <p className="text-xs text-gray-500 mt-1">{n.body}</p>}
                  <p className="text-xs text-gray-400 mt-1">{new Date(n.created_at).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
