// Simple reverse geocoding via Nominatim (OpenStreetMap). Respect rate limits in production.
export default async function handler(req, res) {
  const { lat, lng } = req.query || {};
  if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`;
    const r = await fetch(url, { headers: { 'User-Agent': 'sales-mgmt-app/1.0' } });
    const data = await r.json();
    return res.status(200).json({ display_name: data.display_name || null, address: data.address || null });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}


