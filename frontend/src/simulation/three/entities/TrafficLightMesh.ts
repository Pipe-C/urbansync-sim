import * as THREE from 'three'

import { JUNCTION_HALF, ROAD_HALF, type Arm, type Aspect } from '../../core'
import { approachFrame } from './LanePath'

/**
 * One signal head, facing the driver it governs.
 *
 * Placement follows the rule the CSS scene stated and this one inherits: on
 * the far side of the junction and on the approaching driver's right, which is
 * where the real ones are. Both coordinates come from `layout.ts` — the
 * approach's own axis and its `rightOf` frame, read through `approachFrame` —
 * so a head cannot end up on the wrong corner when the geometry is retuned.
 *
 * The lamp stack is European: red, amber, green, with the protected-left arrow
 * beneath them, because `aspects()` answers for the through movements and
 * `leftOpen()` answers for the arrow, and one lamp per truth is the whole
 * reason the controller documents them separately. Inactive lamps stay lit at
 * twenty percent of their own hue rather than going dark — a head whose lamps
 * disappear reads as a broken head, and `DESIGN.md` already settled that the
 * identity of the lamp survives its state.
 *
 * Above the housing sits the preemption bar. It is the only looping animation
 * this scene owns, it is Emergency Blue, and it appears on exactly one head at
 * a time — the one the controller is serving — so a reviewer can point at the
 * interruption and say which arm it took.
 */

const HOUSING = '#151C29'
const POST = '#10151E'

const LAMP_GREEN = '#34D399'
const LAMP_AMBER = '#FBBF24'
const LAMP_RED = '#F87171'
const LAMP_PRIORITY = '#60A5FA'

const INACTIVE_OPACITY = 0.2

/** Metres from the junction edge to the pole, and from the kerb out to it. */
const SETBACK = 1.6
const LATERAL_OFFSET = 2.6

const POST_HEIGHT = 2.1
const HOUSING_HEIGHT = 2.1
const HOUSING_WIDTH = 0.56
const HOUSING_DEPTH = 0.3

const LAMP_RADIUS = 0.17
/** Lamp centres inside the housing: three through lamps, arrow below them. */
const LAMP_LEVELS = { red: 0.7, amber: 0.1, green: -0.5, arrow: -0.92 }

export class SignalHeadMesh {
  readonly object: THREE.Group

  private lampMaterials: Record<'red' | 'amber' | 'green' | 'arrow', THREE.MeshBasicMaterial>
  private priority: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>

  constructor(arm: Arm) {
    const { axis, right } = approachFrame(arm)

    this.object = new THREE.Group()
    this.object.position.set(
      axis.x * (JUNCTION_HALF + SETBACK) + right.x * (ROAD_HALF + LATERAL_OFFSET),
      0,
      axis.z * (JUNCTION_HALF + SETBACK) + right.z * (ROAD_HALF + LATERAL_OFFSET),
    )
    // Built facing +Z; the panel has to face the driver, who is upstream on
    // −axis, so the head is turned to look back along the approach.
    this.object.rotation.y = Math.atan2(-axis.x, -axis.z)

    const postMaterial = new THREE.MeshLambertMaterial({ color: POST })
    const housingMaterial = new THREE.MeshLambertMaterial({ color: HOUSING })

    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.1, POST_HEIGHT, 10),
      postMaterial,
    )
    post.position.y = POST_HEIGHT / 2
    this.object.add(post)

    const housingY = POST_HEIGHT + HOUSING_HEIGHT / 2 - 0.15
    const housing = new THREE.Mesh(
      new THREE.BoxGeometry(HOUSING_WIDTH, HOUSING_HEIGHT, HOUSING_DEPTH),
      housingMaterial,
    )
    housing.position.y = housingY
    this.object.add(housing)

    this.lampMaterials = {
      red: this.lamp(LAMP_RED, housingY + LAMP_LEVELS.red),
      amber: this.lamp(LAMP_AMBER, housingY + LAMP_LEVELS.amber),
      green: this.lamp(LAMP_GREEN, housingY + LAMP_LEVELS.green),
      arrow: this.lamp(LAMP_GREEN, housingY + LAMP_LEVELS.arrow, 0.11),
    }

    // The preemption bar. It rides above the housing so that priority does not
    // replace an aspect — the arm really is green while it is preempted, and
    // the blue says *why*.
    this.priority = new THREE.Mesh(
      new THREE.BoxGeometry(HOUSING_WIDTH * 0.85, 0.1, 0.14),
      new THREE.MeshBasicMaterial({ color: LAMP_PRIORITY, transparent: true, opacity: 1 }),
    )
    this.priority.position.y = housingY + HOUSING_HEIGHT / 2 + 0.08
    this.priority.visible = false
    this.object.add(this.priority)

    this.postMaterials = [postMaterial, housingMaterial]
  }

  sync(aspect: Aspect, leftOpen: boolean, priority: boolean, time: number): void {
    this.lampMaterials.red.opacity = aspect === 'red' ? 1 : INACTIVE_OPACITY
    this.lampMaterials.amber.opacity = aspect === 'amber' ? 1 : INACTIVE_OPACITY
    this.lampMaterials.green.opacity = aspect === 'green' ? 1 : INACTIVE_OPACITY
    this.lampMaterials.arrow.opacity = leftOpen ? 1 : INACTIVE_OPACITY

    this.priority.visible = priority
    if (priority) {
      // ~1 Hz sine. Deliberately the slowest rhythm in the product: the
      // vehicle's own bar flashes at 2,5 Hz, and the head confirming the
      // grant underneath it should read as a held state, not as a second
      // strobe competing with the first.
      this.priority.material.opacity = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(time * 6.28))
    }
  }

  dispose(): void {
    this.object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose()
      }
    })
    for (const material of [...Object.values(this.lampMaterials), ...this.postMaterials]) {
      material.dispose()
    }
    this.priority.material.dispose()
  }

  private postMaterials: THREE.MeshLambertMaterial[]

  private lamp(color: string, y: number, radius = LAMP_RADIUS): THREE.MeshBasicMaterial {
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: INACTIVE_OPACITY,
    })

    const geometry = new THREE.CylinderGeometry(radius, radius, 0.06, 20)
    geometry.rotateX(Math.PI / 2)

    const lamp = new THREE.Mesh(geometry, material)
    lamp.position.set(0, y, HOUSING_DEPTH / 2 + 0.03)
    this.object.add(lamp)
    return material
  }
}
