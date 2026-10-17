import { Marker } from 'react-leaflet'
import L from 'leaflet'

const pulsingDivIcon = L.divIcon({
  className: 'custom-pulsing-icon',
  html: `<div class="relative flex h-8 w-8 items-center justify-center -translate-x-4 -translate-y-4 pointer-events-none">
    <div class="absolute h-8 w-8 rounded-full bg-critical/50 animate-ping2"></div>
    <div class="h-2.5 w-2.5 rounded-full bg-critical shadow-[0_0_8px_#EF4444]"></div>
  </div>`,
  iconSize: [0, 0],
  iconAnchor: [0, 0],
})

export function PulsingRing({ centroid }) {
  if (!centroid || !Array.isArray(centroid) || centroid.length < 2) return null
  return (
    <Marker
      position={[centroid[1], centroid[0]]}
      icon={pulsingDivIcon}
      interactive={false}
      keyboard={false}
    />
  )
}

