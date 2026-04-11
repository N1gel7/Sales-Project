import React, { useEffect, useState } from 'react';
import LocationText from '../components/LocationText';
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
import { toast } from 'sonner';

type InvoiceItem = {
  productId?: string;
  name: string;
  quantity: number;
  price: number;
};

type Invoice = {
  _id: string;
  client: string;
  product: string;
  price: number;
  items?: InvoiceItem[];
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
  const [products, setProducts] = useState<{ _id?: string, id?: string, name: string, price: number, category?: any }[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  
  // Create invoice form
  const [newInvoice, setNewInvoice] = useState({
    client: '',
    items: [] as InvoiceItem[],
    notes: ''
  });
  
  // Current item being added
  const [currentItem, setCurrentItem] = useState({
    productId: '',
    name: '',
    quantity: 1,
    price: 0
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
      console.log('[loadInvoices] status:', response.status, 'count:', Array.isArray(data) ? data.length : 'NOT_ARRAY', data);
      if (Array.isArray(data)) {
        setInvoices(data);
      }
    } catch (error) {
      console.error('Failed to load invoices:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadProducts() {
    try {
      const response = await fetch('/api/products', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });
      if (response.ok) {
        const data = await response.json();
        setProducts(data);
      }
    } catch (error) {
      console.error('Failed to load products:', error);
    }
  }

  useEffect(() => {
    loadInvoices();
    loadProducts();
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
    if (!newInvoice.client || newInvoice.items.length === 0) {
      toast.error('Please add a client and at least one product.');
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
          client: newInvoice.client,
          items: newInvoice.items,
          notes: newInvoice.notes,
          coords: location
        })
      });

      if (response.ok) {
        setNewInvoice({ client: '', items: [], notes: '' });
        setShowCreateForm(false);
        await loadInvoices();
        toast.success('Invoice created.');
      } else {
        const error = await response.json();
        toast.error(typeof error.error === 'string' ? error.error : 'Could not create invoice.');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create invoice.');
    }
  }

  function addItem() {
    if (!currentItem.name || currentItem.price <= 0 || currentItem.quantity <= 0) {
      toast.error('Please select a product and set valid quantity/price.');
      return;
    }
    setNewInvoice(prev => ({
      ...prev,
      items: [...prev.items, { ...currentItem }]
    }));
    setCurrentItem({ productId: '', name: '', quantity: 1, price: 0 });
  }

  function removeItem(index: number) {
    setNewInvoice(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  }

  async function markAsPaid(invoiceId: string) {
    // Optimistically update local state immediately
    setInvoices(prev => prev.map(inv =>
      inv._id === invoiceId ? { ...inv, status: 'paid' as const } : inv
    ));

    try {
      const response = await fetch(`/api/invoices/${invoiceId}/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      const body = await response.text();
      console.log('[markAsPaid] Response:', response.status, body);

      if (response.ok) {
        toast.success('Invoice marked as paid.');
      } else {
        await loadInvoices();
        toast.error('Failed to mark invoice as paid.');
      }
    } catch (error) {
      console.error('[markAsPaid] Error:', error);
      await loadInvoices();
      toast.error('Failed to update invoice.');
    }
  }

  async function sendEmail(invoiceId: string) {
    if (!emailForm.to) {
      toast.error('Please enter a recipient email address.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailForm.to)) {
      toast.error('Please enter a valid email address.');
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
        toast.success(`Invoice sent to ${result.recipient ?? emailForm.to}`);
        setEmailForm({ to: '', subject: '', message: '' });
        setShowEmailForm(false);
        setSelectedInvoice(null);
        await loadInvoices();
      } else {
        toast.error(typeof result.message === 'string' ? result.message : 'Could not send invoice.');
      }
    } catch (error) {
      console.error('Email error:', error);
      toast.error(error instanceof Error ? error.message : 'Could not send invoice.');
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
      a.download = `invoice-${invoiceId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    })
    .catch(error => {
      console.error('Error:', error);
      toast.error('Could not download PDF. Check that you are signed in.');
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
                <p className="text-sm font-medium text-gray-600">Location</p>
                <p className="text-sm font-bold text-purple-600">
                  {location ? 'Captured' : 'Not Available'}
                </p>
              </div>
              <MapPin className="h-8 w-8 text-purple-600" />
            </div>
            {location && (
              <p className="text-xs text-gray-500 mt-1">
                <LocationText lat={location.lat} lng={location.lng} />
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
                      <div className="md:col-span-2">
                        <span className="text-gray-500">Products:</span>
                        <div className="ml-2 font-medium">
                          {invoice.items && invoice.items.length > 0 ? (
                            <ul className="list-disc list-inside">
                              {invoice.items.map((item, idx) => (
                                <li key={idx}>
                                  {item.name} x{item.quantity} ({formatCurrency(item.price)})
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span>{invoice.product}</span>
                          )}
                        </div>
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
                          <LocationText lat={invoice.location.lat} lng={invoice.location.lng} />
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
                      onClick={() => setPreviewInvoice(invoice)}
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
                    {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
                      <button
                        onClick={() => void markAsPaid(invoice._id)}
                        className="h-8 px-3 rounded-md border border-green-200 bg-green-50 text-green-700 text-sm hover:bg-green-100 flex items-center gap-1"
                      >
                        <CheckCircle className="h-3 w-3" />
                        Pay
                      </button>
                    )}
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
          <div className="bg-white rounded-lg p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">Create New Invoice</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Client Name</label>
                <input
                  type="text"
                  placeholder="Client name"
                  value={newInvoice.client}
                  onChange={(e) => setNewInvoice(prev => ({ ...prev, client: e.target.value }))}
                  className="w-full h-10 border border-gray-200 rounded-md px-3 text-sm"
                />
              </div>

              {/* Added Items List */}
              {newInvoice.items.length > 0 && (
                <div className="border border-gray-100 rounded-md overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">Item</th>
                        <th className="px-3 py-2 text-center font-medium text-gray-600">Qty</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-600">Price</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-600">Total</th>
                        <th className="px-3 py-2 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {newInvoice.items.map((item, idx) => (
                        <tr key={idx}>
                          <td className="px-3 py-2">{item.name}</td>
                          <td className="px-3 py-2 text-center">{item.quantity}</td>
                          <td className="px-3 py-2 text-right">{formatCurrency(item.price)}</td>
                          <td className="px-3 py-2 text-right font-medium">{formatCurrency(item.price * item.quantity)}</td>
                          <td className="px-3 py-2 text-center">
                            <button onClick={() => removeItem(idx)} className="text-red-500 hover:text-red-700">
                              <Plus className="h-4 w-4 rotate-45" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 font-bold">
                      <tr>
                        <td colSpan={3} className="px-3 py-2 text-right">Grand Total:</td>
                        <td className="px-3 py-2 text-right text-green-600">
                          {formatCurrency(newInvoice.items.reduce((s, i) => s + (i.price * i.quantity), 0))}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* Add Item Section */}
              <div className="bg-gray-50 p-3 rounded-md border border-gray-100 space-y-3">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Add Products</p>
                <div className="grid grid-cols-1 gap-3">
                  <select
                    value={currentItem.name}
                    onChange={(e) => {
                      const prodName = e.target.value;
                      const selectedProd = products.find(p => p.name === prodName);
                      if (selectedProd) {
                        setCurrentItem(prev => ({ 
                          ...prev, 
                          productId: selectedProd._id || selectedProd.id || '',
                          name: selectedProd.name,
                          price: selectedProd.price
                        }));
                      }
                    }}
                    className="w-full h-10 border border-gray-200 bg-white rounded-md px-3 text-sm"
                  >
                    <option value="" disabled>Select a product...</option>
                    {Object.entries(
                      products.reduce((acc, p) => {
                        const cat = typeof p.category === 'object' && p.category?.name ? p.category.name : p.category || 'Uncategorized';
                        if (!acc[cat]) acc[cat] = [];
                        acc[cat].push(p);
                        return acc;
                      }, {} as Record<string, any[]>)
                    ).map(([catName, prods]) => (
                      <optgroup key={catName} label={catName}>
                        {prods.map(p => (
                          <option key={p._id || p.id || p.name} value={p.name}>
                            {p.name} - {formatCurrency(p.price)}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="block text-[10px] uppercase text-gray-400 font-bold mb-1">Qty</label>
                      <input
                        type="number"
                        placeholder="Qty"
                        value={currentItem.quantity}
                        onChange={(e) => setCurrentItem(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))}
                        className="w-full h-10 border border-gray-200 rounded-md px-3 text-sm"
                        min="1"
                      />
                    </div>
                    <div className="flex-[2]">
                      <label className="block text-[10px] uppercase text-gray-400 font-bold mb-1">Unit Price (GHS)</label>
                      <input
                        type="number"
                        placeholder="Price"
                        value={currentItem.price}
                        readOnly
                        className="w-full h-10 border border-gray-200 rounded-md px-3 text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
                        step="0.01"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={addItem}
                        className="h-10 px-4 rounded-md bg-gray-800 text-white text-sm hover:bg-gray-900 flex items-center gap-2"
                      >
                        <Plus className="h-4 w-4" /> Add
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <textarea
                placeholder="Notes (optional)"
                value={newInvoice.notes}
                onChange={(e) => setNewInvoice(prev => ({ ...prev, notes: e.target.value }))}
                className="w-full h-20 border border-gray-200 rounded-md px-3 py-2 text-sm resize-none"
              />
              {location && (
                <div className="text-xs text-green-600 flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  Location captured: <LocationText lat={location.lat} lng={location.lng} />
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateForm(false);
                  setNewInvoice({ client: '', items: [], notes: '' });
                }}
                className="h-9 px-4 rounded-md border border-gray-200 text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={createInvoice}
                disabled={newInvoice.items.length === 0}
                className="h-9 px-4 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                Create Invoice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Preview Modal */}
      {previewInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-5 w-full max-w-sm mx-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold">Invoice Preview</h3>
              <button
                onClick={() => setPreviewInvoice(null)}
                className="text-gray-500 hover:text-gray-700 text-sm"
              >
                Close
              </button>
            </div>

            <div className="space-y-2 text-sm">
              <div><span className="text-gray-500">Invoice #:</span> <span className="font-medium">{previewInvoice._id.slice(-8)}</span></div>
              <div><span className="text-gray-500">Client:</span> <span className="font-medium">{previewInvoice.client}</span></div>
              
              <div className="border-t border-b border-gray-100 py-2 my-2">
                <span className="text-gray-500 block mb-1">Products:</span>
                {previewInvoice.items && previewInvoice.items.length > 0 ? (
                  <div className="space-y-1">
                    {previewInvoice.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-xs">
                        <span>{item.name} x{item.quantity}</span>
                        <span>{formatCurrency(item.price * item.quantity)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="font-medium text-sm">{previewInvoice.product}</div>
                )}
              </div>

              <div><span className="text-gray-500">Total Amount:</span> <span className="font-semibold text-green-600">{formatCurrency(previewInvoice.price)}</span></div>
              <div><span className="text-gray-500">Status:</span> <span className="font-medium">{previewInvoice.status}</span></div>
              <div><span className="text-gray-500">Created:</span> <span className="font-medium">{new Date(previewInvoice.createdAt).toLocaleString()}</span></div>
              {previewInvoice.location && (
                <div>
                  <span className="text-gray-500">Location:</span>{' '}
                  <span className="font-medium">
                    <LocationText lat={previewInvoice.location.lat} lng={previewInvoice.location.lng} />
                  </span>
                </div>
              )}
              {previewInvoice.notes && (
                <div><span className="text-gray-500">Notes:</span> <span className="font-medium">{previewInvoice.notes}</span></div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setPreviewInvoice(null)}
                className="h-9 px-3 rounded-md border border-gray-200 text-sm hover:bg-gray-50"
              >
                Close
              </button>
              {previewInvoice.status !== 'paid' && previewInvoice.status !== 'cancelled' && (
                <button
                  onClick={() => {
                    void markAsPaid(previewInvoice._id);
                    setPreviewInvoice(null);
                  }}
                  className="h-9 px-3 rounded-md bg-green-600 text-white text-sm hover:bg-green-700 flex items-center gap-1"
                >
                  <CheckCircle className="h-4 w-4" />
                  Mark as Paid
                </button>
              )}
              <button
                onClick={() => {
                  openPDF(previewInvoice._id);
                  setPreviewInvoice(null);
                }}
                className="h-9 px-3 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700 flex items-center gap-1"
              >
                <Download className="h-4 w-4" />
                Download PDF
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