
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';

// --- HELPER FUNCTIONS ---
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

interface FormatDateTimeOptions extends Intl.DateTimeFormatOptions {
  year?: 'numeric' | '2-digit';
  month?: 'numeric' | '2-digit' | 'long' | 'short' | 'narrow';
  day?: 'numeric' | '2-digit';
  hour?: 'numeric' | '2-digit';
  minute?: 'numeric' | '2-digit';
  hour12?: boolean;
}

const formatDateTime = (dateString, options: FormatDateTimeOptions = {}) => {
  if (!dateString) return 'N/A';
  try {
    const defaultOptions: FormatDateTimeOptions = { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true };
    const finalOptions = { ...defaultOptions, ...options };
    return new Date(dateString).toLocaleString('en-US', finalOptions);
  } catch (e) {
    return 'Invalid Date';
  }
};

const getStatusColor = (status) => {
  switch (status) {
    case 'Upcoming Sale': return 'bg-blue-100 text-blue-800 border-blue-300';
    case 'Active': return 'bg-green-100 text-green-800 border-green-300';
    case 'Pending Contract': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case 'Sold': return 'bg-red-100 text-red-800 border-red-300';
    case 'Canceled':
    case 'Postponed': return 'bg-gray-100 text-gray-800 border-gray-300';
    default: return 'bg-gray-100 text-gray-800 border-gray-300';
  }
};

