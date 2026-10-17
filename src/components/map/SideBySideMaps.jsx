import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, ImageOverlay } from 'react-leaflet'
import { formatDate } from '../../utils/index.js'
import { ChangeOverlay } from './ChangeOverlay.jsx'
import { ProtectedZoneLayer } from './ProtectedZoneLayer.jsx'

export function SideBySideMaps({
  areaId,
  beforeDate,
  afterDate,
  bounds,
  zones = [],
  detections = [],
  selectedId,
  onSelect,
  category,
  minConfidence,
  showFiltered,
}) {
  const [map1, setMap1] = useState(null)
  const [map2, setMap2] = useState(null)
  const isSyncing = useRef(false)

  // Two-way synchronization with loop prevention
  useEffect(() => {
    if (!map1 || !map2) return

    const handleMap1Move = () => {
      if (isSyncing.current) return
      isSyncing.current = true
      map2.setView(map1.getCenter(), map1.getZoom(), { animate: false })
      isSyncing.current = false
    }

    const handleMap2Move = () => {
      if (isSyncing.current) return
      isSyncing.current = true
      map1.setView(map2.getCenter(), map2.getZoom(), { animate: false })
      isSyncing.current = false
    }

    map1.on('move', handleMap1Move)
    map2.on('move', handleMap2Move)

    if (bounds) {
      try {
        map1.fitBounds(bounds, { padding: [20, 20], maxZoom: 16 })
        map2.fitBounds(bounds, { padding: [20, 20], maxZoom: 16 })
      } catch {
        // Ignored
      }
    }

    return () => {
      map1.off('move', handleMap1Move)
      map2.off('move', handleMap2Move)
    }
  }, [map1, map2, bounds])

  const center = [23.25, 77.37]
  const zoom = 13

  return (
    <div className="grid h-full w-full grid-cols-1 md:grid-cols-2 gap-2 bg-base p-1">
      {/* Left Map: Before */}
      <div className="relative h-full w-full overflow-hidden rounded-xl border border-line bg-surface">
        <div className="pointer-events-none absolute left-3 top-3 z-[1000] rounded-xl border border-line bg-surface/85 px-3 py-1.5 text-xs font-semibold text-ink shadow-lg backdrop-blur">
          BEFORE {formatDate(beforeDate)}
        </div>
        <MapContainer
          center={center}
          zoom={zoom}
          ref={setMap1}
          className="h-full w-full"
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution="&copy; Esri"
          />
          {bounds && areaId && beforeDate && (
            <ImageOverlay
              url={`/tiles/${areaId}/${beforeDate}.jpg`}
              bounds={bounds}
              opacity={1}
            />
          )}
          <ProtectedZoneLayer zones={zones} />
          <ChangeOverlay
            features={detections}
            selectedId={selectedId}
            onSelect={onSelect}
            category={category}
            minConfidence={minConfidence}
            showFiltered={showFiltered}
          />
        </MapContainer>
      </div>

      {/* Right Map: After */}
      <div className="relative h-full w-full overflow-hidden rounded-xl border border-line bg-surface">
        <div className="pointer-events-none absolute left-3 top-3 z-[1000] rounded-xl border border-line bg-surface/85 px-3 py-1.5 text-xs font-semibold text-ink shadow-lg backdrop-blur">
          AFTER {formatDate(afterDate)}
        </div>
        <MapContainer
          center={center}
          zoom={zoom}
          ref={setMap2}
          className="h-full w-full"
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution="&copy; Esri"
          />
          {bounds && areaId && afterDate && (
            <ImageOverlay
              url={`/tiles/${areaId}/${afterDate}.jpg`}
              bounds={bounds}
              opacity={1}
            />
          )}
          <ProtectedZoneLayer zones={zones} />
          <ChangeOverlay
            features={detections}
            selectedId={selectedId}
            onSelect={onSelect}
            category={category}
            minConfidence={minConfidence}
            showFiltered={showFiltered}
          />
        </MapContainer>
      </div>
    </div>
  )
}

