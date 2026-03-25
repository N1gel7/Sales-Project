import React, { useEffect, useRef, useState } from 'react';

// Declare Leaflet types
declare global {
  interface Window {
    L: any;
  }
}

interface MapData {
  tasks?: any[];
  invoices?: any[];
  reports?: any[];
}

export default function MapView(): React.ReactElement {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<{
    tasks: any[];
    invoices: any[];
    products: any[];
    users: any[];
  }>({
    tasks: [],
    invoices: [],
    products: [],
    users: []
  });

  const [showTasks, setShowTasks] = useState(true);
  const [showInvoices, setShowInvoices] = useState(true);
  const [showProducts, setShowProducts] = useState(true);
  const [showUsers, setShowUsers] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load Leaflet dynamically
  useEffect(() => {
    const loadLeaflet = async () => {
      try {
        // Check if Leaflet is already loaded
        if (window.L) {
          setIsLoading(false);
          initializeMap();
          return;
        }

        // Load CSS
        const existingCSS = document.querySelector('link[href*="leaflet"]');
        if (!existingCSS) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          link.crossOrigin = 'anonymous';
          document.head.appendChild(link);
        }

        // Load JS
        const existingScript = document.querySelector('script[src*="leaflet"]');
        if (!existingScript) {
          const script = document.createElement('script');
          script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
          script.crossOrigin = 'anonymous';
          script.onload = () => {
            console.log('Leaflet loaded successfully');
            setIsLoading(false);
            setTimeout(() => initializeMap(), 100);
          };
          script.onerror = () => {
            console.error('Failed to load Leaflet');
            setError('Failed to load map library');
            setIsLoading(false);
          };
          document.head.appendChild(script);
        } else {
          // Script already exists, just initialize
          setIsLoading(false);
          setTimeout(() => initializeMap(), 100);
        }
      } catch (err) {
        console.error('Error loading Leaflet:', err);
        setError('Failed to load map library');
        setIsLoading(false);
      }
    };

    loadLeaflet();
  }, []);

  const initializeMap = () => {
    console.log('Initializing map...');
    console.log('mapRef.current:', mapRef.current);
    console.log('window.L:', window.L);
    console.log('mapInstanceRef.current:', mapInstanceRef.current);

    if (!mapRef.current) {
      console.error('Map container not found');
      setError('Map container not found');
      return;
    }

    if (!window.L) {
      console.error('Leaflet not loaded');
      setError('Leaflet library not loaded');
      return;
    }

    if (mapInstanceRef.current) {
      console.log('Map already initialized');
      return;
    }

    try {
      console.log('Creating map instance...');
      // Initialize map centered on USA
      mapInstanceRef.current = window.L.map(mapRef.current).setView([39.8283, -98.5795], 4);
      console.log('Map instance created:', mapInstanceRef.current);

      // Add OpenStreetMap tiles
      const tileLayer = window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      });
      tileLayer.addTo(mapInstanceRef.current);
      console.log('Tile layer added');

      // Load initial data
      setTimeout(() => {
        loadMapData();
      }, 500);
    } catch (err) {
      console.error('Error initializing map:', err);
      setError(`Failed to initialize map: ${err}`);
    }
  };

  const clearMarkers = () => {
    Object.values(markersRef.current).forEach(markerGroup => {
      markerGroup.forEach(marker => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.removeLayer(marker);
        }
      });
    });
    markersRef.current = { tasks: [], invoices: [], products: [], users: [] };
  };

  const loadMapData = async () => {
    if (!mapInstanceRef.current) return;

    clearMarkers();

    try {
      // Load tasks
      if (showTasks) {
        await loadTasks();
      }

      // Load invoices
      if (showInvoices) {
        await loadInvoices();
      }

      // Load demo products
      if (showProducts) {
        loadDemoProducts();
      }

      // Load demo users
      if (showUsers) {
        loadDemoUsers();
      }
    } catch (err) {
      console.error('Error loading map data:', err);
    }
  };

  const loadTasks = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:4000/api/map-data?type=tasks', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data: MapData = await response.json();
        const tasks = data.tasks || [];
        
        tasks.forEach(task => {
          if (task.location && task.location.coordinates) {
            const [lat, lng] = task.location.coordinates;
            const marker = window.L.marker([lat, lng], {
              icon: window.L.divIcon({
                className: 'custom-div-icon',
                html: '<div style="background: #3b82f6; color: white; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-size: 14px;">📋</div>',
                iconSize: [32, 32],
                iconAnchor: [16, 16]
              })
            });

            marker.bindPopup(`
              <div style="padding: 8px;">
                <h3 style="font-weight: bold; color: #2563eb; margin-bottom: 4px;">${task.title}</h3>
                <p style="color: #6b7280; margin-bottom: 4px;">${task.description}</p>
                <p style="font-size: 12px; color: #9ca3af;">
                  <strong>Status:</strong> ${task.status}<br>
                  <strong>Priority:</strong> ${task.priority}<br>
                  <strong>Assignee:</strong> ${task.assignee}<br>
                  <strong>Due:</strong> ${new Date(task.dueDate).toLocaleDateString()}
                </p>
              </div>
            `);

            marker.addTo(mapInstanceRef.current);
            markersRef.current.tasks.push(marker);
          }
        });
      }
    } catch (err) {
      console.error('Error loading tasks:', err);
    }
  };

  const loadInvoices = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:4000/api/map-data?type=invoices', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data: MapData = await response.json();
        const invoices = data.invoices || [];
        
        invoices.forEach(invoice => {
          if (invoice.location && (invoice.location.lat || invoice.location.coordinates)) {
            let lat, lng;
            if (invoice.location.coordinates) {
              [lat, lng] = invoice.location.coordinates;
            } else {
              lat = invoice.location.lat;
              lng = invoice.location.lng;
            }

            const marker = window.L.marker([lat, lng], {
              icon: window.L.divIcon({
                className: 'custom-div-icon',
                html: '<div style="background: #10b981; color: white; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-size: 14px;">💰</div>',
                iconSize: [32, 32],
                iconAnchor: [16, 16]
              })
            });

            marker.bindPopup(`
              <div style="padding: 8px;">
                <h3 style="font-weight: bold; color: #059669; margin-bottom: 4px;">Invoice #${invoice.invoiceNumber}</h3>
                <p style="color: #6b7280; margin-bottom: 4px;">${invoice.clientName}</p>
                <p style="font-size: 12px; color: #9ca3af;">
                  <strong>Amount:</strong> $${invoice.total}<br>
                  <strong>Status:</strong> ${invoice.status}<br>
                  <strong>Date:</strong> ${new Date(invoice.invoiceDate).toLocaleDateString()}
                </p>
              </div>
            `);

            marker.addTo(mapInstanceRef.current);
            markersRef.current.invoices.push(marker);
          }
        });
      }
    } catch (err) {
      console.error('Error loading invoices:', err);
    }
  };

  const loadDemoProducts = () => {
    // Real geographic locations
    const productLocations = [
      { name: 'New York Office', location: [40.7128, -74.0060], description: 'Main headquarters' },
      { name: 'Los Angeles Branch', location: [34.0522, -118.2437], description: 'West coast operations' },
      { name: 'Chicago Warehouse', location: [41.8781, -87.6298], description: 'Central distribution' },
      { name: 'Miami Branch', location: [25.7617, -80.1918], description: 'South region office' },
      { name: 'Seattle Office', location: [47.6062, -122.3321], description: 'Northwest operations' }
    ];

    productLocations.forEach(product => {
      const [lat, lng] = product.location;
      const marker = window.L.marker([lat, lng], {
        icon: window.L.divIcon({
          className: 'custom-div-icon',
          html: '<div style="background: #8b5cf6; color: white; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-size: 14px;">📦</div>',
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        })
      });

      marker.bindPopup(`
        <div style="padding: 8px;">
          <h3 style="font-weight: bold; color: #7c3aed; margin-bottom: 4px;">${product.name}</h3>
          <p style="color: #6b7280;">${product.description}</p>
          <p style="font-size: 12px; color: #9ca3af; margin-top: 4px;">
            <strong>Coordinates:</strong> ${lat.toFixed(4)}, ${lng.toFixed(4)}
          </p>
        </div>
      `);

      marker.addTo(mapInstanceRef.current);
      markersRef.current.products.push(marker);
    });
  };

  const loadDemoUsers = () => {
    // Real geographic locations
    const userLocations = [
      { name: 'John Doe', role: 'Sales Rep', location: [40.7589, -73.9851], description: 'Times Square Area' },
      { name: 'Jane Smith', role: 'Manager', location: [37.7749, -122.4194], description: 'San Francisco Office' },
      { name: 'Mike Johnson', role: 'Admin', location: [25.7617, -80.1918], description: 'Miami Branch' },
      { name: 'Sarah Wilson', role: 'Sales Rep', location: [33.4484, -112.0740], description: 'Phoenix Territory' },
      { name: 'David Brown', role: 'Manager', location: [39.7392, -104.9903], description: 'Denver Office' }
    ];

    userLocations.forEach(user => {
      const [lat, lng] = user.location;
      const marker = window.L.marker([lat, lng], {
        icon: window.L.divIcon({
          className: 'custom-div-icon',
          html: '<div style="background: #f97316; color: white; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-size: 14px;">👤</div>',
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        })
      });

      marker.bindPopup(`
        <div style="padding: 8px;">
          <h3 style="font-weight: bold; color: #ea580c; margin-bottom: 4px;">${user.name}</h3>
          <p style="color: #6b7280; margin-bottom: 4px;">${user.role}</p>
          <p style="font-size: 12px; color: #9ca3af; margin-bottom: 4px;">${user.description}</p>
          <p style="font-size: 12px; color: #9ca3af;">
            <strong>Location:</strong> ${lat.toFixed(4)}, ${lng.toFixed(4)}
          </p>
        </div>
      `);

      marker.addTo(mapInstanceRef.current);
      markersRef.current.users.push(marker);
    });
  };

  const centerMap = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([39.8283, -98.5795], 4);
    }
  };

  const refreshMap = () => {
    loadMapData();
  };

  // Reload data when checkboxes change
  useEffect(() => {
    if (mapInstanceRef.current) {
      loadMapData();
    }
  }, [showTasks, showInvoices, showProducts, showUsers]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Map View</h1>
        </div>
        <div className="card">
          <div className="card-body text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading interactive map...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Map View</h1>
        </div>
        <div className="card">
          <div className="card-body">
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              <strong>Error:</strong> {error}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Map View</h1>
        <div className="flex space-x-3">
          <button
            onClick={refreshMap}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
          >
            <span>🔄</span>
            <span>Refresh</span>
          </button>
          <button
            onClick={centerMap}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 flex items-center space-x-2"
          >
            <span>🎯</span>
            <span>Center</span>
          </button>
        </div>
      </div>

      {/* Map Controls */}
      <div className="card">
        <div className="card-body">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="showTasks"
                checked={showTasks}
                onChange={(e) => setShowTasks(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="showTasks" className="text-sm text-gray-700">Show Tasks</label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="showInvoices"
                checked={showInvoices}
                onChange={(e) => setShowInvoices(e.target.checked)}
                className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
              />
              <label htmlFor="showInvoices" className="text-sm text-gray-700">Show Invoices</label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="showProducts"
                checked={showProducts}
                onChange={(e) => setShowProducts(e.target.checked)}
                className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
              />
              <label htmlFor="showProducts" className="text-sm text-gray-700">Show Products</label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="showUsers"
                checked={showUsers}
                onChange={(e) => setShowUsers(e.target.checked)}
                className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
              />
              <label htmlFor="showUsers" className="text-sm text-gray-700">Show Users</label>
            </div>
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div className="card">
        <div className="card-body p-0">
          <div
            ref={mapRef}
            style={{ height: '600px', width: '100%', minHeight: '600px', backgroundColor: '#f3f4f6' }}
            className="rounded-lg"
          />
        </div>
      </div>
    </div>
  );
}