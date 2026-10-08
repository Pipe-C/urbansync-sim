import { useEffect, useRef, useState } from 'react'

import { simulationBus, type FrameEvent } from '@/simulation/events/SimulationEventBus'
import { acquireSimulationRunner, getRunnerFrame } from '@/simulation/runner'
import { IntersectionScene } from '@/simulation/three/IntersectionScene'
import { createStage, type Stage } from '@/simulation/three/scene'
import { cn } from '@/utils/cn'

/**
 * The WebGL canvas, and nothing else.
 *
 * This component owns three lifecycles and deliberately none of the model's.
 * It creates the stage (renderer, camera, lights), creates the scene that
 * mirrors the world onto it, subscribes to the bus, joins the shared runner,
 * and takes all of it apart on unmount. What it never does is hold simulation
 * state: the world lives in the runner, the numbers live in the readout, and
 * this file's only opinion about the junction is how big the drawing buffer
 * should be.
 *
 * The catch-up call before acquiring the runner exists for one situation: the
 * world is paused, the loop is ticking but publishing no frames, and a canvas
 * mounts onto it — navigating to the observer route mid-run. Without that one
 * paint the visitor would find a black rectangle where the junction is.
 *
 * A failed WebGL context is a normal error state, not an exception: the
 * dashboard keeps working, and the box says plainly what is missing instead of
 * leaving an empty canvas that looks like a loading bug.
 */

export interface ThreeCanvasProps {
  className?: string
}

export function ThreeCanvas({ className }: ThreeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas === null) {
      return
    }

    const stage = tryCreateStage(canvas)
    if (stage === null) {
      setFailed(true)
      return
    }

    const scene = new IntersectionScene(stage)

    const onFrame = (event: FrameEvent) => scene.onFrame(event)
    simulationBus.on('frame', onFrame)

    // Paint what the runner is already holding, then join it. The subscription
    // comes first so the very first published frame cannot slip past the scene.
    const catchUp = getRunnerFrame()
    if (catchUp !== null) {
      scene.onFrame(catchUp)
    }
    const release = acquireSimulationRunner()

    // The canvas sizes itself through CSS; the renderer only needs to be told.
    // A resize while paused also needs an immediate paint, because the runner
    // is deliberately silent in that state.
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry === undefined) {
        return
      }
      stage.resize(entry.contentRect.width, entry.contentRect.height)
      scene.render()
    })
    observer.observe(canvas)

    // Without this the context is lost for good; with it the browser restores
    // it and three repaints from the same scene.
    const onContextLost = (event: Event) => event.preventDefault()
    canvas.addEventListener('webglcontextlost', onContextLost)

    return () => {
      observer.disconnect()
      canvas.removeEventListener('webglcontextlost', onContextLost)
      simulationBus.off('frame', onFrame)
      release()
      scene.dispose()
      stage.dispose()
    }
  }, [])

  if (failed) {
    return (
      <div className={cn('flex size-full items-center justify-center bg-canvas', className)}>
        <p className="px-4 text-center font-mono text-micro uppercase tracking-widest text-muted">
          Motor 3D no disponible en este dispositivo
        </p>
      </div>
    )
  }

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label="Intersección en vivo renderizada en 3D"
      className={cn('block size-full', className)}
    />
  )
}

/** WebGL may be unavailable. The canvas reports that as its own error state
 *  rather than throwing up the React tree. */
function tryCreateStage(canvas: HTMLCanvasElement): Stage | null {
  try {
    return createStage(canvas)
  } catch {
    return null
  }
}
