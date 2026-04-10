import React, { useEffect, useState } from 'react';
import { getLocationLabel } from '../utils/locationLabel';

type LocationTextProps = {
  lat: number;
  lng: number;
  className?: string;
};

export default function LocationText({ lat, lng, className }: LocationTextProps): React.ReactElement {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getLocationLabel(lat, lng).then((value) => {
      if (!cancelled) setLabel(value);
    });
    return () => {
      cancelled = true;
    };
  }, [lat, lng]);

  return (
    <span className={className}>
      {label ? `${label} (${lat.toFixed(4)}, ${lng.toFixed(4)})` : `${lat.toFixed(4)}, ${lng.toFixed(4)}`}
    </span>
  );
}
