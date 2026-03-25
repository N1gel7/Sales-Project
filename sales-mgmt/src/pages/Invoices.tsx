import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

export default function Invoices(): React.ReactElement {
  const [items, setItems] = useState<any[]>([]);
  const [client, setClient] = useState('');
  const [product, setProduct] = useState('');
  const [price, setPrice] = useState('');
  const [emailTo, setEmailTo] = useState('');
  const [coords, setCoords] = useState<{lat:number,lng:number}|null>(null);

  async function load() {
    const data = await api.listInvoices();
    setItems(data as any[]);
  }
  useEffect(() => { 
    load(); 
    // Capture location on page load
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setCoords(null),
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  }, []);

  async function create() {
    if (!client || !product || !price) {
      alert('Please fill in all fields');
      return;
    }
    try {
      await api.createInvoice({ client, product, price: Number(price), coords });
      setClient(''); setProduct(''); setPrice('');
      await load();
      alert('Invoice created successfully!');
    } catch (error) {
      alert('Error creating invoice: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  async function sendEmail(id: string) {
    if (!emailTo) return alert('Enter recipient email');
    await fetch('/api/invoices-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, to: emailTo }) });
    alert('Email sent (if SMTP configured)');
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header">Create Invoice</div>
        <div className="card-body grid grid-cols-1 md:grid-cols-4 gap-3">
          <input value={client} onChange={(e)=>setClient(e.target.value)} className="h-10 border border-gray-200 rounded-md px-3 text-sm" placeholder="Client Name" required />
          <input value={product} onChange={(e)=>setProduct(e.target.value)} className="h-10 border border-gray-200 rounded-md px-3 text-sm" placeholder="Product Name" required />
          <input value={price} onChange={(e)=>setPrice(e.target.value)} type="number" step="0.01" className="h-10 border border-gray-200 rounded-md px-3 text-sm" placeholder="Price (GHS)" required />
          <button onClick={create} className="h-10 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm px-3">Create Invoice</button>
        </div>
        {coords && (
          <div className="card-body pt-0">
            <div className="text-xs text-green-600">📍 Location captured: {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}</div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header flex items-center justify-between">
          <div>Invoices</div>
          <div className="flex items-center gap-2">
            <input value={emailTo} onChange={(e)=>setEmailTo(e.target.value)} className="h-9 border border-gray-200 rounded-md px-3 text-sm" placeholder="Recipient email" />
          </div>
        </div>
        <div className="card-body">
          <ul className="divide-y divide-gray-100">
            {items.map((inv) => (
              <li key={inv._id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{inv.client}</div>
                  <div className="text-xs text-gray-500">
                    {inv.product} • GHS {inv.price}
                    {inv.location?.lat && inv.location?.lng ? ` • 📍 (${inv.location.lat.toFixed(4)}, ${inv.location.lng.toFixed(4)})` : null}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-xs text-gray-500">{new Date(inv.createdAt).toLocaleString()}</div>
                  <button onClick={()=>sendEmail(inv._id)} className="h-8 px-3 rounded-md border border-gray-200 text-sm">Email</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}


