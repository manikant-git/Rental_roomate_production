import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { listingsAPI } from '../services/api';
import { Search, Filter, MapPin, Bed, Bath, DollarSign, Heart, Eye } from 'lucide-react';

function ListingCard({ listing }) {
  const navigate = useNavigate();
  return (
    <div onClick={() => navigate(`/listings/${listing.id}`)}
      className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all cursor-pointer group">
      <div className="relative h-48 bg-gray-200 overflow-hidden">
        {listing.primary_image ? (
          <img src={listing.primary_image} alt={listing.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
            <span className="text-4xl">🏠</span>
          </div>
        )}
        <div className="absolute top-3 left-3">
          <span className="bg-white text-indigo-700 text-xs font-semibold px-2 py-1 rounded-lg capitalize">{listing.type}</span>
        </div>
        <div className="absolute top-3 right-3 flex items-center bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded-lg">
          <Eye className="h-3 w-3 mr-1" /> {listing.views_count}
        </div>
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 truncate mb-1">{listing.title}</h3>
        <div className="flex items-center text-gray-500 text-sm mb-3">
          <MapPin className="h-3.5 w-3.5 mr-1" />
          <span>{listing.city}, {listing.state}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-2xl font-bold text-indigo-600">${parseInt(listing.rent).toLocaleString()}<span className="text-sm font-normal text-gray-500">/mo</span></span>
          <div className="flex items-center space-x-3 text-gray-500 text-sm">
            {listing.bedrooms != null && <span className="flex items-center"><Bed className="h-3.5 w-3.5 mr-1" />{listing.bedrooms}bd</span>}
            {listing.bathrooms != null && <span className="flex items-center"><Bath className="h-3.5 w-3.5 mr-1" />{listing.bathrooms}ba</span>}
          </div>
        </div>
        {listing.avg_rating && (
          <div className="mt-2 flex items-center text-sm text-yellow-600">
            ⭐ {parseFloat(listing.avg_rating).toFixed(1)} ({listing.review_count} reviews)
          </div>
        )}
      </div>
    </div>
  );
}

export default function ListingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState({
    city: searchParams.get('city') || '',
    type: '',
    min_rent: '',
    max_rent: '',
    bedrooms: '',
    pets_allowed: '',
    is_furnished: '',
    page: 1,
    limit: 12,
    sort: 'created_at',
  });

  const { data, isLoading, error } = useQuery(
    ['listings', filters],
    () => listingsAPI.getAll(Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== ''))),
    { keepPreviousData: true }
  );

  const handleFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  if (error) return <div className="text-center py-20 text-red-600">Failed to load listings</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Find Your Next Home</h1>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <div className="col-span-2">
            <input type="text" placeholder="City or neighborhood..."
              value={filters.city}
              onChange={(e) => handleFilter('city', e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <select value={filters.type} onChange={(e) => handleFilter('type', e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">All Types</option>
            <option value="apartment">Apartment</option>
            <option value="house">House</option>
            <option value="room">Room</option>
            <option value="studio">Studio</option>
            <option value="condo">Condo</option>
          </select>
          <input type="number" placeholder="Min rent" value={filters.min_rent}
            onChange={(e) => handleFilter('min_rent', e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input type="number" placeholder="Max rent" value={filters.max_rent}
            onChange={(e) => handleFilter('max_rent', e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <select value={filters.bedrooms} onChange={(e) => handleFilter('bedrooms', e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">Bedrooms</option>
            {[0,1,2,3,4].map(n => <option key={n} value={n}>{n === 0 ? 'Studio' : `${n} bd`}</option>)}
          </select>
          <select value={filters.sort} onChange={(e) => handleFilter('sort', e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="created_at">Newest</option>
            <option value="rent">Price</option>
            <option value="views_count">Popular</option>
          </select>
        </div>
        <div className="flex gap-3 mt-4">
          <label className="flex items-center space-x-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={filters.pets_allowed === 'true'}
              onChange={(e) => handleFilter('pets_allowed', e.target.checked ? 'true' : '')}
              className="rounded text-indigo-600" />
            <span>Pets OK</span>
          </label>
          <label className="flex items-center space-x-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={filters.is_furnished === 'true'}
              onChange={(e) => handleFilter('is_furnished', e.target.checked ? 'true' : '')}
              className="rounded text-indigo-600" />
            <span>Furnished</span>
          </label>
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl h-72 animate-pulse border border-gray-100" />
          ))}
        </div>
      ) : data?.data?.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">🏠</div>
          <p className="text-xl text-gray-500">No listings found. Try adjusting your filters.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-gray-600">{data?.pagination?.total} listings found</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data?.data?.map(listing => <ListingCard key={listing.id} listing={listing} />)}
          </div>

          {/* Pagination */}
          {data?.pagination?.pages > 1 && (
            <div className="flex justify-center mt-8 space-x-2">
              {[...Array(data.pagination.pages)].map((_, i) => (
                <button key={i} onClick={() => handleFilter('page', i + 1)}
                  className={`w-10 h-10 rounded-lg font-medium ${filters.page === i + 1 ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 border border-gray-200 hover:border-indigo-400'}`}>
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
