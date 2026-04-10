type ReverseResult = {
  road?: string;
  suburb?: string;
  neighbourhood?: string;
  city?: string;
  town?: string;
  village?: string;
  county?: string;
  state?: string;
};

const cache = new Map<string, string | null>();
const pending = new Map<string, Promise<string | null>>();

function keyFor(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

function pickBestLabel(address?: ReverseResult): string | null {
  if (!address) return null;
  const streetLike = address.road || address.neighbourhood || address.suburb;
  const townLike = address.city || address.town || address.village || address.county || address.state;
  if (streetLike && townLike) return `${streetLike}, ${townLike}`;
  return streetLike || townLike || null;
}

export async function getLocationLabel(lat: number, lng: number): Promise<string | null> {
  const key = keyFor(lat, lng);
  if (cache.has(key)) return cache.get(key) || null;
  if (pending.has(key)) return pending.get(key)!;

  const request = fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&addressdetails=1&zoom=18`
  )
    .then(async (res) => {
      if (!res.ok) return null;
      const data = await res.json();
      const label = pickBestLabel(data?.address);
      cache.set(key, label);
      pending.delete(key);
      return label;
    })
    .catch(() => {
      cache.set(key, null);
      pending.delete(key);
      return null;
    });

  pending.set(key, request);
  return request;
}
