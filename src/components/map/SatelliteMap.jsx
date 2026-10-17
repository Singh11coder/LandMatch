import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import { Layers, Map as MapIcon, Tag } from 'lucide-react'
import { cx } from '../common/index.jsx'

// Fix default Leaflet marker icons under Vite
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

const BASEMAPS = {
  satellite: {
    name: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri, Maxar, Earthstar Geographics',
    maxZoom: 19,
  },
  dark: {
    name: 'OSM Dark',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    maxZoom: 19,
  },
}

const LABELS_LAYER = {
  url: 'https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png',
  attribution: '&copy; OpenStreetMap &copy; CARTO',
  maxZoom: 19,
}

function MapBoundsController({ bounds }) {
  const map = useMap()
  useEffect(() => {
    if (!bounds) return
    try {
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 })
    } catch {
      // Ignore if bounds is invalid during transitions
    }
  }, [map, bounds])
  return null
}

function MapReadyNotifier({ onReady }) {
  const map = useMap()
  useEffect(() => {
    if (onReady) onReady(map)
  }, [map, onReady])
  return null
}

export function SatelliteMap({
  center = [23.25, 77.37],
  zoom = 13,
  bounds,
  children,
  className,
  onMapReady,
  hideControls = false,
  ...props
}) {
  const [basemap, setBasemap] = useState('satellite')
  const [showLabels, setShowLabels] = useState(true)
  const [openMenu, setOpenMenu] = useState(false)

  const activeBasemap = BASEMAPS[basemap] || BASEMAPS.satellite

  return (
    <div className={cx('relative h-full w-full overflow-hidden bg-base', className)}>
      <MapContainer
        center={center}
        zoom={zoom}
        className="h-full w-full z-0"
        zoomControl={false}
        attributionControl={false}
        {...props}
      >
        <MapBoundsController bounds={bounds} />
        {onMapReady && <MapReadyNotifier onReady={onMapReady} />}

        {/* Basemap Tile Layer */}
        <TileLayer
          key={basemap}
          url={activeBasemap.url}
          attribution={activeBasemap.attribution}
          maxZoom={activeBasemap.maxZoom}
        />

        {/* Labels Overlay */}
        {showLabels && (
          <TileLayer
            key="labels-overlay"
            url={LABELS_LAYER.url}
            attribution={LABELS_LAYER.attribution}
            maxZoom={LABELS_LAYER.maxZoom}
            zIndex={300}
          />
        )}

        {children}
      </MapContainer>

      {/* Basemap Switcher & Labels Toggle */}
      {!hideControls && (
        <div className="absolute right-3 top-3 z-[1000] flex flex-col items-end gap-1.5">
          <button
            type="button"
            aria-label="Toggle map layers menu"
            onClick={() => setOpenMenu(!openMenu)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-surface/90 text-ink shadow-lg backdrop-blur transition-colors hover:bg-line"
          >
            <Layers size={16} />
          </button>

          {openMenu && (
            <div className="w-48 rounded-xl border border-line bg-surface/95 p-2 shadow-xl backdrop-blur animate-slide">
              <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted">Basemap</p>
              <div className="space-y-1">
                {Object.entries(BASEMAPS).map(([key, config]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setBasemap(key)}
                    className={cx(
                      'flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-left transition-colors',
                      basemap === key ? 'bg-accent/15 text-accent' : 'text-muted hover:bg-line hover:text-ink'
                    )}
                  >
                    <MapIcon size={14} />
                    <span>{config.name}</span>
                  </button>
                ))}
              </div>

              <div className="my-1.5 border-t border-line" />

              <label className="flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-ink hover:bg-line">
                <span className="flex items-center gap-2 text-muted">
                  <Tag size={13} />
                  <span>Labels</span>
                </span>
                <input
                  type="checkbox"
                  checked={showLabels}
                  onChange={(e) => setShowLabels(e.target.checked)}
                  className="rounded border-line bg-base text-accent focus:ring-accent"
                />
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

