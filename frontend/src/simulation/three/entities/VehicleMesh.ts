import * as THREE from 'three'

import type { VehicleState } from '../../core'

/**
 * One vehicle, as geometry.
 *
 * The silhouette is the point. A junction where every car is the same box is a
 * diagram, and the model already went to the trouble of giving the fleet
 * eleven-metre buses and 4,05 m hatchbacks precisely so that a queue has a
 * shape — so the mesh is built from `VehicleSpec` (length, width, height, body
 * style) rather than from a fixed prototype, and the paint comes from the
 * state's own `Paint`: the colour on screen is the colour the model drew.
 *
 * The body is oriented down `+Z`, because `heading` is `atan2(dx, dz)` — the
 * convention `core/`'s `headingOf` documents — and a mesh whose length lies
 * along +Z faces where the model says the vehicle is facing when rotated by
 * exactly that number. No offset, no quarter turn, no reconciliation.
 *
 * `opacity` is not decoration either: the model fades vehicles over their
 * first and last seven metres, deep inside the fog, so that nothing can be
 * seen arriving. The mesh honours that number, which means the fade lives in
 * one place — the model — and the renderer only believes it.
 */

/** Road surface height, matching the ribbons in `LanePath`. */
const GROUND_Y = 0.011

/** Bodywork starts just above the tarmac. There are no wheel meshes: at this
 *  camera distance a wheel is sub-pixel, and the gap it would fill is hidden
 *  by the body's own shadowless stance on near-black asphalt. */
const CLEARANCE = 0.05

const GLASS = '#141A24'
const TAXI_SIGN = '#E8C766'
const TAXI_SIGN_EMISSIVE = '#7A5E1B'
const EMERGENCY_RED = '#F0564F'
const POLICE_BLUE = '#4C8DF6'
const BAR_WHITE = '#E8EEF8'

export class VehicleMesh {
  readonly object: THREE.Group

  private materials: THREE.MeshLambertMaterial[]
  private lightBar: THREE.Mesh[] = []

  constructor(state: VehicleState) {
    const { spec, paint } = state

    this.object = new THREE.Group()
    this.materials = []

    const body = this.material(paint.body)
    const roof = this.material(paint.roof)
    const accent = this.material(paint.accent)
    const glass = this.material(GLASS)

    if (spec.body === 'saloon') {
      const lowerHeight = spec.height * 0.55
      const cabinHeight = spec.height - lowerHeight

      this.addBox(spec.width, lowerHeight, spec.length, 0, CLEARANCE + lowerHeight / 2, 0, body)
      this.addBox(
        spec.width * 0.86,
        cabinHeight,
        spec.length * 0.54,
        0,
        CLEARANCE + lowerHeight + cabinHeight / 2,
        -spec.length * 0.05,
        glass,
      )
      this.addBox(
        spec.width * 0.8,
        0.03,
        spec.length * 0.5,
        0,
        CLEARANCE + spec.height + 0.015,
        -spec.length * 0.05,
        roof,
      )
    } else {
      // Vans, ambulances and buses are one tall box with a windscreen band and
      // an upper panel — the shape that reads from above, where the roof
      // colour carries the identity.
      this.addBox(spec.width, spec.height, spec.length, 0, CLEARANCE + spec.height / 2, 0, body)
      this.addBox(
        spec.width * 0.94,
        0.04,
        spec.length * 0.94,
        0,
        CLEARANCE + spec.height + 0.02,
        0,
        roof,
      )
      this.addBox(
        spec.width * 0.8,
        spec.height * 0.3,
        0.08,
        0,
        CLEARANCE + spec.height * 0.74,
        spec.length / 2 - 0.02,
        glass,
      )

      if (spec.kind === 'ambulance') {
        this.addBox(
          spec.width + 0.02,
          spec.height * 0.16,
          spec.length * 0.96,
          0,
          CLEARANCE + spec.height * 0.46,
          0,
          accent,
        )
      }

      if (spec.kind === 'bus') {
        this.addBox(
          spec.width + 0.02,
          spec.height * 0.26,
          spec.length * 0.86,
          0,
          CLEARANCE + spec.height * 0.66,
          0,
          glass,
        )
      }
    }

    if (spec.roofSign) {
      // The one warm light in the fleet: a taxi sign unlit reads as a blob.
      const sign = this.material(TAXI_SIGN, TAXI_SIGN_EMISSIVE, 0.55)
      this.addBox(0.44, 0.12, 0.16, 0, CLEARANCE + spec.height + 0.07, -spec.length * 0.05, sign)
    }

    if (spec.lightBar) {
      // Emergency bars are two halves that alternate, which is how a real
      // light bar works and how the scene says "preemption" without a word of
      // UI: the flash is the vehicle's own, and nothing else in the frame
      // blinks — the pulse belongs to the interruption.
      const left = spec.lightBar === 'emergency' ? EMERGENCY_RED : POLICE_BLUE
      const right = spec.lightBar === 'emergency' ? POLICE_BLUE : BAR_WHITE

      const barY = CLEARANCE + spec.height + 0.08
      const barZ = spec.length * 0.16

      this.lightBar.push(
        this.addBox(
          spec.width * 0.34,
          0.09,
          0.18,
          -spec.width * 0.19,
          barY,
          barZ,
          this.material(left, left, 1.4),
        ),
        this.addBox(
          spec.width * 0.34,
          0.09,
          0.18,
          spec.width * 0.19,
          barY,
          barZ,
          this.material(right, right, 1.4),
        ),
      )
    }
  }

  sync(state: VehicleState, time: number): void {
    this.object.position.set(state.position.x, GROUND_Y, state.position.z)
    this.object.rotation.y = state.heading
    this.object.visible = state.opacity > 0.01

    for (const material of this.materials) {
      material.opacity = state.opacity
    }

    if (this.lightBar.length > 0) {
      // 2,5 Hz alternation, driven by the runner's stepped clock — so a paused
      // junction stops flashing, and a tab in the background does not strobe.
      const phase = Math.floor(time * 5) % 2
      for (let index = 0; index < this.lightBar.length; index += 1) {
        const bar = this.lightBar[index]
        if (bar) {
          bar.visible = index % 2 === phase
        }
      }
    }
  }

  dispose(): void {
    this.object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose()
      }
    })
    for (const material of this.materials) {
      material.dispose()
    }
    this.materials = []
    this.lightBar = []
  }

  private material(color: string, emissive?: string, emissiveIntensity?: number) {
    const material = new THREE.MeshLambertMaterial({
      color,
      transparent: true,
      opacity: 1,
      emissive: emissive ?? '#000000',
      emissiveIntensity: emissive ? (emissiveIntensity ?? 1) : 0,
    })
    this.materials.push(material)
    return material
  }

  private addBox(
    width: number,
    height: number,
    depth: number,
    x: number,
    y: number,
    z: number,
    material: THREE.MeshLambertMaterial,
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material)
    mesh.position.set(x, y, z)
    this.object.add(mesh)
    return mesh
  }
}
