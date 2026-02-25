// CreateListingPage
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listingsAPI } from '../services/api';
import toast from 'react-hot-toast';

export function CreateListingPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', type: 'apartment', address_line1: '',
    city: '', state: '', zip_code: '', rent: '', deposit: '',
    bedrooms: '', bathrooms: '', area_sqft: '', is_furnished: false,
    pets_allowed: false, smoking_allowed: false, available_from: '',
    lease_duration: '', amenity_ids: []
  });

  const handleChange = (key, val) => setForm(p => ({ ...p, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...form };
      if (!payload.deposit) delete payload.deposit;
      if (!payload.bedrooms) delete payload.bedrooms;
      if (!payload.bathrooms) delete payload.bathrooms;
      if (!payload.area_sqft) delete payload.area_sqft;
      if (!payload.lease_duration) delete payload.lease_duration;
      if (!payload.available_from) delete payload.available_from;

      const { data } = await listingsAPI.create(payload);
      toast.success('Listing created!');
      navigate(`/listings/${data.data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create listing');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Post a New Listing</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Basic Details</h2>
          <div>
            <label className={labelClass}>Title *</label>
            <input value={form.title} required onChange={(e) => handleChange('title', e.target.value)}
              placeholder="e.g. Spacious 2BR Apartment in Downtown" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Type *</label>
            <select value={form.type} onChange={(e) => handleChange('type', e.target.value)} className={inputClass}>
              {['apartment','house','room','studio','condo'].map(t => <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Description</label>
            <textarea value={form.description} onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Describe the property..." rows={4} className={inputClass + " resize-none"} />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Location</h2>
          <input value={form.address_line1} required onChange={(e) => handleChange('address_line1', e.target.value)}
            placeholder="Street address" className={inputClass} />
          <div className="grid grid-cols-3 gap-3">
            <input value={form.city} required onChange={(e) => handleChange('city', e.target.value)} placeholder="City" className={inputClass} />
            <input value={form.state} required onChange={(e) => handleChange('state', e.target.value)} placeholder="State" className={inputClass} />
            <input value={form.zip_code} required onChange={(e) => handleChange('zip_code', e.target.value)} placeholder="ZIP" className={inputClass} />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Pricing & Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelClass}>Monthly Rent *</label>
              <input type="number" value={form.rent} required onChange={(e) => handleChange('rent', e.target.value)} placeholder="$" className={inputClass} /></div>
            <div><label className={labelClass}>Security Deposit</label>
              <input type="number" value={form.deposit} onChange={(e) => handleChange('deposit', e.target.value)} placeholder="$" className={inputClass} /></div>
            <div><label className={labelClass}>Bedrooms</label>
              <input type="number" min="0" value={form.bedrooms} onChange={(e) => handleChange('bedrooms', e.target.value)} className={inputClass} /></div>
            <div><label className={labelClass}>Bathrooms</label>
              <input type="number" min="0" step="0.5" value={form.bathrooms} onChange={(e) => handleChange('bathrooms', e.target.value)} className={inputClass} /></div>
            <div><label className={labelClass}>Area (sq ft)</label>
              <input type="number" value={form.area_sqft} onChange={(e) => handleChange('area_sqft', e.target.value)} className={inputClass} /></div>
            <div><label className={labelClass}>Lease Duration (months)</label>
              <input type="number" value={form.lease_duration} onChange={(e) => handleChange('lease_duration', e.target.value)} className={inputClass} /></div>
          </div>
          <div><label className={labelClass}>Available From</label>
            <input type="date" value={form.available_from} onChange={(e) => handleChange('available_from', e.target.value)} className={inputClass} /></div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Features</h2>
          <div className="grid grid-cols-3 gap-3">
            {[['is_furnished','Furnished'],['pets_allowed','Pets OK'],['smoking_allowed','Smoking OK']].map(([key, label]) => (
              <label key={key} className="flex items-center space-x-2 cursor-pointer">
                <input type="checkbox" checked={form[key]} onChange={(e) => handleChange(key, e.target.checked)}
                  className="rounded text-indigo-600" />
                <span className="text-sm text-gray-700">{label}</span>
              </label>
            ))}
          </div>
        </div>

        <button type="submit" disabled={loading}
          className="w-full bg-indigo-600 text-white py-4 rounded-xl font-semibold text-lg hover:bg-indigo-700 transition-colors disabled:opacity-60">
          {loading ? 'Publishing...' : 'Publish Listing'}
        </button>
      </form>
    </div>
  );
}

export function RoommateProfilePage() {
  const navigate = useNavigate();
  return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      <div className="text-6xl mb-4">👤</div>
      <h1 className="text-2xl font-bold mb-2">Roommate Profile</h1>
      <p className="text-gray-500">Profile detail page — connect and view compatibility.</p>
      <button onClick={() => navigate('/roommates')} className="mt-4 text-indigo-600 hover:underline">← Back to roommates</button>
    </div>
  );
}
