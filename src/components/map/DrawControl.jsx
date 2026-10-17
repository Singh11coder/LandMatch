import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet-draw'
import 'leaflet-draw/dist/leaflet.draw.css'
import { polygonAreaSqm } from '../../utils/index.js'

export function DrawControl({ active, onAreaDrawn, onCancel }) {
  const map = useMap()
  const drawnItemsRef = useRef(new L.FeatureGroup())
  const drawHandlerRef = useRef(null)

  useEffect(() => {
    if (!map) return

    const drawnItems = drawnItemsRef.current
    map.addLayer(drawnItems)

    const handleCreated = (e) => {
      drawnItems.clearLayers()
      const layer = e.layer
      drawnItems.addLayer(layer)

      let latlngs = layer.getLatLngs()
      if (Array.isArray(latlngs[0])) {
        latlngs = latlngs[0]
      }

      // Convert to [lng, lat] ring
      const ring = latlngs.map((pt) => [pt.lng, pt.lat])
      // Ensure closed ring
      if (ring.length > 0 && (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1])) {
        ring.push(ring[0])
      }

      const areaSqm = polygonAreaSqm(ring)
      const areaKm2 = +(areaSqm / 1000000).toFixed(2)
      const bounds = layer.getBounds()

      if (onAreaDrawn) {
        onAreaDrawn({
          ring,
          areaKm2,
          bounds: [
            [bounds.getSouth(), bounds.getWest()],
            [bounds.getNorth(), bounds.getEast()],
          ],
        })
      }
    }

    map.on(L.Draw.Event.CREATED, handleCreated)

    return () => {
      map.off(L.Draw.Event.CREATED, handleCreated)
      if (drawHandlerRef.current) {
        drawHandlerRef.current.disable()
      }
      map.removeLayer(drawnItems)
    }
  }, [map, onAreaDrawn])

  useEffect(() => {
    if (!map) return

    if (active) {
      // Default to polygon drawing
      const polygonDrawer = new L.Draw.Polygon(map, {
        shapeOptions: {
          color: '#22D3EE',
          fillColor: '#22D3EE',
          fillOpacity: 0.2,
          weight: 2,
          dashArray: '4 4',
        },
      })
      drawHandlerRef.current = polygonDrawer
      polygonDrawer.enable()
    } else {
      if (drawHandlerRef.current) {
        drawHandlerRef.current.disable()
        drawHandlerRef.current = null
      }
    }
  }, [map, active])

  if (!active) return null

  return (
    <div className="absolute top-4 left-1/2 z-[1000] -translate-x-1/2 flex items-center gap-3 rounded-xl border border-accent bg-surface/95 px-4 py-2 shadow-xl backdrop-blur">
      <div className="flex items-center gap-2 text-xs font-medium text-ink">
        <span className="h-2 w-2 rounded-full bg-accent animate-ping2" />
        Click map to draw custom boundary vertices. Double-click to finish.
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-lg border border-line bg-line/50 px-2.5 py-1 text-xs text-muted hover:text-ink hover:bg-line"
      >
        Cancel
      </button>
    </div>
  )
}

