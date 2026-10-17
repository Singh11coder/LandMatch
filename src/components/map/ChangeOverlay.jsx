import { memo, useMemo, useState } from 'react'
import { Polygon, Tooltip } from 'react-leaflet'
import { formatArea, TYPE_LABEL } from '../../utils/index.js'
import { PulsingRing } from './PulsingRing.jsx'

const TYPE_COLORS = {
  new_construction: '#EF4444',
  vegetation_loss: '#F97316',
  water_shrinkage: '#3B82F6',
  sand_mining: '#F59E0B',
}

function ChangePolygon({ feature, isSelected, onSelect }) {
  const [hovered, setHovered] = useState(false)
  const p = feature.properties
  const ring = feature.geometry?.coordinates?.[0]
  if (!ring) return null
  const coords = ring.map(([lng, lat]) => [lat, lng])

  const baseColor = TYPE_COLORS[p.type] || '#22D3EE'
  const isFiltered = !!p.flaggedAs

  // Determine stroke and fill styling
  let strokeColor = baseColor
  let fillColor = baseColor
  let weight = 2
  let fillOpacity = 0.25
  let dashArray = null

  if (isFiltered) {
    strokeColor = '#94A3B8'
    fillColor = '#64748B'
    weight = 1.5
    fillOpacity = 0.18
    dashArray = '4 4'
  } else if (isSelected) {
    strokeColor = '#FFFFFF'
    fillColor = baseColor
    weight = 4
    fillOpacity = 0.55
  } else if (hovered) {
    strokeColor = baseColor
    fillColor = baseColor
    weight = 4
    fillOpacity = 0.45
  }

  return (
    <>
      <Polygon
        positions={coords}
        pathOptions={{
          color: strokeColor,
          fillColor,
          weight,
          fillOpacity,
          dashArray,
        }}
        eventHandlers={{
          mouseover: () => setHovered(true),
          mouseout: () => setHovered(false),
          click: (e) => {
            e.originalEvent?.stopPropagation()
            if (onSelect) onSelect(feature)
          },
        }}
      >
        <Tooltip sticky className="lw-detection-tooltip">
          <div className="text-xs">
            <span className="font-semibold text-ink">
              {TYPE_LABEL[p.type] || p.type}
              {isFiltered && <span className="ml-1 text-muted">(Filtered: {p.flaggedAs})</span>}
            </span>
            <span className="block text-muted">
              {formatArea(p.areaSqm)} · {p.confidence}% confidence
            </span>
            {p.inProtectedZone && (
              <span className="mt-0.5 inline-block font-semibold text-critical">
                Inside {p.zoneName || 'Protected Zone'}
              </span>
            )}
          </div>
        </Tooltip>
      </Polygon>

      {!isFiltered && p.inProtectedZone && p.centroid && (
        <PulsingRing centroid={p.centroid} />
      )}
    </>
  )
}

function ChangeOverlayComponent({
  features = [],
  selectedId,
  onSelect,
  category = 'all',
  minConfidence = 0,
  showFiltered = false,
}) {
  // Apply category and confidence filters
  const displayFeatures = useMemo(() => {
    return features.filter((f) => {
      const p = f.properties
      if (p.flaggedAs) {
        return showFiltered
      }
      if (category && category !== 'all' && p.type !== category) {
        return false
      }
      if (p.confidence < minConfidence) {
        return false
      }
      return true
    })
  }, [features, category, minConfidence, showFiltered])

  return (
    <>
      {displayFeatures.map((f) => (
        <ChangePolygon
          key={f.properties.id}
          feature={f}
          isSelected={f.properties.id === selectedId}
          onSelect={onSelect}
        />
      ))}
    </>
  )
}

export const ChangeOverlay = memo(ChangeOverlayComponent)

