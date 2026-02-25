import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from 'react-query';
import { listingsAPI } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { MapPin, Bed, Bath, Square, Calendar, Heart, Star, Phone, User, Check } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ListingDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeImg, setActiveImg] = useState(0);
  const [bookingMsg, setBookingMsg] = useState('');
  const [tourDate, setTourDate] = useState('');
  const [showBooking, setShowBooking] = useState(false);

  const { data, isLoading, error } = useQuery(['listing', id], () => listingsAPI.getOne(id));
  const listing = data?.data;

  const handleSave = async () => {
    if (!user) return navigate('/login');
    try { await listingsAPI.save(id); toast.success('Saved!'); } catch { toast.error('Already saved'); }
  };

  const handleBook = async () => {
    if (!user) return navigate('/login');
    try {
      await listingsAPI.book(id, { tour_date: tourDate, message: bookingMsg });
      toast.success('Tour request sent!');
      setShowBooking(false);
    } catch (err) { toast.error('Booking failed'); }
  };

  if (isLoading) return <div className="max-w-5xl mx-auto px-4 py-16 text-center"><div className="animate-spin h-10 w-10 border-4 border-indigo-600 rounded-full border-t-transparent mx-auto" /></div>;
  if (error || !listing) return <div className="text-center py-20 text-red-600">Listing not found</div>;

  const images = listing.images?.length > 0 ? listing.images : [{ url: null }];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Image Gallery */}
      <div className="rounded-2xl overflow-hidden mb-8">
        <div className="h-96 bg-gray-200">
          {images[activeImg]?.url ? (
            <img src={images[activeImg].url} alt={listing.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-8xl">🏠</div>
          )}
        </div>
        {images.length > 1 && (
          <div className="flex gap-2 mt-2">
            {images.map((img, i) => (
              <button key={i} onClick={() => setActiveImg(i)}
                className={`w-20 h-16 rounded-lg overflow-hidden border-2 ${i === activeImg ? 'border-indigo-500' : 'border-transparent'}`}>
                {img.url ? <img src={img.url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gray-200" />}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-indigo-100 text-indigo-700 text-xs font-semibold px-2 py-1 rounded-lg capitalize">{listing.type}</span>
                <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${listing.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{listing.status}</span>
              </div>
              <h1 className="text-3xl font-bold text-gray-900">{listing.title}</h1>
              <div className="flex items-center text-gray-500 mt-2">
                <MapPin className="h-4 w-4 mr-1" />
                <span>{listing.address_line1}, {listing.city}, {listing.state} {listing.zip_code}</span>
              </div>
            </div>
            <button onClick={handleSave} className="p-2 rounded-full border border-gray-200 hover:border-red-400 hover:text-red-500 transition-colors">
              <Heart className="h-5 w-5" />
            </button>
          </div>

          {/* Key Stats */}
          <div className="grid grid-cols-4 gap-4">
            {listing.bedrooms != null && (
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <Bed className="h-5 w-5 mx-auto text-indigo-600 mb-1" />
                <div className="font-bold">{listing.bedrooms}</div>
                <div className="text-xs text-gray-500">Bedrooms</div>
              </div>
            )}
            {listing.bathrooms != null && (
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <Bath className="h-5 w-5 mx-auto text-indigo-600 mb-1" />
                <div className="font-bold">{listing.bathrooms}</div>
                <div className="text-xs text-gray-500">Bathrooms</div>
              </div>
            )}
            {listing.area_sqft && (
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <Square className="h-5 w-5 mx-auto text-indigo-600 mb-1" />
                <div className="font-bold">{listing.area_sqft.toLocaleString()}</div>
                <div className="text-xs text-gray-500">Sq Ft</div>
              </div>
            )}
            {listing.lease_duration && (
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <Calendar className="h-5 w-5 mx-auto text-indigo-600 mb-1" />
                <div className="font-bold">{listing.lease_duration}mo</div>
                <div className="text-xs text-gray-500">Lease</div>
              </div>
            )}
          </div>

          {/* Features */}
          <div className="flex flex-wrap gap-2">
            {listing.is_furnished && <span className="bg-green-100 text-green-700 text-xs px-3 py-1.5 rounded-lg font-medium">✓ Furnished</span>}
            {listing.pets_allowed && <span className="bg-green-100 text-green-700 text-xs px-3 py-1.5 rounded-lg font-medium">✓ Pets Allowed</span>}
            {!listing.smoking_allowed && <span className="bg-orange-100 text-orange-700 text-xs px-3 py-1.5 rounded-lg font-medium">🚭 No Smoking</span>}
          </div>

          {/* Description */}
          {listing.description && (
            <div>
              <h2 className="text-xl font-semibold mb-3">About This Place</h2>
              <p className="text-gray-600 leading-relaxed">{listing.description}</p>
            </div>
          )}

          {/* Amenities */}
          {listing.amenities?.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-3">Amenities</h2>
              <div className="grid grid-cols-2 gap-2">
                {listing.amenities.map(a => (
                  <div key={a.id} className="flex items-center text-sm text-gray-700">
                    <Check className="h-4 w-4 text-green-500 mr-2" /> {a.name}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reviews */}
          {listing.reviews?.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-3">Reviews</h2>
              <div className="space-y-4">
                {listing.reviews.map(r => (
                  <div key={r.id} className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{r.first_name} {r.last_name}</span>
                      <div className="flex text-yellow-500">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</div>
                    </div>
                    <p className="text-gray-600 text-sm">{r.comment}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 sticky top-20">
            <div className="text-3xl font-bold text-indigo-600 mb-1">
              ${parseInt(listing.rent).toLocaleString()}<span className="text-base font-normal text-gray-500">/month</span>
            </div>
            {listing.deposit && <p className="text-sm text-gray-500 mb-4">Deposit: ${parseInt(listing.deposit).toLocaleString()}</p>}

            {listing.available_from && (
              <div className="flex items-center text-sm text-gray-600 mb-4">
                <Calendar className="h-4 w-4 mr-2 text-indigo-600" />
                Available: {new Date(listing.available_from).toLocaleDateString()}
              </div>
            )}

            <button onClick={() => setShowBooking(!showBooking)}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors mb-3">
              Request a Tour
            </button>

            {showBooking && (
              <div className="space-y-3 mt-3">
                <input type="datetime-local" value={tourDate} onChange={(e) => setTourDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <textarea placeholder="Message to landlord..." value={bookingMsg} onChange={(e) => setBookingMsg(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none h-20" />
                <button onClick={handleBook}
                  className="w-full bg-green-600 text-white py-2 rounded-xl font-medium hover:bg-green-700 transition-colors">
                  Confirm Request
                </button>
              </div>
            )}

            {/* Landlord info */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                  <User className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">{listing.landlord_name}</p>
                  <p className="text-xs text-gray-500">Landlord</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
