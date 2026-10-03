import { useRef, useState } from 'react'
import type { KeyboardEvent, MouseEvent, PointerEvent } from 'react'

const width = 360
const height = 480
const initialViewport = { zoom: 1, x: width / 2, y: height / 2 }

type Viewport = typeof initialViewport
type Drag = { pointerId: number; clientX: number; clientY: number; viewport: Viewport; moved: boolean }

function constrain(viewport: Viewport): Viewport {
  const halfWidth = width / viewport.zoom / 2
  const halfHeight = height / viewport.zoom / 2
  return {
    ...viewport,
    x: Math.max(halfWidth, Math.min(width - halfWidth, viewport.x)),
    y: Math.max(halfHeight, Math.min(height - halfHeight, viewport.y)),
  }
}

export function useRegionMapViewport() {
  const [viewport, setViewport] = useState(initialViewport)
  const drag = useRef<Drag | null>(null)
  const suppressClick = useRef(false)

  function changeZoom(delta: number) {
    setViewport((current) => constrain({ ...current, zoom: Math.max(1, Math.min(4, current.zoom + delta)) }))
  }

  function onPointerDown(event: PointerEvent<SVGSVGElement>) {
    suppressClick.current = false
    if (viewport.zoom === 1 || !event.isPrimary || event.button !== 0) return
    drag.current = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, viewport, moved: false }
  }

  function onPointerMove(event: PointerEvent<SVGSVGElement>) {
    const start = drag.current
    if (!start || start.pointerId !== event.pointerId) return
    const dx = event.clientX - start.clientX
    const dy = event.clientY - start.clientY
    if (!start.moved && Math.hypot(dx, dy) < 4) return
    start.moved = true
    suppressClick.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
    const bounds = event.currentTarget.getBoundingClientRect()
    // SVG uses xMidYMid meet: account for letterboxing at every screen size.
    const pixelsPerUnit = Math.min(bounds.width / width, bounds.height / height) * start.viewport.zoom
    setViewport(constrain({
      ...start.viewport,
      x: start.viewport.x - dx / pixelsPerUnit,
      y: start.viewport.y - dy / pixelsPerUnit,
    }))
  }

  function endDrag(event: PointerEvent<SVGSVGElement>) {
    if (drag.current?.pointerId !== event.pointerId) return
    drag.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  function onClickCapture(event: MouseEvent<SVGSVGElement>) {
    if (!suppressClick.current || event.detail === 0) return
    event.preventDefault()
    event.stopPropagation()
    suppressClick.current = false
  }

  function onKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    if (viewport.zoom === 1) return
    const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key]
    if (!direction) return
    event.preventDefault()
    setViewport((current) => constrain({ ...current, x: current.x + direction[0] * 24 / current.zoom, y: current.y + direction[1] * 24 / current.zoom }))
  }

  function revealRegion(bounds: DOMRect) {
    setViewport((current) => {
      const halfWidth = width / current.zoom / 2
      const halfHeight = height / current.zoom / 2
      const x = bounds.x + bounds.width / 2
      const y = bounds.y + bounds.height / 2
      if (x >= current.x - halfWidth && x <= current.x + halfWidth && y >= current.y - halfHeight && y <= current.y + halfHeight) return current
      return constrain({ ...current, x, y })
    })
  }

  return {
    zoom: viewport.zoom,
    viewBox: `${viewport.x - width / viewport.zoom / 2} ${viewport.y - height / viewport.zoom / 2} ${width / viewport.zoom} ${height / viewport.zoom}`,
    zoomIn: () => changeZoom(0.5),
    zoomOut: () => changeZoom(-0.5),
    reset: () => setViewport(initialViewport),
    revealRegion,
    handlers: { onPointerDown, onPointerMove, onPointerUp: endDrag, onPointerCancel: endDrag, onLostPointerCapture: endDrag, onClickCapture, onKeyDown },
  }
}