const getDateNormalized = (dateString) => {
  if (!dateString) return null;
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

const daysBetween = (date1Normalized, date2Normalized) => {
  if (!date1Normalized || !date2Normalized) return null;
  const diffTime = date1Normalized.getTime() - date2Normalized.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// --- MOCK DATA ---
const MOCK_PROPERTIES_DATA = [
  {
    id: 'prop1',
    address: '123 Main St, Phoenix, AZ 85001',
    city: 'Phoenix',
    zip: '85001',
    opening_bid: 100000,
    title_notes: 'Appears clear',
    property_note: 'Needs exterior paint and roof repair. Good location.',
    listed_date: '2025-06-15T10:00:00',
    auction_date: '2025-07-20T10:00:00',
    status: 'Upcoming Sale',
    as_is_estimate: 205000,
    rehab_estimate: 40000,
    arv_estimate: 300000,
    offer_75_estimate: 225000,
    twilio_log: [
      { id: 'tlog1-1', type: 'SMS Sent', message: 'Admin alert: New bid submitted for 123 Main St.', timestamp: '2025-06-25T11:00:00' },
      { id: 'tlog1-2', type: 'System Log', message: 'Property scraped from BuyAZForeclosures.', timestamp: '2025-06-24T08:00:00' },
    ],
    bids: [
      { id: 'bid1-1', bid_amount: 228000, user_role: 'member', timestamp: '2025-06-25T10:55:00', status: 'pending' },
      { id: 'bid1-2', bid_amount: 225000, user_role: 'admin', timestamp: '2025-06-24T09:00:00', status: 'approved' },
    ],
  },
  {
    id: 'prop2',
    address: '456 Oak Ave, Scottsdale, AZ 85251',
    city: 'Scottsdale',
    zip: '85251',
    opening_bid: 150000,
    title_notes: 'Lien reported, under review',
    property_note: 'Great potential, needs kitchen remodel.',
    listed_date: '2025-07-01T00:00:00',
    auction_date: '2025-08-15T14:00:00',
    status: 'Active',
    as_is_estimate: 280000,
    rehab_estimate: 50000,
    arv_estimate: 380000,
    offer_75_estimate: 285000,
    twilio_log: [
      { id: 'tlog2-1', type: 'System Log', message: 'Status changed to Active.', timestamp: '2025-07-01T09:00:00' },
    ],
    bids: [
      { id: 'bid2-1', bid_amount: 288000, user_role: 'member', timestamp: '2025-07-02T10:00:00', status: 'pending' },
      { id: 'bid2-2', bid_amount: 290000, user_role: 'investor', timestamp: '2025-07-03T11:30:00', status: 'pending' },
    ],
  },
  {
    id: 'prop3',
    address: '789 Pine Ln, Tempe, AZ 85281',
    city: 'Tempe',
    zip: '85281',
    opening_bid: 90000,
    title_notes: 'Clear title',
    property_note: 'Tenant occupied, month-to-month.',
    listed_date: '2025-05-01T00:00:00',
    auction_date: '2025-06-10T11:00:00',
    status: 'Sold',
    as_is_estimate: 150000,
    rehab_estimate: 20000,
    arv_estimate: 190000,
    offer_75_estimate: 142500,
    twilio_log: [
      { id: 'tlog3-1', type: 'System Log', message: 'Property sold to highest bidder.', timestamp: '2025-06-12T15:00:00' },
      { id: 'tlog3-2', type: 'SMS Sent', message: 'Contract sent for 789 Pine Ln.', timestamp: '2025-06-11T10:00:00' },
    ],
    bids: [
      { id: 'bid3-1', bid_amount: 145000, user_role: 'member', timestamp: '2025-06-09T14:00:00', status: 'approved' },
    ],
  },
  {
    id: 'prop4',
    address: '101 Maple Dr, Mesa, AZ 85201',
    city: 'Mesa',
    zip: '85201',
    opening_bid: 120000,
    title_notes: '',
    property_note: 'Needs significant foundation work. Considering postponing auction.',
    listed_date: '2025-08-01T00:00:00',
    auction_date: '2025-09-01T09:30:00',
    status: 'Pending Contract',
    as_is_estimate: 180000,
    rehab_estimate: 70000,
    arv_estimate: 290000,
    offer_75_estimate: 217500,
    twilio_log: [ { id: 'tlog4-1', type: 'System Log', message: 'Offer accepted, pending contract.', timestamp: '2025-08-28T10:00:00' }],
    bids: [
      { id: 'bid4-1', bid_amount: 220000, user_role: 'admin', timestamp: '2025-08-20T16:00:00', status: 'approved' },
    ],
  },
  {
    id: 'prop5',
    address: '222 Cedar Rd, Gilbert, AZ 85233',
    city: 'Gilbert',
    zip: '85233',
    opening_bid: 200000,
    title_notes: 'Clear',
    property_note: 'Recently renovated. Move-in ready. No current bids.',
    listed_date: '2025-09-01T00:00:00',
    auction_date: '2025-10-05T13:00:00',
    status: 'Active',
    as_is_estimate: 350000,
    rehab_estimate: 10000,
    arv_estimate: 370000,
    offer_75_estimate: 277500,
    twilio_log: [
        { id: 'tlog5-1', type: 'System Log', message: 'Property listed.', timestamp: '2025-09-15T08:00:00' },
    ],
    bids: [],
  },
  {
    id: 'prop6',
    address: '333 Willow Way, Chandler, AZ 85224',
    city: 'Chandler',
    zip: '85224',
    opening_bid: 175000,
    title_notes: 'Potential HOA issues',
    property_note: 'Auction canceled due to unforeseen legal complications.',
    listed_date: '2025-10-01T00:00:00',
    auction_date: '2025-11-10T10:00:00',
    status: 'Canceled',
    as_is_estimate: 290000,
    rehab_estimate: 30000,
    arv_estimate: 350000,
    offer_75_estimate: 262500,
    twilio_log: [
        { id: 'tlog6-1', type: 'System Log', message: 'Auction Canceled.', timestamp: '2025-10-20T14:30:00' },
    ],
    bids: [
        { id: 'bid6-1', bid_amount: 265000, user_role: 'member', timestamp: '2025-10-19T10:00:00', status: 'pending' },
    ],
  },
];

const MOCK_NOTIFICATIONS = Array.from({ length: 20 }, (_, i) => {
  const types = ['bid', 'status', 'system', 'general'];
  const type = types[i % types.length];
  let message = '';
  switch(type) {
    case 'bid': message = `New bid of ${formatCurrency(100000 + i*1000)} received on property #${i+101}.`; break;
    case 'status': message = `Property #${i+202} status updated to "Pending Contract".`; break;
    case 'system': message = `System scan completed. ${i % 3 === 0 ? 'No issues found.' : 'Minor alerts triggered.'}`; break;
    default: message = `User #${i+303} activity logged: Viewed property details.`;
  }
  if (i === 0) message = "CRITICAL: High-value bid on 123 Main St needs immediate review!";
  if (i === 1) message = "Contract for 456 Oak Ave has been successfully executed.";
  if (i > 15) message = `Reminder: Auction for Property ID PROP-${i+300} is scheduled for tomorrow.`;

  return {
    id: `notif-${Date.now()}-${i + 1}`,
    message,
    timestamp: new Date(Date.now() - Math.random() * 1000 * 60 * 60 * 24 * 3).toISOString(), // within last 3 days
    read: i > 4, // First 5 are unread
    type
  };
}).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());


const PROPERTY_STATUSES = ['Upcoming Sale', 'Active', 'Pending Contract', 'Sold', 'Canceled', 'Postponed'];
const DATE_FILTER_TYPES = {
  ALL: 'all',
  AUCTION_RANGE: 'auctionRange',
  UPCOMING_AUCTIONS: 'upcomingAuctions',
  PAST_AUCTIONS: 'pastAuctions',
  SPECIFIC_AUCTION_DATE: 'specificAuctionDate',
  DOM_RANGE: 'domRange',
};


// --- ICON COMPONENTS ---
const BellIcon = ({ className = "w-6 h-6" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
);

const UserIcon = ({ className = "w-6 h-6" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const LogoIcon = ({ className = "w-8 h-8" }) => (
<svg width="42" height="33" viewBox="0 0 42 33" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M12.0283 18.7585C12.4231 18.5306 12.9099 18.5307 13.3047 18.7585L19.8662 22.5466C20.0788 22.6694 20.0787 22.9765 19.8662 23.0993L4.39065 32.0339C4.24737 32.1165 4.06453 32.0761 3.97171 31.9392C2.63322 29.9654 1.63096 27.7449 1.04788 25.3601C1.01457 25.2237 1.07672 25.0826 1.19827 25.0124L12.0283 18.7585ZM20.8819 0.076889C32.1579 0.076889 41.2987 9.21788 41.2989 20.4939C41.2989 22.9913 40.851 25.3845 40.0303 27.5964C39.896 27.958 39.4669 28.1028 39.1328 27.9099L30.3574 22.8435L30.3223 22.823L30.3574 22.8025V17.9421C30.3574 16.8851 29.5004 16.0282 28.4434 16.0281C27.3863 16.0281 26.5293 16.885 26.5293 17.9421V20.6335L25.333 19.9431L17.6553 15.5105L13.9424 13.3669C13.1528 12.9111 12.1802 12.9111 11.3907 13.3669L7.67776 15.5105L1.4844 19.0867C1.04922 19.3379 0.511447 19.0097 0.559597 18.5095C1.5575 8.16474 10.2753 0.0768935 20.8819 0.076889Z" fill="#0041D9"/>
</svg>
);


// --- TOPBAR COMPONENT ---
const TopBar = ({
    notifications,
    showNotificationsDropdown,
    toggleNotificationsDropdown,
    showProfileDropdown,
    toggleProfileDropdown,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    notificationsRef,
    profileRef,
    notificationButtonRef,
    profileButtonRef
 }) => {
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <header className="fixed top-0 left-0 w-full bg-white shadow-md h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8 z-40">
      <div className="flex items-center">
        <LogoIcon className="h-8 w-8 text-indigo-600" />
        <span className="ml-3 text-xl font-semibold text-gray-700">Az Hub Admin</span>
      </div>
      <div className="flex items-center space-x-4">
        {/* Notifications */}
        <div className="relative" ref={notificationButtonRef}>
          <button
            onClick={toggleNotificationsDropdown}
            className="p-2 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            aria-label={`Notifications (${unreadCount} unread)`}
            aria-haspopup="true"
            aria-expanded={showNotificationsDropdown}
          >
            <BellIcon />
            {unreadCount > 0 && (
              <span className="absolute top-0 right-0 block h-2.5 w-2.5 transform -translate-y-1/2 translate-x-1/2 rounded-full bg-red-500 ring-2 ring-white"></span>
            )}
          </button>
          {showNotificationsDropdown && (
            <div
              ref={notificationsRef}
              className="origin-top-right absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-lg shadow-xl ring-1 ring-black ring-opacity-5 py-1 z-50"
              role="menu"
              aria-orientation="vertical"
              aria-labelledby="notifications-menu-button"
            >
              <div className="flex justify-between items-center px-4 py-2 border-b border-gray-200">
                <h3 className="text-md font-medium text-gray-800">Notifications</h3>
                {unreadCount > 0 && (
                   <button
                    onClick={markAllNotificationsAsRead}
                    className="text-xs text-indigo-600 hover:text-indigo-800 focus:outline-none"
                    >
                    Mark all as read
                    </button>
                )}
              </div>
              <ul className="max-h-96 overflow-y-auto">
                {notifications.length > 0 ? notifications.map(notification => (
                  <li key={notification.id} className={`${!notification.read ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}>
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        markNotificationAsRead(notification.id);
                        // Potentially navigate to the item related to notification
                        alert(`Notification clicked: ${notification.message}`);
                      }}
                      className={`block px-4 py-3 text-sm text-gray-700 transition-colors duration-150 ${!notification.read ? 'font-semibold' : ''}`}
                      role="menuitem"
                    >
                      <p className="truncate">{notification.message}</p>
                      <p className={`text-xs ${!notification.read ? 'text-indigo-500' : 'text-gray-500'}`}>{formatDateTime(notification.timestamp, {month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric'})}</p>
                    </a>
                     {!notification.read && <div className="absolute left-1 top-1/2 transform -translate-y-1/2 h-1.5 w-1.5 bg-indigo-500 rounded-full"></div>}
                  </li>
                )) : (
                  <li className="px-4 py-3 text-sm text-gray-500 text-center">No new notifications.</li>
                )}
              </ul>
              <div className="border-t border-gray-200">
                <a
                    href="#"
                    onClick={(e) => { e.preventDefault(); alert('Viewing all notifications...'); }}
                    className="block w-full px-4 py-3 text-sm font-medium text-center text-indigo-600 bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    role="menuitem"
                >
                    View All Notifications
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Profile Dropdown */}
        <div className="relative" ref={profileButtonRef}>
          <button
            onClick={toggleProfileDropdown}
            className="flex text-sm bg-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            id="user-menu-button"
            aria-expanded={showProfileDropdown}
            aria-haspopup="true"
            aria-label="User menu"
          >
            <span className="sr-only">Open user menu</span>
             <UserIcon className="w-8 h-8 rounded-full text-gray-600" />
          </button>
          {showProfileDropdown && (
            <div
              ref={profileRef}
              className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-50"
              role="menu"
              aria-orientation="vertical"
              aria-labelledby="user-menu-button"
            >
              <a href="#" onClick={(e)=>{e.preventDefault(); alert('Profile clicked')}} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" role="menuitem">Your Profile</a>
              <a href="#" onClick={(e)=>{e.preventDefault(); alert('Settings clicked')}} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" role="menuitem">Settings</a>
              <a href="#" onClick={(e)=>{e.preventDefault(); alert('Logout clicked')}} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" role="menuitem">Sign out</a>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};


// --- MODAL COMPONENTS ---
const ConfirmationModal = ({ isOpen, message, onConfirm, onCancel, confirmText = "Confirm", cancelText = "Cancel" }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true" aria-labelledby="confirmation-dialog-title">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
        <h2 id="confirmation-dialog-title" className="text-xl font-semibold mb-4 text-gray-800">Confirm Action</h2>
        <p className="mb-6 text-gray-700" dangerouslySetInnerHTML={{ __html: message }}></p>
        <div className="flex justify-end space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition duration-150"
            aria-label={cancelText}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition duration-150"
            aria-label={confirmText}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

const TwilioLogModal = ({ isOpen, logs, onClose, propertyAddress }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true" aria-labelledby="twilio-log-dialog-title">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <h2 id="twilio-log-dialog-title" className="text-xl font-semibold mb-1 text-gray-800">Twilio & System Logs</h2>
        <p className="text-sm text-gray-600 mb-4">For: {propertyAddress}</p>
        <div className="overflow-y-auto flex-grow mb-4 pr-2 space-y-3">
          {logs && logs.length > 0 ? (
            logs.map(log => (
              <div key={log.id} className="p-3 bg-gray-50 rounded-md border border-gray-200">
                <p className="text-sm font-medium text-gray-700">
                  <span className={`font-semibold ${log.type === 'SMS Sent' ? 'text-blue-600' : 'text-purple-600'}`}>{log.type}</span> - {formatDateTime(log.timestamp)}
                </p>
                <p className="text-xs text-gray-600 mt-1">{log.message}</p>
              </div>
            ))
          ) : (
            <p className="text-gray-600">No logs available for this property.</p>
          )}
        </div>
        <div className="flex justify-end mt-auto">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-indigo-500 text-white rounded-md hover:bg-indigo-600 transition duration-150"
            aria-label="Close Twilio log modal"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

interface FormErrors {
  address?: string | null;
  city?: string | null;
  zip?: string | null;
  opening_bid?: string | null;
  listed_date?: string | null;
  auction_date?: string | null;
  as_is_estimate?: string | null;
  rehab_estimate?: string | null;
  arv_estimate?: string | null;
  title_notes?: string | null;
  property_note?: string | null;
  status?: string | null;
}

interface InputFieldProps {
  id: string;
  name: string;
  label: string;
  type?: string;
  value: string; // All formData values are initially strings
  onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  error?: string | null;
  placeholder?: string;
  required?: boolean;
  children?: React.ReactNode;
}

const AddPropertyModal = ({ isOpen, onClose, onSaveProperty }) => {
  const initialFormData = {
    address: '', city: '', zip: '', opening_bid: '', listed_date: '', auction_date: '',
    status: 'Upcoming Sale', as_is_estimate: '', rehab_estimate: '', arv_estimate: '',
    title_notes: '', property_note: '',
  };
  const [formData, setFormData] = useState(initialFormData);
  const [errors, setErrors] = useState<FormErrors>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [name as keyof FormErrors]: null }));
    }
  };

  const validateForm = () => {
    const newErrors: FormErrors = {};
    if (!formData.address.trim()) newErrors.address = "Address is required.";
    if (!formData.city.trim()) newErrors.city = "City is required.";
    if (!formData.zip.trim()) newErrors.zip = "Zip code is required.";
    else if (!/^\d{5}(-\d{4})?$/.test(formData.zip)) newErrors.zip = "Invalid zip code format.";

    if (!formData.opening_bid) newErrors.opening_bid = "Opening bid is required.";
    else if (isNaN(parseFloat(formData.opening_bid)) || parseFloat(formData.opening_bid) <= 0) newErrors.opening_bid = "Opening bid must be a positive number.";

    if (!formData.listed_date) newErrors.listed_date = "Listed date is required.";
    if (!formData.auction_date) newErrors.auction_date = "Auction date is required.";
    else if (formData.listed_date && new Date(formData.auction_date) <= new Date(formData.listed_date)) {
      newErrors.auction_date = "Auction date must be after listed date.";
    }

    if (formData.as_is_estimate && (isNaN(parseFloat(formData.as_is_estimate)) || parseFloat(formData.as_is_estimate) < 0)) newErrors.as_is_estimate = "Must be a non-negative number.";
    if (formData.rehab_estimate && (isNaN(parseFloat(formData.rehab_estimate)) || parseFloat(formData.rehab_estimate) < 0)) newErrors.rehab_estimate = "Must be a non-negative number.";
    if (formData.arv_estimate && (isNaN(parseFloat(formData.arv_estimate)) || parseFloat(formData.arv_estimate) < 0)) newErrors.arv_estimate = "Must be a non-negative number.";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (validateForm()) {
      const numericOpeningBid = parseFloat(formData.opening_bid);
      const numericAsIs = formData.as_is_estimate ? parseFloat(formData.as_is_estimate) : 0;
      const numericRehab = formData.rehab_estimate ? parseFloat(formData.rehab_estimate) : 0;
      const numericArv = formData.arv_estimate ? parseFloat(formData.arv_estimate) : 0;

      onSaveProperty({
        ...formData,
        opening_bid: numericOpeningBid,
        as_is_estimate: numericAsIs,
        rehab_estimate: numericRehab,
        arv_estimate: numericArv,
        listed_date: formData.listed_date ? new Date(formData.listed_date).toISOString() : '',
        auction_date: formData.auction_date ? new Date(formData.auction_date).toISOString() : '',
      });
      setFormData(initialFormData);
      setErrors({});
    }
  };

  if (!isOpen) return null;

  const InputField: React.FC<InputFieldProps> = ({
    id,
    name,
    label,
    type = "text",
    value,
    onChange,
    error,
    placeholder,
    required = false,
    children
  }) => (
    <div className="mb-3">
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children ? children : (
        <input
          type={type}
          id={id}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm ${error ? 'border-red-500' : 'border-gray-300'}`}
          aria-required={required}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
        />
      )}
      {error && <p id={`${id}-error`} className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true" aria-labelledby="add-property-dialog-title">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <h2 id="add-property-dialog-title" className="text-xl font-semibold mb-6 text-gray-800">Add New Property</h2>
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-grow pr-2 space-y-1">
          <InputField id="address" name="address" label="Full Address" value={formData.address} onChange={handleChange} error={errors.address} placeholder="e.g., 123 Main St, City, ST 12345" required />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
            <InputField id="city" name="city" label="City" value={formData.city} onChange={handleChange} error={errors.city} placeholder="e.g., Phoenix" required />
            <InputField id="zip" name="zip" label="Zip Code" value={formData.zip} onChange={handleChange} error={errors.zip} placeholder="e.g., 85001" required />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
            <InputField id="opening_bid" name="opening_bid" label="Opening Bid ($)" type="number" value={formData.opening_bid} onChange={handleChange} error={errors.opening_bid} placeholder="e.g., 100000" required />
             <InputField id="status" name="status" label="Status" value={formData.status} onChange={handleChange} error={errors.status} required>
                <select id="status" name="status" value={formData.status} onChange={handleChange} className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm ${errors.status ? 'border-red-500' : 'border-gray-300'}`}>
                    {PROPERTY_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
            </InputField>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
            <InputField id="listed_date" name="listed_date" label="Listed Date" type="date" value={formData.listed_date} onChange={handleChange} error={errors.listed_date} required />
            <InputField id="auction_date" name="auction_date" label="Auction Date" type="date" value={formData.auction_date} onChange={handleChange} error={errors.auction_date} required />
          </div>
          <h3 className="text-md font-semibold text-gray-700 mt-4 mb-2 pt-2 border-t border-gray-200">Financial Estimates (Optional)</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4">
            <InputField id="as_is_estimate" name="as_is_estimate" label="As-Is Estimate ($)" type="number" value={formData.as_is_estimate} onChange={handleChange} error={errors.as_is_estimate} placeholder="e.g., 150000" />
            <InputField id="rehab_estimate" name="rehab_estimate" label="Rehab Estimate ($)" type="number" value={formData.rehab_estimate} onChange={handleChange} error={errors.rehab_estimate} placeholder="e.g., 25000" />
            <InputField id="arv_estimate" name="arv_estimate" label="ARV Estimate ($)" type="number" value={formData.arv_estimate} onChange={handleChange} error={errors.arv_estimate} placeholder="e.g., 220000" />
          </div>
           <h3 className="text-md font-semibold text-gray-700 mt-4 mb-2 pt-2 border-t border-gray-200">Notes (Optional)</h3>
          <InputField id="title_notes" name="title_notes" label="Title Notes" value={formData.title_notes} onChange={handleChange} error={errors.title_notes} placeholder="e.g., Clear title, potential lien...">
            <textarea id="title_notes" name="title_notes" value={formData.title_notes} onChange={handleChange} rows={3} className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm ${errors.title_notes ? 'border-red-500' : 'border-gray-300'}`} placeholder="e.g., Clear title, potential lien..."></textarea>
          </InputField>
          <InputField id="property_note" name="property_note" label="Property Notes" value={formData.property_note} onChange={handleChange} error={errors.property_note} placeholder="e.g., Needs kitchen remodel, tenant occupied...">
            <textarea id="property_note" name="property_note" value={formData.property_note} onChange={handleChange} rows={3} className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm ${errors.property_note ? 'border-red-500' : 'border-gray-300'}`} placeholder="e.g., Needs kitchen remodel, tenant occupied..."></textarea>
          </InputField>

          <div className="flex justify-end space-x-3 mt-8 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => { onClose(); setFormData(initialFormData); setErrors({}); }}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition duration-150"
              aria-label="Cancel adding property"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition duration-150"
              aria-label="Save new property"
            >
              Save Property
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


// --- PROPERTY DETAILS PAGE COMPONENT ---
const PropertyDetailsPage = ({
    property,
    onBack,
    onStatusChange,
    onNoteChange,
    onBidAction,
    onViewTwilioLog
}) => {
    if (!property) return <div className="p-8 text-center text-red-500">Property data not found.</div>;

    const pendingBids = property.bids.filter(b => b.status === 'pending');
    const approvedBids = property.bids.filter(b => b.status === 'approved');
    const rejectedBids = property.bids.filter(b => b.status === 'rejected');

    const DetailItem = ({ label, value, className = "" }) => (
        <div className={`mb-3 ${className}`}>
            <p className="text-xs text-gray-500 font-medium">{label}</p>
            <p className="text-sm text-gray-800">{value}</p>
        </div>
    );

    const BidCard = ({ bid, propertyId, onBidAction, type = "pending" }) => (
        <div key={bid.id} className={`p-3 rounded-md border mb-2 ${
            type === "pending" ? "bg-yellow-50 border-yellow-200" :
            type === "approved" ? "bg-green-50 border-green-200" :
            "bg-red-50 border-red-200"
        }`}>
            <div className="flex justify-between items-start">
                <div>
                    <p className={`text-md font-semibold ${
                        type === "pending" ? "text-yellow-800" :
                        type === "approved" ? "text-green-800" :
                        "text-red-800"
                    }`}>{formatCurrency(bid.bid_amount)}</p>
                    <p className="text-xs text-gray-600">{bid.user_role} - {formatDateTime(bid.timestamp)}</p>
                </div>
                {type === "pending" && (
                    <div className="flex space-x-2 flex-shrink-0 ml-2">
                        <button
                            onClick={() => onBidAction(propertyId, bid.id, 'approve')}
                            className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
                            aria-label={`Approve bid ${formatCurrency(bid.bid_amount)}`}
                        >
                            Approve
                        </button>
                        <button
                            onClick={() => onBidAction(propertyId, bid.id, 'reject')}
                            className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                            aria-label={`Reject bid ${formatCurrency(bid.bid_amount)}`}
                        >
                            Reject
                        </button>
                    </div>
                )}
            </div>
            {type !== "pending" && <p className="text-xs mt-1 font-medium">{type === "approved" ? "Approved" : "Rejected"}</p>}
        </div>
    );

    return (
        <div className="p-4 md:p-6 lg:p-8 bg-gray-50 min-h-full">
            <header className="mb-6 md:mb-8 flex justify-between items-center">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-800 break-all">{property.address}</h1>
                <button
                    onClick={onBack}
                    className="px-4 py-2 bg-indigo-500 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 transition duration-150"
                    aria-label="Back to dashboard"
                >
                    &larr; Back to Dashboard
                </button>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Column 1: Property Info & Notes */}
                <div className="lg:col-span-2 space-y-6">
                    <section className="bg-white p-6 rounded-lg shadow">
                        <h2 className="text-xl font-semibold text-gray-700 mb-4">Property Overview</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                            <DetailItem label="Full Address" value={property.address} />
                            <DetailItem label="City" value={property.city} />
                            <DetailItem label="Zip Code" value={property.zip} />
                            <DetailItem label="Listed Date" value={formatDateTime(property.listed_date)} />
                            <DetailItem label="Auction Date" value={formatDateTime(property.auction_date)} />
                            <DetailItem label="Opening Bid" value={formatCurrency(property.opening_bid)} />
                             {property.title_notes && <DetailItem label="Title Notes" value={property.title_notes} className="md:col-span-2"/>}
                        </div>
                        <div className="mt-4">
                            <label htmlFor="property-status-detail" className="block text-xs text-gray-500 font-medium mb-1">Status</label>
                            <div className="flex items-center space-x-3">
                                <span className={`px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full ${getStatusColor(property.status)} border`}>
                                    {property.status}
                                </span>
                                <select
                                    id="property-status-detail"
                                    value={property.status}
                                    onChange={(e) => onStatusChange(property.id, e.target.value)}
                                    className="block w-full max-w-xs pl-3 pr-10 py-2 text-sm border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md bg-white"
                                    aria-label={`Change status for ${property.address}`}
                                >
                                    {PROPERTY_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>
                    </section>

                    <section className="bg-white p-6 rounded-lg shadow">
                        <h2 className="text-xl font-semibold text-gray-700 mb-4">Financial Estimates (AI)</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-1">
                            <DetailItem label="75% Offer Estimate" value={<span className="font-bold text-green-600">{formatCurrency(property.offer_75_estimate)}</span>} />
                            <DetailItem label="ARV Estimate" value={formatCurrency(property.arv_estimate)} />
                            <DetailItem label="As-Is Estimate" value={formatCurrency(property.as_is_estimate)} />
                        </div>
                    </section>

                    <section className="bg-white p-6 rounded-lg shadow">
                        <h2 className="text-xl font-semibold text-gray-700 mb-2">Property Notes</h2>
                        <textarea
                            value={property.property_note}
                            onChange={(e) => onNoteChange(property.id, e.target.value)}
                            rows={5}
                            className="w-full text-sm text-gray-700 border border-gray-300 rounded-md p-3 focus:ring-indigo-500 focus:border-indigo-500"
                            aria-label={`Property notes for ${property.address}`}
                        />
                    </section>
                </div>

                {/* Column 2: Bids & Logs */}
                <div className="lg:col-span-1 space-y-6">
                    <section className="bg-white p-6 rounded-lg shadow">
                        <h2 className="text-xl font-semibold text-gray-700 mb-4">Bids Management</h2>
                        <div>
                            <h3 className="text-md font-semibold text-yellow-700 mb-2">Pending Bids ({pendingBids.length})</h3>
                            {pendingBids.length > 0 ? (
                                pendingBids.map(bid => <BidCard key={bid.id} bid={bid} propertyId={property.id} onBidAction={onBidAction} type="pending"/>)
                            ) : <p className="text-sm text-gray-500 italic">No pending bids.</p>}
                        </div>
                        <hr className="my-4"/>
                        <div>
                            <h3 className="text-md font-semibold text-green-700 mb-2">Approved Bids ({approvedBids.length})</h3>
                            {approvedBids.length > 0 ? (
                                approvedBids.map(bid => <BidCard key={bid.id} bid={bid} propertyId={property.id} onBidAction={onBidAction} type="approved"/>)
                            ) : <p className="text-sm text-gray-500 italic">No approved bids.</p>}
                        </div>
                        <hr className="my-4"/>
                        <div>
                            <h3 className="text-md font-semibold text-red-700 mb-2">Rejected Bids ({rejectedBids.length})</h3>
                            {rejectedBids.length > 0 ? (
                                rejectedBids.map(bid => <BidCard key={bid.id} bid={bid} propertyId={property.id} onBidAction={onBidAction} type="rejected"/>)
                            ) : <p className="text-sm text-gray-500 italic">No rejected bids.</p>}
                        </div>
                    </section>

                    <section className="bg-white p-6 rounded-lg shadow">
                         <h2 className="text-xl font-semibold text-gray-700 mb-4">Communication & System Log</h2>
                         <button
                            onClick={() => onViewTwilioLog(property)}
                            className="w-full px-4 py-2 bg-indigo-500 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 transition duration-150"
                            aria-label={`View Twilio log for ${property.address}, ${property.twilio_log.length} entries`}
                        >
                            View Log ({property.twilio_log.length})
                        </button>
                    </section>
                </div>
            </div>
        </div>
    );
};


// --- ADMIN DASHBOARD COMPONENT ---
const AdminDashboard = () => {
  const [properties, setProperties] = useState(MOCK_PROPERTIES_DATA);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const [dateFilterType, setDateFilterType] = useState(DATE_FILTER_TYPES.ALL);
  const [dateFilterValue1, setDateFilterValue1] = useState('');
  const [dateFilterValue2, setDateFilterValue2] = useState('');

  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedPropertyId, setSelectedPropertyId] = useState(null);

  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [confirmationAction, setConfirmationAction] = useState(null);

  const [showTwilioLogModal, setShowTwilioLogModal] = useState(false);
  const [selectedPropertyLogs, setSelectedPropertyLogs] = useState([]);
  const [selectedPropertyAddress, setSelectedPropertyAddress] = useState('');

  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);

  const [showAddPropertyModal, setShowAddPropertyModal] = useState(false);

  const notificationsRef = useRef(null);
  const profileRef = useRef(null);
  const notificationButtonRef = useRef(null);
  const profileButtonRef = useRef(null);

  const toggleNotificationsDropdown = useCallback(() => {
    setShowNotificationsDropdown(prev => !prev);
    setShowProfileDropdown(false);
  }, []);

  const toggleProfileDropdown = useCallback(() => {
    setShowProfileDropdown(prev => !prev);
    setShowNotificationsDropdown(false);
  }, []);

  const markNotificationAsRead = useCallback((notificationId) => {
    setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, read: true } : n));
  }, []);

  const markAllNotificationsAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);


  const calculateDOM = useCallback((property, currentDateNormalized) => {
    const listedDateNormalized = getDateNormalized(property.listed_date);
    if (!listedDateNormalized) return null;

    if (['Active', 'Upcoming Sale'].includes(property.status)) {
        return daysBetween(currentDateNormalized, listedDateNormalized);
    } else {
        const eventDateNormalized = getDateNormalized(property.auction_date);
        if (!eventDateNormalized) return null;
        return daysBetween(eventDateNormalized, listedDateNormalized);
    }
  }, []);

  const addTwilioLogEntry = useCallback((propertyId, type, message, specificProps) => {
    const updateFn = specificProps ?
      (props) => props.map(p => {
        if (p.id === propertyId) {
          const newLog = { id: `tlog-${p.id}-${Date.now()}`, type, message, timestamp: new Date().toISOString() };
          return { ...p, twilio_log: [newLog, ...p.twilio_log].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) };
        }
        return p;
      }) :
      (p) => { // This case is for adding to a new property that's not in the list yet.
        const newLog = { id: `tlog-${propertyId}-${Date.now()}`, type, message, timestamp: new Date().toISOString() };
        return [newLog];
      };

    if (specificProps) {
      setProperties(updateFn);
    } else {
      // This path is used by handleSaveNewProperty before setting properties
      // It returns the log array directly to be embedded in the new property object
      return updateFn(null);
    }
    console.log(`[Log Added for ${propertyId}]: ${type} - ${message}`);
  }, []);


  const handleSearchChange = (e) => setSearchTerm(e.target.value);
  const handleStatusFilterChange = (e) => setStatusFilter(e.target.value);

  const handleDateFilterTypeChange = (e) => {
    setDateFilterType(e.target.value);
    setDateFilterValue1('');
    setDateFilterValue2('');
  };
  const handleDateFilterValue1Change = (e) => setDateFilterValue1(e.target.value);
  const handleDateFilterValue2Change = (e) => setDateFilterValue2(e.target.value);


  const handleStatusChange = (propertyId, newStatus) => {
    const property = properties.find(p => p.id === propertyId);
    if (!property) return;
    setConfirmationAction({
      type: 'statusChange',
      payload: { propertyId, newStatus },
      message: `Are you sure you want to change the status of property <strong class="font-semibold">${property.address.split(',')[0]}</strong> to <strong class="font-semibold">${newStatus}</strong>?`,
    });
    setShowConfirmationModal(true);
  };

  const handleNoteChange = (propertyId, newNote) => {
    setProperties(prevProps => prevProps.map(p =>
      p.id === propertyId ? { ...p, property_note: newNote } : p
    ));
    // Could add a system log here if desired: addTwilioLogEntry(propertyId, 'System Log', 'Property note updated.');
    console.log(`[DB Update] Note for property ${propertyId} updated to: "${newNote}"`);
  };

  const handleBidAction = (propertyId, bidId, action) => {
    const property = properties.find(p => p.id === propertyId);
    if (!property) return;
    const bid = property.bids.find(b => b.id === bidId);
    if (!bid) return;
    setConfirmationAction({
      type: 'bidAction',
      payload: { propertyId, bidId, action },
      message: `Are you sure you want to <strong class="font-semibold ${action === 'approve' ? 'text-green-600' : 'text-red-600'}">${action.toUpperCase()}</strong> this bid of <strong class="font-semibold">${formatCurrency(bid.bid_amount)}</strong> for property <strong class="font-semibold">${property.address.split(',')[0]}</strong>?`,
    });
    setShowConfirmationModal(true);
  };

  const handleViewTwilioLog = (property) => {
    const sortedLogs = [...property.twilio_log].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setSelectedPropertyLogs(sortedLogs);
    setSelectedPropertyAddress(property.address);
    setShowTwilioLogModal(true);
  };

  const executeConfirmedAction = () => {
    if (!confirmationAction) return;
    const { type, payload } = confirmationAction;

    if (type === 'statusChange') {
      const { propertyId, newStatus } = payload;
      setProperties(prevProps => prevProps.map(p =>
        p.id === propertyId ? { ...p, status: newStatus } : p
      ));
      addTwilioLogEntry(propertyId, 'System Log', `Property status changed to ${newStatus}.`, properties);
      console.log(`[DB Update] Property ${propertyId} status changed to ${newStatus}`);
    } else if (type === 'bidAction') {
      const { propertyId, bidId, action } = payload;
      const property = properties.find(p => p.id === propertyId);
      if (!property) return;
      const bid = property.bids.find(b => b.id === bidId);
      if (!bid) return;

      setProperties(prevProps => prevProps.map(p => {
        if (p.id === propertyId) {
          const updatedBids = p.bids.map(b =>
            b.id === bidId ? { ...b, status: action === 'approve' ? 'approved' : 'rejected' } : b
          );
          return { ...p, bids: updatedBids };
        }
        return p;
      }));
      addTwilioLogEntry(propertyId, 'System Log', `Bid ${bidId} (${formatCurrency(bid.bid_amount)}) for property ${property.address.split(',')[0]} ${action === 'approve' ? 'approved' : 'rejected'}.`, properties);
      console.log(`[DB Update] Bid ${bidId} for property ${propertyId} ${action === 'approve' ? 'approved' : 'rejected'}`);
    }

    setShowConfirmationModal(false);
    setConfirmationAction(null);
  };

  const handleOpenAddPropertyModal = () => setShowAddPropertyModal(true);
  const handleCloseAddPropertyModal = () => setShowAddPropertyModal(false);

  const handleSaveNewProperty = (newPropertyData) => {
    const newPropertyId = `prop-${Date.now()}`;
    const offer_75_estimate = newPropertyData.arv_estimate ? newPropertyData.arv_estimate * 0.75 : 0;

    const initialLog = addTwilioLogEntry(newPropertyId, 'System Log', `Property created: ${newPropertyData.address.split(',')[0]}.`, null);

    const newProperty = {
      ...newPropertyData,
      id: newPropertyId,
      offer_75_estimate,
      twilio_log: initialLog,
      bids: [],
    };
    setProperties(prevProps => [newProperty, ...prevProps].sort((a,b) => new Date(b.auction_date).getTime() - new Date(a.auction_date).getTime()));
    handleCloseAddPropertyModal();
    console.log(`[DB Update] New property added: ${newPropertyId}`);
  };


  const filteredProperties = useMemo(() => {
    const todayNormalized = getDateNormalized(new Date().toISOString());

    return properties.filter(prop => {
      const searchTermLower = searchTerm.toLowerCase();
      const matchesSearch = (
        prop.address.toLowerCase().includes(searchTermLower) ||
        prop.city.toLowerCase().includes(searchTermLower) ||
        prop.zip.toLowerCase().includes(searchTermLower)
      );
      const matchesStatus = statusFilter === 'All' || prop.status === statusFilter;
      if (!matchesSearch || !matchesStatus) return false;

      const propAuctionDateNormalized = getDateNormalized(prop.auction_date);

      switch (dateFilterType) {
        case DATE_FILTER_TYPES.AUCTION_RANGE: {
          const startDate = dateFilterValue1 ? getDateNormalized(dateFilterValue1) : null;
          const endDate = dateFilterValue2 ? getDateNormalized(dateFilterValue2) : null;
          if (!propAuctionDateNormalized) return false;
          if (startDate && propAuctionDateNormalized < startDate) return false;
          if (endDate && propAuctionDateNormalized > endDate) return false;
          return true;
        }
        case DATE_FILTER_TYPES.UPCOMING_AUCTIONS: {
          const days = dateFilterValue1 ? parseInt(dateFilterValue1, 10) : NaN;
          if (isNaN(days) || !propAuctionDateNormalized || !todayNormalized) return true;
          const targetDate = new Date(todayNormalized);
          targetDate.setDate(todayNormalized.getDate() + days);
          return propAuctionDateNormalized >= todayNormalized && propAuctionDateNormalized <= targetDate;
        }
        case DATE_FILTER_TYPES.PAST_AUCTIONS: {
          const days = dateFilterValue1 ? parseInt(dateFilterValue1, 10) : NaN;
          if (isNaN(days) || !propAuctionDateNormalized || !todayNormalized) return true;
          const targetDate = new Date(todayNormalized);
          targetDate.setDate(todayNormalized.getDate() - days);
          return propAuctionDateNormalized <= todayNormalized && propAuctionDateNormalized >= targetDate;
        }
        case DATE_FILTER_TYPES.SPECIFIC_AUCTION_DATE: {
          const specificDate = dateFilterValue1 ? getDateNormalized(dateFilterValue1) : null;
          if (!specificDate || !propAuctionDateNormalized) return !specificDate;
          return propAuctionDateNormalized.getTime() === specificDate.getTime();
        }
        case DATE_FILTER_TYPES.DOM_RANGE: {
          const dom = calculateDOM(prop, todayNormalized);
          if (dom === null) return true;
          const minDOM = dateFilterValue1 ? parseInt(dateFilterValue1, 10) : 0;
          const maxDOM = dateFilterValue2 ? parseInt(dateFilterValue2, 10) : Infinity;
           if (dateFilterValue1 === '' && dateFilterValue2 === '') return true;
          if (minDOM !== 0 && isNaN(minDOM)) return true;
          if (maxDOM !== Infinity && isNaN(maxDOM)) return true;
          if (dom < minDOM) return false;
          if (dom > maxDOM && maxDOM !== Infinity) return false;
          return true;
        }
        case DATE_FILTER_TYPES.ALL:
        default:
          return true;
      }
    }).sort((a,b) => new Date(b.auction_date).getTime() - new Date(a.auction_date).getTime());
  }, [properties, searchTerm, statusFilter, dateFilterType, dateFilterValue1, dateFilterValue2, calculateDOM]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showNotificationsDropdown && notificationsRef.current && !notificationsRef.current.contains(event.target) && notificationButtonRef.current && !notificationButtonRef.current.contains(event.target)) {
        setShowNotificationsDropdown(false);
      }
      if (showProfileDropdown && profileRef.current && !profileRef.current.contains(event.target) && profileButtonRef.current && !profileButtonRef.current.contains(event.target)) {
        setShowProfileDropdown(false);
      }
    };

    const handleEscapeKey = (event) => {
      if (event.key === 'Escape') {
        setShowNotificationsDropdown(false);
        setShowProfileDropdown(false);
        if (showAddPropertyModal) {
            handleCloseAddPropertyModal();
        }
        if (showConfirmationModal) {
          setShowConfirmationModal(false);
          setConfirmationAction(null);
        }
        if (showTwilioLogModal) {
          setShowTwilioLogModal(false);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [showNotificationsDropdown, showProfileDropdown, showConfirmationModal, showTwilioLogModal, showAddPropertyModal, notificationsRef, profileRef, notificationButtonRef, profileButtonRef, handleCloseAddPropertyModal]);


  const handleViewPropertyDetails = (propertyId) => {
    setSelectedPropertyId(propertyId);
    setCurrentView('propertyDetails');
  };

  const handleBackToDashboard = () => {
    setCurrentView('dashboard');
    setSelectedPropertyId(null);
  };

  const selectedProperty = useMemo(() => {
    if (currentView === 'propertyDetails' && selectedPropertyId) {
      return properties.find(p => p.id === selectedPropertyId);
    }
    return null;
  }, [properties, currentView, selectedPropertyId]);


  if (currentView === 'propertyDetails' && selectedProperty) {
    return (
        <div className="flex flex-col min-h-screen bg-gray-50">
            <TopBar
                notifications={notifications}
                showNotificationsDropdown={showNotificationsDropdown}
                toggleNotificationsDropdown={toggleNotificationsDropdown}
                showProfileDropdown={showProfileDropdown}
                toggleProfileDropdown={toggleProfileDropdown}
                markNotificationAsRead={markNotificationAsRead}
                markAllNotificationsAsRead={markAllNotificationsAsRead}
                notificationsRef={notificationsRef}
                profileRef={profileRef}
                notificationButtonRef={notificationButtonRef}
                profileButtonRef={profileButtonRef}
            />
            <main className="flex-grow pt-16">
                <PropertyDetailsPage
                    property={selectedProperty}
                    onBack={handleBackToDashboard}
                    onStatusChange={handleStatusChange}
                    onNoteChange={handleNoteChange}
                    onBidAction={handleBidAction}
                    onViewTwilioLog={handleViewTwilioLog}
                />
            </main>
            <ConfirmationModal
                isOpen={showConfirmationModal}
                message={confirmationAction?.message || ''}
                onConfirm={executeConfirmedAction}
                onCancel={() => {
                setShowConfirmationModal(false);
                setConfirmationAction(null);
                }}
            />
            <TwilioLogModal
                isOpen={showTwilioLogModal}
                logs={selectedPropertyLogs}
                propertyAddress={selectedPropertyAddress}
                onClose={() => setShowTwilioLogModal(false)}
            />
             <AddPropertyModal
                isOpen={showAddPropertyModal}
                onClose={handleCloseAddPropertyModal}
                onSaveProperty={handleSaveNewProperty}
            />
        </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
       <TopBar
            notifications={notifications}
            showNotificationsDropdown={showNotificationsDropdown}
            toggleNotificationsDropdown={toggleNotificationsDropdown}
            showProfileDropdown={showProfileDropdown}
            toggleProfileDropdown={toggleProfileDropdown}
            markNotificationAsRead={markNotificationAsRead}
            markAllNotificationsAsRead={markAllNotificationsAsRead}
            notificationsRef={notificationsRef}
            profileRef={profileRef}
            notificationButtonRef={notificationButtonRef}
            profileButtonRef={profileButtonRef}
        />
      <main className="flex-grow pt-16">
        <div className="p-4 md:p-6 lg:p-8">
          <header className="mb-6 md:mb-8">
            <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
              <h1 className="text-3xl font-bold text-gray-800">Property Listings</h1>
              <button
                onClick={handleOpenAddPropertyModal}
                className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 transition duration-150"
                aria-label="Add new property"
              >
                + Add Property
              </button>
            </div>
          </header>

          <section className="mb-6 p-4 bg-white rounded-lg shadow">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label htmlFor="search-properties" className="block text-sm font-medium text-gray-700 mb-1">Search Properties</label>
                <input
                  id="search-properties"
                  type="text"
                  placeholder="Filter by Address, City, or Zip..."
                  value={searchTerm}
                  onChange={handleSearchChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  aria-label="Search properties by address, city, or zip"
                />
              </div>
              <div>
                <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 mb-1">Filter by Status</label>
                <select
                  id="status-filter"
                  value={statusFilter}
                  onChange={handleStatusFilterChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                  aria-label="Filter properties by status"
                >
                  <option value="All">All Statuses</option>
                  {PROPERTY_STATUSES.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200">
                <label htmlFor="date-filter-type" className="block text-sm font-medium text-gray-700 mb-1">Filter by Date</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <select
                        id="date-filter-type"
                        value={dateFilterType}
                        onChange={handleDateFilterTypeChange}
                        className="md:col-span-1 w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                        aria-label="Select date filter type"
                    >
                        <option value={DATE_FILTER_TYPES.ALL}>All Dates</option>
                        <option value={DATE_FILTER_TYPES.AUCTION_RANGE}>Auction Date Range</option>
                        <option value={DATE_FILTER_TYPES.UPCOMING_AUCTIONS}>Upcoming Auctions (Next X days)</option>
                        <option value={DATE_FILTER_TYPES.PAST_AUCTIONS}>Past Auctions (Last X days)</option>
                        <option value={DATE_FILTER_TYPES.SPECIFIC_AUCTION_DATE}>Specific Auction Date</option>
                        <option value={DATE_FILTER_TYPES.DOM_RANGE}>Days on Market Range</option>
                    </select>

                    {[DATE_FILTER_TYPES.AUCTION_RANGE, DATE_FILTER_TYPES.SPECIFIC_AUCTION_DATE].includes(dateFilterType) && (
                        <div className="md:col-span-1">
                            <label htmlFor="date-filter-value1-date" className="sr-only">
                                {dateFilterType === DATE_FILTER_TYPES.SPECIFIC_AUCTION_DATE ? 'Specific Date' : 'Start Date'}
                            </label>
                            <input
                                id="date-filter-value1-date"
                                type="date"
                                value={dateFilterValue1}
                                onChange={handleDateFilterValue1Change}
                                className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                                aria-label={dateFilterType === DATE_FILTER_TYPES.SPECIFIC_AUCTION_DATE ? 'Specific auction date' : 'Auction start date'}
                            />
                        </div>
                    )}
                    {dateFilterType === DATE_FILTER_TYPES.AUCTION_RANGE && (
                         <div className="md:col-span-1">
                            <label htmlFor="date-filter-value2-date" className="sr-only">End Date</label>
                            <input
                                id="date-filter-value2-date"
                                type="date"
                                value={dateFilterValue2}
                                onChange={handleDateFilterValue2Change}
                                className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                                aria-label="Auction end date"
                            />
                        </div>
                    )}

                    {[DATE_FILTER_TYPES.UPCOMING_AUCTIONS, DATE_FILTER_TYPES.PAST_AUCTIONS].includes(dateFilterType) && (
                        <div className="md:col-span-2 flex items-center space-x-2">
                            <input
                                id="date-filter-value1-days"
                                type="number"
                                min="0"
                                placeholder="Enter days"
                                value={dateFilterValue1}
                                onChange={handleDateFilterValue1Change}
                                className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                                aria-label={dateFilterType === DATE_FILTER_TYPES.UPCOMING_AUCTIONS ? 'Number of upcoming days' : 'Number of past days'}
                            />
                            <span className="text-sm text-gray-700">days</span>
                        </div>
                    )}
                     {dateFilterType === DATE_FILTER_TYPES.DOM_RANGE && (
                        <>
                            <div className="md:col-span-1">
                                <label htmlFor="date-filter-value1-dom" className="sr-only">Min DOM</label>
                                <input
                                    id="date-filter-value1-dom"
                                    type="number"
                                    min="0"
                                    placeholder="Min DOM"
                                    value={dateFilterValue1}
                                    onChange={handleDateFilterValue1Change}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                                    aria-label="Minimum days on market"
                                />
                            </div>
                            <div className="md:col-span-1">
                                 <label htmlFor="date-filter-value2-dom" className="sr-only">Max DOM</label>
                                <input
                                    id="date-filter-value2-dom"
                                    type="number"
                                    min="0"
                                    placeholder="Max DOM"
                                    value={dateFilterValue2}
                                    onChange={handleDateFilterValue2Change}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                                    aria-label="Maximum days on market"
                                />
                            </div>
                        </>
                    )}
                    {(dateFilterType === DATE_FILTER_TYPES.SPECIFIC_AUCTION_DATE ) && <div className="hidden md:block md:col-span-1"></div>}
                </div>
            </div>
          </section>

          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"><span className="sr-only">Details</span></th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Address / Auction Date</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">75% Offer (AI)</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Property Notes</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pending Bids / Approved</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Log</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredProperties.length > 0 ? filteredProperties.map(prop => {
                    const pendingBids = prop.bids.filter(b => b.status === 'pending');
                    const approvedBidsCount = prop.bids.filter(b => b.status === 'approved').length;

                    return (
                      <tr
                        key={prop.id}
                        className="hover:bg-gray-50 transition-colors duration-150 cursor-pointer"
                        onClick={() => handleViewPropertyDetails(prop.id)}
                        role="link"
                        tabIndex={0}
                        onKeyPress={(e) => (e.key === 'Enter' || e.key === ' ') && handleViewPropertyDetails(prop.id)}
                      >
                        <td className="px-3 py-4 whitespace-nowrap">
                            <button
                                onClick={(e) => { e.stopPropagation(); handleViewPropertyDetails(prop.id); }}
                                className="text-indigo-600 hover:text-indigo-800 text-sm font-medium focus:outline-none focus:underline"
                                aria-label={`View details for ${prop.address}`}
                            >
                                Details
                            </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{prop.address.split(',')[0]}</div>
                          <div className="text-xs text-gray-500">{`${prop.city}, ${prop.zip}`}</div>
                          <div className="text-xs text-indigo-600 mt-1">Auction: {formatDateTime(prop.auction_date)}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(prop.status)} border`}
                            onClick={(e) => e.stopPropagation()}
                           >
                            {prop.status}
                          </span>
                          <select
                            value={prop.status}
                            onChange={(e) => { e.stopPropagation(); handleStatusChange(prop.id, e.target.value);}}
                            onClick={(e) => e.stopPropagation()}
                            className="mt-1 block w-full pl-3 pr-10 py-1 text-xs border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md bg-white"
                            aria-label={`Change status for ${prop.address}`}
                          >
                            {PROPERTY_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-bold text-green-600">{formatCurrency(prop.offer_75_estimate)}</div>
                          <div className="text-xs text-gray-500">ARV: {formatCurrency(prop.arv_estimate)}</div>
                          <div className="text-xs text-gray-500">As-Is: {formatCurrency(prop.as_is_estimate)}</div>
                        </td>
                        <td className="px-6 py-4">
                          <textarea
                            value={prop.property_note}
                            onChange={(e) => {e.stopPropagation(); handleNoteChange(prop.id, e.target.value);}}
                            onClick={(e) => e.stopPropagation()}
                            onFocus={(e) => e.stopPropagation()}
                            rows={3}
                            className="w-full text-xs text-gray-700 border border-gray-300 rounded-md p-2 focus:ring-indigo-500 focus:border-indigo-500 min-w-[200px]"
                            aria-label={`Property notes for ${prop.address}`}
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {pendingBids.length > 0 ? (
                            pendingBids.map(bid => (
                              <div key={bid.id} className="mb-2 p-2 border border-gray-200 rounded-md bg-yellow-50" onClick={(e) => e.stopPropagation()}>
                                <div className="text-sm font-semibold text-yellow-800">{formatCurrency(bid.bid_amount)}</div>
                                <div className="text-xs text-gray-600">{bid.user_role} - {formatDateTime(bid.timestamp)}</div>
                                <div className="mt-1 space-x-2">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleBidAction(prop.id, bid.id, 'approve');}}
                                    className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
                                    aria-label={`Approve bid ${formatCurrency(bid.bid_amount)} for ${prop.address}`}
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleBidAction(prop.id, bid.id, 'reject');}}
                                    className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                                    aria-label={`Reject bid ${formatCurrency(bid.bid_amount)} for ${prop.address}`}
                                  >
                                    Reject
                                  </button>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-xs text-gray-500 italic" onClick={(e) => e.stopPropagation()}>No pending bids.</div>
                          )}
                          <div className="text-xs text-gray-500 mt-2" onClick={(e) => e.stopPropagation()}>({approvedBidsCount} approved bid(s))</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleViewTwilioLog(prop);}}
                            className="w-full px-3 py-2 text-xs bg-purple-500 text-white rounded-md hover:bg-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50"
                            aria-label={`View Twilio log for ${prop.address}, ${prop.twilio_log.length} entries`}
                          >
                            View Log ({prop.twilio_log.length})
                          </button>
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center">
                        <div className="text-lg font-medium text-gray-700">No properties match your filters.</div>
                        <p className="text-sm text-gray-500">Try adjusting your search or filter criteria.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      <ConfirmationModal
        isOpen={showConfirmationModal}
        message={confirmationAction?.message || ''}
        onConfirm={executeConfirmedAction}
        onCancel={() => {
          setShowConfirmationModal(false);
          setConfirmationAction(null);
        }}
      />
      <TwilioLogModal
        isOpen={showTwilioLogModal}
        logs={selectedPropertyLogs}
        propertyAddress={selectedPropertyAddress}
        onClose={() => setShowTwilioLogModal(false)}
      />
      <AddPropertyModal
        isOpen={showAddPropertyModal}
        onClose={handleCloseAddPropertyModal}
        onSaveProperty={handleSaveNewProperty}
      />
    </div>
  );
};

// --- APP WRAPPER & RENDER ---
const App = () => (
  <React.StrictMode>
    <AdminDashboard />
  </React.StrictMode>
);

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
