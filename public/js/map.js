// Map functionality
let map;
let markers = {
    tasks: [],
    invoices: [],
    products: [],
    users: []
};

function initMap() {
    // Initialize map centered on a default location (you can change this)
    map = L.map('map').setView([39.8283, -98.5795], 4); // Center of USA

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Load map data
    loadMapData();
}

function loadMapData() {
    // Clear existing markers
    Object.values(markers).forEach(markerGroup => {
        markerGroup.forEach(marker => map.removeLayer(marker));
    });
    markers = { tasks: [], invoices: [], products: [], users: [] };

    // Load tasks
    if (document.getElementById('showTasks').checked) {
        loadTasks();
    }

    // Load invoices
    if (document.getElementById('showInvoices').checked) {
        loadInvoices();
    }

    // Load products (if they have locations)
    if (document.getElementById('showProducts').checked) {
        loadProducts();
    }

    // Load users
    if (document.getElementById('showUsers').checked) {
        loadUsers();
    }
}

async function loadTasks() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/map-data?type=tasks', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            const tasks = data.tasks || [];
            tasks.forEach(task => {
                if (task.location && task.location.coordinates) {
                    const [lat, lng] = task.location.coordinates;
                    const marker = L.marker([lat, lng], {
                        icon: L.divIcon({
                            className: 'custom-div-icon',
                            html: '<div class="marker-icon bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center"><i class="fas fa-tasks text-sm"></i></div>',
                            iconSize: [32, 32],
                            iconAnchor: [16, 16]
                        })
                    });
                    
                    marker.bindPopup(`
                        <div class="p-2">
                            <h3 class="font-bold text-blue-600">${task.title}</h3>
                            <p class="text-sm text-gray-600">${task.description}</p>
                            <p class="text-xs text-gray-500 mt-1">
                                <strong>Status:</strong> ${task.status}<br>
                                <strong>Priority:</strong> ${task.priority}<br>
                                <strong>Assignee:</strong> ${task.assignee}<br>
                                <strong>Due:</strong> ${new Date(task.dueDate).toLocaleDateString()}
                            </p>
                        </div>
                    `);
                    
                    marker.addTo(map);
                    markers.tasks.push(marker);
                }
            });
        }
    } catch (error) {
        console.error('Error loading tasks:', error);
    }
}

async function loadInvoices() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/map-data?type=invoices', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
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
                    
                    const marker = L.marker([lat, lng], {
                        icon: L.divIcon({
                            className: 'custom-div-icon',
                            html: '<div class="marker-icon bg-green-500 text-white rounded-full w-8 h-8 flex items-center justify-center"><i class="fas fa-file-invoice text-sm"></i></div>',
                            iconSize: [32, 32],
                            iconAnchor: [16, 16]
                        })
                    });
                    
                    marker.bindPopup(`
                        <div class="p-2">
                            <h3 class="font-bold text-green-600">Invoice #${invoice.invoiceNumber}</h3>
                            <p class="text-sm text-gray-600">${invoice.clientName}</p>
                            <p class="text-xs text-gray-500 mt-1">
                                <strong>Amount:</strong> $${invoice.total}<br>
                                <strong>Status:</strong> ${invoice.status}<br>
                                <strong>Date:</strong> ${new Date(invoice.invoiceDate).toLocaleDateString()}
                            </p>
                        </div>
                    `);
                    
                    marker.addTo(map);
                    markers.invoices.push(marker);
                }
            });
        }
    } catch (error) {
        console.error('Error loading invoices:', error);
    }
}

async function loadProducts() {
    // For demo purposes, add some product locations
    const productLocations = [
        { name: 'Product A', location: [40.7128, -74.0060], description: 'New York Office' },
        { name: 'Product B', location: [34.0522, -118.2437], description: 'Los Angeles Branch' },
        { name: 'Product C', location: [41.8781, -87.6298], description: 'Chicago Warehouse' }
    ];

    productLocations.forEach(product => {
        const [lat, lng] = product.location;
        const marker = L.marker([lat, lng], {
            icon: L.divIcon({
                className: 'custom-div-icon',
                html: '<div class="marker-icon bg-purple-500 text-white rounded-full w-8 h-8 flex items-center justify-center"><i class="fas fa-box text-sm"></i></div>',
                iconSize: [32, 32],
                iconAnchor: [16, 16]
            })
        });
        
        marker.bindPopup(`
            <div class="p-2">
                <h3 class="font-bold text-purple-600">${product.name}</h3>
                <p class="text-sm text-gray-600">${product.description}</p>
            </div>
        `);
        
        marker.addTo(map);
        markers.products.push(marker);
    });
}

async function loadUsers() {
    // For demo purposes, add some user locations
    const userLocations = [
        { name: 'John Doe', role: 'Sales Rep', location: [40.7589, -73.9851], description: 'Times Square Area' },
        { name: 'Jane Smith', role: 'Manager', location: [37.7749, -122.4194], description: 'San Francisco Office' },
        { name: 'Mike Johnson', role: 'Admin', location: [25.7617, -80.1918], description: 'Miami Branch' }
    ];

    userLocations.forEach(user => {
        const [lat, lng] = user.location;
        const marker = L.marker([lat, lng], {
            icon: L.divIcon({
                className: 'custom-div-icon',
                html: '<div class="marker-icon bg-orange-500 text-white rounded-full w-8 h-8 flex items-center justify-center"><i class="fas fa-user text-sm"></i></div>',
                iconSize: [32, 32],
                iconAnchor: [16, 16]
            })
        });
        
        marker.bindPopup(`
            <div class="p-2">
                <h3 class="font-bold text-orange-600">${user.name}</h3>
                <p class="text-sm text-gray-600">${user.role}</p>
                <p class="text-xs text-gray-500 mt-1">${user.description}</p>
            </div>
        `);
        
        marker.addTo(map);
        markers.users.push(marker);
    });
}

// Event listeners for controls
document.addEventListener('DOMContentLoaded', function() {
    // Refresh button
    const refreshBtn = document.getElementById('refreshMap');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadMapData);
    }

    // Center button
    const centerBtn = document.getElementById('centerMap');
    if (centerBtn) {
        centerBtn.addEventListener('click', () => {
            if (map) {
                map.setView([39.8283, -98.5795], 4);
            }
        });
    }

    // Checkbox event listeners
    const checkboxes = ['showTasks', 'showInvoices', 'showProducts', 'showUsers'];
    checkboxes.forEach(id => {
        const checkbox = document.getElementById(id);
        if (checkbox) {
            checkbox.addEventListener('change', loadMapData);
        }
    });

    // Initialize map when page loads
    initMap();
});

