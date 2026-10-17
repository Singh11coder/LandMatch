import { memo } from 'react'
import { Polygon, Tooltip } from 'react-leaflet'
import { ZONE_LABEL } from '../../utils/index.js'

const ZONE_COLORS = {
  forest: '#10B981',
  lake: '#3B82F6',
  river_bank: '#06B6D4',
  reserved_land: '#A855F7',
}

function ProtectedZoneLayerComponent({ zones }) {
  if (!zones || !zones.length) return null

  return (
    <>
      {zones.map((zone) => {
        const p = zone.properties
        const ring = zone.geometry?.coordinates?.[0]
        if (!ring) return null
        const coords = ring.map(([lng, lat]) => [lat, lng])
        const color = ZONE_COLORS[p.type] || '#10B981'

        return (
          <Polygon
            key={p.id || zone.id}
            positions={coords}
            pathOptions={{
              color,
              dashArray: '6 6',
              weight: 2,
              fillColor: color,
              fillOpacity: 0.12,
            }}
          >
            <Tooltip sticky className="lw-zone-tooltip">
              <div className="text-xs">
                <span className="font-semibold text-ink">{p.name}</span>
                <span className="block text-muted">
                  {ZONE_LABEL[p.type] || p.type} {p.areaKm2 ? `· ${p.areaKm2} km²` : ''}
                </span>
              </div>
            </Tooltip>
          </Polygon>
        )
      })}
    </>
  )
}

export const ProtectedZoneLayer = memo(ProtectedZoneLayerComponent)

