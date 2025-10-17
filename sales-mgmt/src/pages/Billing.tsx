import React, { useEffect, useState } from 'react';
import { 
  Download, 
  Mail, 
  Eye, 
  Plus, 
  Calendar, 
  MapPin, 
  DollarSign,
  FileText,
  Send,
  CheckCircle,
  Clock,
  AlertCircle
} from 'lucide-react';

type Invoice = {
  _id: string;
  client: string;
  product: string;
  price: number;
  location?: { lat: number; lng: number };
  emailTo?: string;
  emailSent: boolean;
  emailSentAt?: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  paidAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export default function Billing(): React.ReactElement {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showEmailForm, setShowEmailForm] = useState(false);
  
  // Create invoice form
  const [newInvoice, setNewInvoice] = useState({
    client: '',
    product: '',
    price: '',
    notes: ''
  });
  
  // Email form
  const [emailForm, setEmailForm] = useState({
    to: '',
    subject: '',
    message: ''
  });
  const [sendingEmail, setSendingEmail] = useState(false);
  
  // Location
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  async function loadInvoices() {
    setLoading(true);
    try {
      const response = await fetch('/api/invoices', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });
      const data = await response.json();
      setInvoices(data);
    } catch (error) {
      console.error('Failed to load invoices:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInvoices();
    // Capture location on page load
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setLocation(null),
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  }, []);

  async function createInvoice() {
    if (!newInvoice.client || !newInvoice.product || !newInvoice.price) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const response = await fetch('/api/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          ...newInvoice,
          price: parseFloat(newInvoice.price),
          coords: location
        })
      });

      if (response.ok) {
        setNewInvoice({ client: '', product: '', price: '', notes: '' });
        setShowCreateForm(false);
        await loadInvoices();
        alert('Invoice created successfully!');
      } else {
        const error = await response.json();
        alert('Error creating invoice: ' + error.error);
      }
    } catch (error) {
      alert('Error creating invoice: ' + error);
    }
  }

  async function sendEmail(invoiceId: string) {
    if (!emailForm.to) {
      alert('Please enter recipient email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailForm.to)) {
      alert('Please enter a valid email address');
      return;
    }

    setSendingEmail(true);
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          to: emailForm.to,
          subject: emailForm.subject || `Invoice #${invoiceId.slice(-8)} - Your Purchase`,
          message: emailForm.message
        })
      });

      const result = await response.json();
      
      if (result.success) {
        alert(`✅ Invoice sent successfully to ${result.recipient}!`);
        setEmailForm({ to: '', subject: '', message: '' });
        setShowEmailForm(false);
        setSelectedInvoice(null);
        await loadInvoices(); // Refresh the invoices list
      } else {
        alert('❌ Error sending invoice: ' + result.message);
      }
    } catch (error) {
      console.error('Email error:', error);
      alert('❌ Error sending invoice: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setSendingEmail(false);
    }
  }


  function openPDF(invoiceId: string) {
    const token = localStorage.getItem('auth_token');
    
    // Fetch PDF with authentication
    fetch(`/api/invoices/${invoiceId}/pdf`, {
      headers: { 
        'Authorization': `Bearer ${token}` 
      }
    })
    .then(response => {
      if (response.ok) {
        return response.blob();
      }
      throw new Error('Failed to generate PDF');
    })
    .then(blob => {
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${invoiceId}.html`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    })
    .catch(error => {
      console.error('Error:', error);
      alert('Error generating PDF. Please make sure you are logged in.');
    });
  }

  function getStatusColor(status: string) {
    const colors = {
      draft: 'bg-gray-100 text-gray-800',
      sent: 'bg-blue-100 text-blue-800',
      paid: 'bg-green-100 text-green-800',
      overdue: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-800'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'draft': return <FileText className="h-4 w-4" />;
      case 'sent': return <Send className="h-4 w-4" />;
      case 'paid': return <CheckCircle className="h-4 w-4" />;
      case 'overdue': return <AlertCircle className="h-4 w-4" />;
      case 'cancelled': return <Clock className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency: 'GHS'
    }).format(amount);
  }

  const totalRevenue = invoices.reduce((sum, invoice) => sum + invoice.price, 0);
  const paidInvoices = invoices.filter(invoice => invoice.status === 'paid').length;
  const pendingInvoices = invoices.filter(invoice => invoice.status === 'sent').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Billing & Invoices</h1>
          <p className="text-gray-600">Manage invoices and billing</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 h-9 px-4 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            New Invoice
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(totalRevenue)}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-green-600" />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {invoices.length} invoices
            </p>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Paid Invoices</p>
                <p className="text-2xl font-bold text-blue-600">
                  {paidInvoices}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-blue-600" />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {pendingInvoices} pending
            </p>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Location</p>
                <p className="text-sm font-bold text-purple-600">
                  {location ? 'Captured' : 'Not Available'}
                </p>
              </div>
              <MapPin className="h-8 w-8 text-purple-600" />
            </div>
            {location && (
              <p className="text-xs text-gray-500 mt-1">
                {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Invoice List */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <div>Invoices ({invoices.length})</div>
          {loading && <div className="text-sm text-gray-500">Loading...</div>}
        </div>
        <div className="card-body">
          <div className="space-y-3">
            {invoices.map((invoice) => (
              <div key={invoice._id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-medium">#{invoice._id.slice(-8)}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusColor(invoice.status)}`}>
                        {getStatusIcon(invoice.status)}
                        {invoice.status}
                      </span>
                      {invoice.emailSent && (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Email Sent
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Client:</span>
                        <span className="ml-2 font-medium">{invoice.client}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Product:</span>
                        <span className="ml-2 font-medium">{invoice.product}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Amount:</span>
                        <span className="ml-2 font-bold text-green-600">
                          {formatCurrency(invoice.price)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(invoice.createdAt).toLocaleDateString()}
                      </div>
                      {invoice.location && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {invoice.location.lat.toFixed(2)}, {invoice.location.lng.toFixed(2)}
                        </div>
                      )}
                      {invoice.emailTo && (
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {invoice.emailTo}
                        </div>
                      )}
                    </div>
                    {invoice.notes && (
                      <div className="mt-2 text-sm text-gray-600">
                        <span className="font-medium">Notes:</span> {invoice.notes}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => openPDF(invoice._id)}
                      className="h-8 px-3 rounded-md border border-gray-200 text-sm hover:bg-gray-50 flex items-center gap-1"
                    >
                      <Eye className="h-3 w-3" />
                      View
                    </button>
                    <button
                      onClick={() => openPDF(invoice._id)}
                      className="h-8 px-3 rounded-md border border-gray-200 text-sm hover:bg-gray-50 flex items-center gap-1"
                    >
                      <Download className="h-3 w-3" />
                      PDF
                    </button>
                    {!invoice.emailSent && (
                      <button
                        onClick={() => {
                          setSelectedInvoice(invoice);
                          setEmailForm({ 
                            to: invoice.emailTo || '', 
                            subject: `Invoice #${invoice._id.slice(-8)} - ${invoice.product}`,
                            message: ''
                          });
                          setShowEmailForm(true);
                        }}
                        className="h-8 px-3 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700 flex items-center gap-1"
                      >
                        <Mail className="h-3 w-3" />
                        Email
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {invoices.length === 0 && !loading && (
              <div className="text-center py-8 text-gray-500">
                No invoices found. Create your first invoice to get started.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Invoice Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold mb-4">Create New Invoice</h2>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Client name"
                value={newInvoice.client}
                onChange={(e) => setNewInvoice(prev => ({ ...prev, client: e.target.value }))}
                className="w-full h-10 border border-gray-200 rounded-md px-3 text-sm"
              />
              <input
                type="text"
                placeholder="Product description"
                value={newInvoice.product}
                onChange={(e) => setNewInvoice(prev => ({ ...prev, product: e.target.value }))}
                className="w-full h-10 border border-gray-200 rounded-md px-3 text-sm"
              />
              <input
                type="number"
                placeholder="Price (GHS)"
                value={newInvoice.price}
                onChange={(e) => setNewInvoice(prev => ({ ...prev, price: e.target.value }))}
                className="w-full h-10 border border-gray-200 rounded-md px-3 text-sm"
                step="0.01"
                min="0"
              />
              <textarea
                placeholder="Notes (optional)"
                value={newInvoice.notes}
                onChange={(e) => setNewInvoice(prev => ({ ...prev, notes: e.target.value }))}
                className="w-full h-20 border border-gray-200 rounded-md px-3 py-2 text-sm resize-none"
              />
              {location && (
                <div className="text-xs text-green-600 flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  Location captured: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCreateForm(false)}
                className="h-9 px-4 rounded-md border border-gray-200 text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={createInvoice}
                className="h-9 px-4 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700"
              >
                Create Invoice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email Invoice Modal */}
      {showEmailForm && selectedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Send Invoice via Email</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Recipient Email *
                </label>
                <input
                  type="email"
                  value={emailForm.to}
                  onChange={(e) => setEmailForm(prev => ({ ...prev, to: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="client@example.com"
                  required
                  disabled={sendingEmail}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  value={emailForm.subject}
                  onChange={(e) => setEmailForm(prev => ({ ...prev, subject: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Invoice for your purchase"
                  disabled={sendingEmail}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Personal Message
                </label>
                <textarea
                  value={emailForm.message}
                  onChange={(e) => setEmailForm(prev => ({ ...prev, message: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Thank you for your business! Please find your invoice attached..."
                  disabled={sendingEmail}
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 p-3 rounded-md text-sm">
                <p className="font-medium text-blue-900 mb-2">Invoice Details:</p>
                <p><strong>Invoice #:</strong> {selectedInvoice._id.slice(-8)}</p>
                <p><strong>Client:</strong> {selectedInvoice.client}</p>
                <p><strong>Product:</strong> {selectedInvoice.product}</p>
                <p><strong>Amount:</strong> {formatCurrency(selectedInvoice.price)}</p>
              </div>
            </div>
            
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => {
                  setShowEmailForm(false);
                  setSelectedInvoice(null);
                  setEmailForm({ to: '', subject: '', message: '' });
                }}
                disabled={sendingEmail}
                className="flex-1 px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={() => sendEmail(selectedInvoice._id)}
                disabled={!emailForm.to || sendingEmail}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {sendingEmail ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Send Invoice
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}