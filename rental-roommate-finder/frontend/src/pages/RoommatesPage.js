import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { useNavigate } from 'react-router-dom';
import { roommatesAPI } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { User, MapPin, DollarSign, Heart, MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';

function RoommateCard({ profile }) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleRequest = async (e) => {
    e.stopPropagation();
    if (!user) return navigate('/login');
    try {
      await roommatesAPI.sendRequest({ receiver_id: profile.user_id, message: `Hi, I'd love to connect about being roommates!` });
      toast.success('Request sent!');
    } catch { toast.error('Request already sent or failed'); }
  };

  const lifestyleColors = { early_bird: 'bg-yellow-100 text-yellow-700', night_owl: 'bg-indigo-100 text-indigo-700', flexible: 'bg-green-100 text-green-700' };
  const cleanColors = { very_clean: 'bg-green-100 text-green-700', clean: 'bg-blue-100 text-blue-700', moderate: 'bg-orange-100 text-orange-700', relaxed: 'bg-gray-100 text-gray-700' };

  return (
    <div onClick={() => navigate(`/roommates/${profile.user_id}`)}
      className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-all cursor-pointer">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center text-2xl font-bold text-indigo-600">
            {profile.avatar_url ? <img src={profile.avatar_url} className="w-full h-full rounded-full object-cover" alt="" /> : profile.first_name?.[0]}
          </div>
          <div>
            <h3 className="font-bold text-gray-900">{profile.first_name} {profile.last_name}</h3>
            {profile.age && profile.occupation && <p className="text-sm text-gray-500">{profile.age}yo · {profile.occupation}</p>}
          </div>
        </div>
      </div>

      {profile.bio && <p className="text-sm text-gray-600 mb-4 line-clamp-2">{profile.bio}</p>}

      <div className="flex items-center text-sm text-gray-500 mb-3">
        <MapPin className="h-3.5 w-3.5 mr-1" />
        <span>{profile.preferred_city || 'Flexible'}</span>
      </div>

      {(profile.budget_min || profile.budget_max) && (
        <div className="flex items-center text-sm text-gray-500 mb-4">
          <DollarSign className="h-3.5 w-3.5 mr-1" />
          <span>${profile.budget_min?.toLocaleString() || '?'} – ${profile.budget_max?.toLocaleString() || '?'}/mo</span>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        {profile.lifestyle && <span className={`text-xs px-2 py-1 rounded-lg font-medium capitalize ${lifestyleColors[profile.lifestyle] || 'bg-gray-100 text-gray-600'}`}>{profile.lifestyle.replace('_', ' ')}</span>}
        {profile.cleanliness && <span className={`text-xs px-2 py-1 rounded-lg font-medium capitalize ${cleanColors[profile.cleanliness] || 'bg-gray-100 text-gray-600'}`}>{profile.cleanliness.replace('_', ' ')}</span>}
        {profile.pet_preference === 'loves_pets' && <span className="text-xs px-2 py-1 rounded-lg font-medium bg-pink-100 text-pink-700">🐾 Pet Lover</span>}
        {profile.smoking_preference === 'non_smoker' && <span className="text-xs px-2 py-1 rounded-lg font-medium bg-gray-100 text-gray-600">🚭 Non-smoker</span>}
      </div>

      {profile.interests?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-4">
          {profile.interests.slice(0, 3).map(i => <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-md">{i}</span>)}
        </div>
      )}

      {user?.userId !== profile.user_id && (
        <button onClick={handleRequest}
          className="w-full flex items-center justify-center space-x-2 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors">
          <MessageCircle className="h-4 w-4" />
          <span>Connect</span>
        </button>
      )}
    </div>
  );
}

export default function RoommatesPage() {
  const [filters, setFilters] = useState({ city: '', budget_min: '', budget_max: '', lifestyle: '', page: 1 });

  const { data, isLoading } = useQuery(
    ['roommates', filters],
    () => roommatesAPI.getAll(Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== ''))),
    { keepPreviousData: true }
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Find Roommates</h1>
          <p className="text-gray-500 mt-1">Connect with compatible people looking for housing</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-8 flex flex-wrap gap-4">
        <input placeholder="Preferred city..." value={filters.city}
          onChange={(e) => setFilters(p => ({ ...p, city: e.target.value, page: 1 }))}
          className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 flex-1 min-w-40"
        />
        <input type="number" placeholder="Min budget" value={filters.budget_min}
          onChange={(e) => setFilters(p => ({ ...p, budget_min: e.target.value, page: 1 }))}
          className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-32"
        />
        <input type="number" placeholder="Max budget" value={filters.budget_max}
          onChange={(e) => setFilters(p => ({ ...p, budget_max: e.target.value, page: 1 }))}
          className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-32"
        />
        <select value={filters.lifestyle} onChange={(e) => setFilters(p => ({ ...p, lifestyle: e.target.value, page: 1 }))}
          className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">All Lifestyles</option>
          <option value="early_bird">Early Bird</option>
          <option value="night_owl">Night Owl</option>
          <option value="flexible">Flexible</option>
        </select>
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => <div key={i} className="bg-white rounded-2xl h-64 animate-pulse border border-gray-100" />)}
        </div>
      ) : data?.data?.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">👥</div>
          <p className="text-xl text-gray-500">No profiles found. Try adjusting your filters.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data?.data?.map(profile => <RoommateCard key={profile.id} profile={profile} />)}
        </div>
      )}
    </div>
  );
}
