import type { LatLngExpression } from 'leaflet'
import { useEffect } from 'react'
import { CircleMarker, MapContainer, TileLayer, Tooltip as LeafletTooltip, useMap } from 'react-leaflet'

import { InlineMarkdown } from '@/lib/markdown'

import { CHART_COLOR } from './colors'
import { useDataset } from './ComponentData'
import { colorOf, type VesselPositionRow } from './parts'
import { useProps } from './NodeContext'

function InvalidateOnResize() {
  const map = useMap()

  useEffect(() => {
    const container = map.getContainer()
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(container)
    return () => observer.disconnect()
  }, [map])

  return null
}

function averageCenter(rows: VesselPositionRow[]): LatLngExpression {
  return [
    rows.reduce((sum, row) => sum + row.lat, 0) / rows.length,
    rows.reduce((sum, row) => sum + row.lng, 0) / rows.length,
  ]
}

export default function MapPart() {
  const props = useProps()
  const rows = useDataset(props.text('dataKey')) as VesselPositionRow[] | undefined
  const title = props.text('title')
  const accent = CHART_COLOR[colorOf(props, 'brand')]

  if (!rows || rows.length === 0) return null

  return (
    <div className="flex min-h-40 flex-1 flex-col gap-1">
      {title && (
        <h4 className="truncate font-display text-sm font-semibold tracking-tight text-fg">
          <InlineMarkdown text={title} />
        </h4>
      )}
      <div className="min-h-0 flex-1 overflow-hidden rounded-md">
        <MapContainer
          center={averageCenter(rows)}
          zoom={4}
          scrollWheelZoom={false}
          className="h-full w-full"
        >
          <InvalidateOnResize />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {rows.map((row) => (
            <CircleMarker
              key={row.bookingId}
              center={[row.lat, row.lng]}
              radius={7}
              pathOptions={{ color: accent, fillColor: accent, fillOpacity: 0.85, weight: 2 }}
            >
              <LeafletTooltip>{`${row.vessel} — ${row.carrier}`}</LeafletTooltip>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
    </div>
  )
}
