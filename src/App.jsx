import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { loadData } from './utils/loadData'

function buildCountryCounts(rows) {
  const counts = {}

  for (const row of rows) {
    if (!row.ISO) continue
    counts[row.ISO] = (counts[row.ISO] || 0) + 1
  }

  return counts
}

function buildFillColorExpression(counts) {
  const max = Math.max(...Object.values(counts), 1)
  const valueExpression = ['match', ['get', 'iso_3166_1_alpha_3']]

  Object.entries(counts).forEach(([iso, count]) => {
    valueExpression.push(iso, count)
  })

  valueExpression.push(0)

  return [
    'interpolate',
    ['linear'],
    ['/', valueExpression, max],
    0.0, '#ffffff',
    0.2, '#c6dbef',
    0.4, '#6baed6',
    0.6, '#4292c6',
    0.8, '#2171b5',
    1.0, '#08306b'
  ]
}

export default function App() {
  const mapContainerRef = useRef(null)
  const mapRef = useRef(null)

  useEffect(() => {
    if (mapRef.current) return

    const token = import.meta.env.VITE_MAPBOX_TOKEN

    if (!token) {
      console.error('Missing VITE_MAPBOX_TOKEN in .env')
      return
    }

    mapboxgl.accessToken = token

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [0, 20],
      zoom: 1.5
    })

    mapRef.current = map

    map.on('load', async () => {
      const rows = await loadData()
      const countryCounts = buildCountryCounts(rows)
      const fillColor = buildFillColorExpression(countryCounts)

      map.addSource('country-source', {
        type: 'vector',
        url: 'mapbox://mapbox.country-boundaries-v1'
      })

      map.addLayer({
        id: 'countries',
        type: 'fill',
        source: 'country-source',
        'source-layer': 'country_boundaries',
        paint: {
          'fill-color': fillColor,
          'fill-opacity': 1
        }
      })

      map.addLayer({
        id: 'countries-border',
        type: 'line',
        source: 'country-source',
        'source-layer': 'country_boundaries',
        paint: {
          'line-color': '#888888',
          'line-width': 0.6
        }
      })
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  return (
    <div className="app">
      <div ref={mapContainerRef} className="map-container" />
    </div>
  )
}
