import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Home, Users, Shield, Star } from 'lucide-react';

export default function HomePage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const handleSearch = (e) => {
    e.preventDefault();
    navigate(`/listings?city=${search}`);
  };

  const stats = [
    { label: 'Active Listings', value: '2,400+' },
    { label: 'Verified Landlords', value: '800+' },
    { label: 'Happy Tenants', value: '5,000+' },
    { label: 'Cities Covered', value: '50+' },
  ];

  const features = [
    { icon: <Home className="h-8 w-8 text-indigo-600" />, title: 'Verified Listings', desc: 'Every listing is manually reviewed for accuracy and safety.' },
    { icon: <Users className="h-8 w-8 text-indigo-600" />, title: 'Roommate Matching', desc: 'Smart compatibility matching based on lifestyle, budget and preferences.' },
    { icon: <Shield className="h-8 w-8 text-indigo-600" />, title: 'Secure Messaging', desc: 'Communicate safely through our platform before committing.' },
    { icon: <Star className="h-8 w-8 text-indigo-600" />, title: 'Ratings & Reviews', desc: 'Make informed decisions with honest tenant and landlord reviews.' },
  ];

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 text-white py-24 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-extrabold mb-6 leading-tight">
            Find Your Perfect Home<br />& Ideal Roommate
          </h1>
          <p className="text-xl text-indigo-100 mb-10">
            Browse verified rental listings, connect with compatible roommates, and move in with confidence.
          </p>
          <form onSubmit={handleSearch} className="flex max-w-2xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="flex items-center pl-4 text-gray-400">
              <Search className="h-5 w-5" />
            </div>
            <input
              type="text"
              placeholder="Search by city, neighborhood..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 px-4 py-4 text-gray-800 text-lg outline-none"
            />
            <button type="submit" className="bg-indigo-600 text-white px-8 py-4 font-semibold hover:bg-indigo-700 transition-colors">
              Search
            </button>
          </form>
          <div className="mt-4 flex justify-center gap-4 text-sm text-indigo-200">
            {['New York', 'Los Angeles', 'Chicago', 'Austin', 'Seattle'].map(city => (
              <button key={city} onClick={() => navigate(`/listings?city=${city}`)}
                className="hover:text-white transition-colors">{city}</button>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-white py-12 border-b border-gray-100">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 px-4 text-center">
          {stats.map(s => (
            <div key={s.label}>
              <div className="text-3xl font-extrabold text-indigo-600">{s.value}</div>
              <div className="text-gray-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Cards */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-8">
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mb-4">
              <Home className="h-6 w-6 text-indigo-600" />
            </div>
            <h2 className="text-2xl font-bold mb-3">Browse Rental Listings</h2>
            <p className="text-gray-600 mb-6">Find apartments, houses, rooms, and studios. Filter by price, location, amenities, and more.</p>
            <button onClick={() => navigate('/listings')}
              className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-indigo-700 transition-colors">
              Explore Listings
            </button>
          </div>
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4">
              <Users className="h-6 w-6 text-purple-600" />
            </div>
            <h2 className="text-2xl font-bold mb-3">Find a Roommate</h2>
            <p className="text-gray-600 mb-6">Connect with compatible people based on lifestyle, schedule, cleanliness, and budget.</p>
            <button onClick={() => navigate('/roommates')}
              className="bg-purple-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-purple-700 transition-colors">
              Find Roommates
            </button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Why Choose RentMate?</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map(f => (
              <div key={f.title} className="text-center">
                <div className="flex justify-center mb-4">{f.icon}</div>
                <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8 text-center text-sm">
        <p>© 2024 RentMate — Built with React, Node.js, PostgreSQL, Redis, RabbitMQ & Kafka</p>
      </footer>
    </div>
  );
}
