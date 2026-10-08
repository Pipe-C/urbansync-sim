import * as THREE from 'three'

import { ARMS, type Arm, type IntersectionWorld } from '../core'
import type { FrameEvent } from '../events/SimulationEventBus'
import type { Stage } from './scene'
import { createRoadLayer } from './entities/LanePath'
import { SignalHeadMesh } from './entities/TrafficLightMesh'
import { VehicleMesh } from './entities/VehicleMesh'
import { WalkerMesh } from './entities/WalkerMesh'

/**
 * The frame's contents: everything that changes, plus the road it happens on.
 *
 * This class owns no time. The runner decides when the world advances, the bus
 * decides who hears about it, and the scene's only job on a `frame` is to make
 * the model visible — read the arrays, move the meshes, paint. That is the
 * whole contract, and keeping it small is what lets `core/` be tested without
 * a canvas in the room.
 *
 * Pools are keyed by the model's own ids and reconciled every frame: a
 * vehicle that exists gets a mesh, a mesh whose vehicle no longer exists is
 * removed and disposed. Nothing here guesses how many vehicles there will be,
 * because the model decides that, not the renderer. A reset is the same
 * reconciliation with every id gone — the runner hands over a new world
 * reference, the pools notice, and the junction rebuilds itself without a
 * special case for "restart".
 *
 * One `render` per `frame`, and never more: React re-rendering, a resize, a
 * readout tick — none of them may buy a repaint. The single exception is a
 * resize while the world is paused, where no frames are coming and the canvas
 * would otherwise be stretched over a stale buffer.
 */
export class IntersectionScene {
  private readonly stage: Stage
  private readonly road: THREE.Group
  private readonly heads: Record<Arm, SignalHeadMesh>
  private readonly vehicles = new Map<number, VehicleMesh>()
  private readonly walkers = new Map<number, WalkerMesh>()
  private world: IntersectionWorld | null = null

  constructor(stage: Stage) {
    this.stage = stage
    this.road = createRoadLayer()
    stage.scene.add(this.road)

    const heads = {} as Record<Arm, SignalHeadMesh>
    for (const arm of ARMS) {
      const head = new SignalHeadMesh(arm)
      heads[arm] = head
      stage.scene.add(head.object)
    }
    this.heads = heads
  }

  onFrame(event: FrameEvent): void {
    const { world, time } = event

    // A new world reference is a reset: every pooled mesh belongs to the old
    // junction and is rebuilt from the new one on this same frame.
    if (world !== this.world) {
      this.world = world
      this.clearPools()
    }

    this.syncVehicles(world, time)
    this.syncWalkers(world)
    this.syncHeads(world, time)
    this.stage.render()
  }

  /** Paints the scene as it stands. For resizes while the runner is paused. */
  render(): void {
    this.stage.render()
  }

  dispose(): void {
    this.clearPools()
    this.stage.scene.remove(this.road)
    disposeTree(this.road)
    for (const arm of ARMS) {
      const head = this.heads[arm]
      this.stage.scene.remove(head.object)
      head.dispose()
    }
    this.world = null
  }

  private syncVehicles(world: IntersectionWorld, time: number): void {
    const present = new Set<number>()

    for (const state of world.vehicles) {
      present.add(state.id)

      let mesh = this.vehicles.get(state.id)
      if (mesh === undefined) {
        mesh = new VehicleMesh(state)
        this.vehicles.set(state.id, mesh)
        this.stage.scene.add(mesh.object)
      }
      mesh.sync(state, time)
    }

    for (const [id, mesh] of this.vehicles) {
      if (!present.has(id)) {
        this.stage.scene.remove(mesh.object)
        mesh.dispose()
        this.vehicles.delete(id)
      }
    }
  }

  private syncWalkers(world: IntersectionWorld): void {
    const present = new Set<number>()

    for (const walker of world.walkers) {
      present.add(walker.id)

      let mesh = this.walkers.get(walker.id)
      if (mesh === undefined) {
        mesh = new WalkerMesh(walker)
        this.walkers.set(walker.id, mesh)
        this.stage.scene.add(mesh.object)
      }
      mesh.sync(walker)
    }

    for (const [id, mesh] of this.walkers) {
      if (!present.has(id)) {
        this.stage.scene.remove(mesh.object)
        mesh.dispose()
        this.walkers.delete(id)
      }
    }
  }

  private syncHeads(world: IntersectionWorld, time: number): void {
    const aspects = world.controller.aspects()
    const summary = world.summary()

    for (const arm of ARMS) {
      this.heads[arm].sync(
        aspects[arm],
        world.controller.leftOpen(arm),
        summary.preemption && summary.activeArm === arm,
        time,
      )
    }
  }

  private clearPools(): void {
    for (const mesh of this.vehicles.values()) {
      this.stage.scene.remove(mesh.object)
      mesh.dispose()
    }
    this.vehicles.clear()

    for (const mesh of this.walkers.values()) {
      this.stage.scene.remove(mesh.object)
      mesh.dispose()
    }
    this.walkers.clear()
  }
}

/** Disposes every geometry and material under a subtree. Static layers build
 *  their materials where they build their meshes, so disposal walks the tree
 *  instead of keeping a second inventory that could go stale. */
function disposeTree(root: THREE.Object3D): void {
  root.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose()
      const materials = Array.isArray(child.material) ? child.material : [child.material]
      for (const material of materials) {
        material.dispose()
      }
    }
  })
}
