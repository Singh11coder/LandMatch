import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import { useNavigate } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import { formatArea, TYPE_LABEL } from '../../utils/index.js'

const SEV_COLORS = {
  critical: '#EF4444',
  high: '#F97316',
  medium: '#F59E0B',
  resolved: '#22C55E',
}

export function DetectionMarkers({ detections = [] }) {
  const map = useMap()
  const navigate = useNavigate()

  useEffect(() => {
    if (!map) return

    const clusterGroup = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 45,
      spiderfyOnMaxZoom: true,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount()
        return L.divIcon({
          html: `<div class="flex h-8 w-8 items-center justify-center rounded-full bg-accent/90 text-xs font-bold text-base shadow-lg ring-2 ring-surface">${count}</div>`,
          className: 'lw-cluster-icon',
          iconSize: [32, 32],
        })
      },
    })

    detections.forEach((det) => {
      const p = det.properties
      if (!p.centroid) return
      const color = SEV_COLORS[p.severity] || '#22D3EE'

      const icon = L.divIcon({
        className: 'lw-det-marker-icon',
        html: `<div style="background-color: ${color}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid #FFFFFF; box-shadow: 0 0 8px ${color};"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      })

      const marker = L.marker([p.centroid[1], p.centroid[0]], { icon })

      const popupHtml = `
        <div style="min-width: 180px; padding: 4px; font-family: Inter, system-ui, sans-serif;">
          <div style="font-weight: 600; font-size: 13px; color: #E6EAED;">${TYPE_LABEL[p.type] || p.type}</div>
          <div style="font-size: 12px; color: #8A949C; margin-top: 2px;">
            ${p.locationName || 'Detection'} · ${formatArea(p.areaSqm)}
          </div>
          <div style="margin-top: 6px; display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 10px; font-weight: 600; text-transform: uppercase; color: ${color}; background: ${color}22; padding: 2px 6px; border-radius: 4px; border: 1px solid ${color}44;">
              ${p.severity}
            </span>
            ${p.inProtectedZone ? `<span style="font-size: 10px; font-weight: 700; color: #EF4444;">[PROTECTED]</span>` : ''}
          </div>
          <button class="lw-detect-popup-btn" data-det-id="${p.id}" data-area-id="${p.areaId}" style="margin-top: 10px; width: 100%; border: none; border-radius: 8px; background-color: #22D3EE; color: #0F1214; padding: 6px 10px; font-size: 12px; font-weight: 600; cursor: pointer;">
            Open in Detect
          </button>
        </div>
      `

      marker.bindPopup(popupHtml, {
        className: 'lw-custom-popup',
      })

      clusterGroup.addLayer(marker)
    })

    map.addLayer(clusterGroup)

    const handlePopupClick = (e) => {
      const btn = e.target.closest('.lw-detect-popup-btn')
      if (btn) {
        const detectionId = btn.getAttribute('data-det-id')
        const areaId = btn.getAttribute('data-area-id')
        if (detectionId && areaId) {
          navigate(`/detect?detectionId=${detectionId}&areaId=${areaId}`)
        }
      }
    }

    const container = map.getContainer()
    container.addEventListener('click', handlePopupClick)

    return () => {
      container.removeEventListener('click', handlePopupClick)
      map.removeLayer(clusterGroup)
      clusterGroup.clearLayers()
    }
  }, [map, detections, navigate])

  return null
}

