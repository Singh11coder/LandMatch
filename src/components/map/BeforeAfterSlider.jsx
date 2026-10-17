import { useEffect, useRef, useState, useCallback } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import { GripVertical } from 'lucide-react'
import { formatDate } from '../../utils/index.js'

export function BeforeAfterSlider({ areaId, beforeDate, afterDate, bounds }) {
  const map = useMap()
  const [handlePercent, setHandlePercent] = useState(50)
  const isDragging = useRef(false)
  const handleRef = useRef(null)
  const beforeLayerRef = useRef(null)
  const afterLayerRef = useRef(null)
  const afterPaneRef = useRef(null)

  // Function to recompute clip-path on afterPane
  const updateClip = useCallback(() => {
    if (!map || !afterPaneRef.current) return
    const container = map.getContainer()
    if (!container) return

    const containerWidth = container.clientWidth
    const handleX = (handlePercent / 100) * containerWidth
    const pt = L.point(handleX, 0)
    const layerPoint = map.containerPointToLayerPoint(pt)

    // Clip the after pane so everything to the left of the handle is clipped away,
    // revealing the before pane underneath.
    const clipX = layerPoint.x
    afterPaneRef.current.style.clipPath = `inset(0 0 0 ${clipX}px)`
  }, [map, handlePercent])

  // Set up custom panes, image overlays, and map event listeners
  useEffect(() => {
    if (!map || !bounds || !areaId || !beforeDate || !afterDate) return

    // 1. Create or get custom panes
    let beforePane = map.getPane('beforePane')
    if (!beforePane) {
      beforePane = map.createPane('beforePane')
      beforePane.style.zIndex = '400'
    }

    let afterPane = map.getPane('afterPane')
    if (!afterPane) {
      afterPane = map.createPane('afterPane')
      afterPane.style.zIndex = '450'
    }
    afterPaneRef.current = afterPane

    // 2. Add image overlays
    const beforeUrl = `/tiles/${areaId}/${beforeDate}.jpg`
    const afterUrl = `/tiles/${areaId}/${afterDate}.jpg`

    const beforeLayer = L.imageOverlay(beforeUrl, bounds, {
      pane: 'beforePane',
      opacity: 1,
      interactive: false,
    }).addTo(map)
    beforeLayerRef.current = beforeLayer

    const afterLayer = L.imageOverlay(afterUrl, bounds, {
      pane: 'afterPane',
      opacity: 1,
      interactive: false,
    }).addTo(map)
    afterLayerRef.current = afterLayer

    // Initial clip
    updateClip()

    // 3. Recompute on map events: move, zoom, zoomend, resize
    const handleMapEvents = () => {
      updateClip()
    }

    map.on('move zoom zoomend resize', handleMapEvents)

    return () => {
      map.off('move zoom zoomend resize', handleMapEvents)

      if (beforeLayerRef.current) {
        map.removeLayer(beforeLayerRef.current)
        beforeLayerRef.current = null
      }
      if (afterLayerRef.current) {
        map.removeLayer(afterLayerRef.current)
        afterLayerRef.current = null
      }

      if (map.getPane('beforePane')) {
        L.DomUtil.remove(map.getPane('beforePane'))
        delete map._panes['beforePane']
      }
      if (map.getPane('afterPane')) {
        L.DomUtil.remove(map.getPane('afterPane'))
        delete map._panes['afterPane']
      }
      afterPaneRef.current = null
    }
  }, [map, areaId, beforeDate, afterDate, bounds, updateClip])

  // Update clip whenever handlePercent changes
  useEffect(() => {
    updateClip()
  }, [updateClip])

  // Pointer event handlers (mouse + touch)
  const handlePointerDown = (e) => {
    isDragging.current = true
    map.dragging.disable()
    if (e.currentTarget.setPointerCapture) {
      e.currentTarget.setPointerCapture(e.pointerId)
    }
  }

  const handlePointerMove = (e) => {
    if (!isDragging.current || !map) return
    const container = map.getContainer()
    const rect = container.getBoundingClientRect()
    const clientX = e.clientX
    const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100))
    setHandlePercent(pct)
  }

  const handlePointerUp = (e) => {
    if (!isDragging.current) return
    isDragging.current = false
    try {
      if (e.currentTarget.releasePointerCapture) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
    } catch {
      // Ignored
    }
    if (map && map.dragging) {
      map.dragging.enable()
    }
  }

  // Keyboard accessibility
  const handleKeyDown = (e) => {
    let delta = 0
    if (e.key === 'ArrowLeft') delta = e.shiftKey ? -10 : -2
    else if (e.key === 'ArrowRight') delta = e.shiftKey ? 10 : 2
    if (delta !== 0) {
      e.preventDefault()
      setHandlePercent((prev) => Math.max(0, Math.min(100, prev + delta)))
    }
  }

  return (
    <>
      {/* Date comparison labels */}
      <div className="pointer-events-none absolute left-4 top-4 z-[900] rounded-xl border border-line bg-surface/85 px-3 py-1.5 text-xs font-semibold text-ink shadow-lg backdrop-blur">
        BEFORE {formatDate(beforeDate)}
      </div>
      <div className="pointer-events-none absolute right-4 top-4 z-[900] rounded-xl border border-line bg-surface/85 px-3 py-1.5 text-xs font-semibold text-ink shadow-lg backdrop-blur">
        AFTER {formatDate(afterDate)}
      </div>

      {/* Draggable Vertical Divider Handle */}
      <div
        ref={handleRef}
        role="slider"
        tabIndex={0}
        aria-valuenow={Math.round(handlePercent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Comparison swipe slider"
        style={{ left: `${handlePercent}%` }}
        className="absolute top-0 bottom-0 z-[1000] -ml-4 w-8 cursor-ew-resize select-none touch-none flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
      >
        {/* Vertical line */}
        <div className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_8px_rgba(0,0,0,0.8)]" />
        {/* Grip button */}
        <div className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-surface text-ink shadow-2xl transition-transform hover:scale-110 active:scale-95">
          <GripVertical size={18} />
        </div>
      </div>
    </>
  )
}

