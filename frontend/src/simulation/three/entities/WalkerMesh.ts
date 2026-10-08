import * as THREE from 'three'

import { headingOf, type Walker } from '../../core'

/**
 * A pedestrian.
 *
 * The model is explicit about why people are in this scene at all: they are
 * the visible reason the signal has an all-red interval, so a figure sliding
 * across the zebra without moving its legs would undercut the very thing it is
 * there to argue. Two legs that alternate with the stride, a torso in the
 * clothing colour the model drew, a head in the skin tone it drew — four
 * meshes, and the walk cycle is read from `stride`, which the model already
 * advances by distance rather than by time.
 *
 * Position and facing come straight from the crosswalk frame: `offset` runs
 * from the origin kerb along `across`, so the point on the road is the
 * crossing centre shifted by (offset − length/2), and the direction of travel
 * is `across` signed with `direction`. The renderer does no arithmetic of its
 * own beyond that subtraction.
 */

const GROUND_Y = 0.011

const NO_SWING = 0
const SWING = 0.5
const BOB = 0.02

export class WalkerMesh {
  readonly object: THREE.Group

  private legs: [THREE.Mesh, THREE.Mesh]
  private materials: THREE.MeshLambertMaterial[] = []

  constructor(walker: Walker) {
    const { height, clothing } = walker

    const legLength = height * 0.46
    const torsoLength = height * 0.34
    const headRadius = height * 0.085

    this.object = new THREE.Group()

    const legsMaterial = this.material(clothing.legs)
    const topMaterial = this.material(clothing.top)
    const skinMaterial = this.material(clothing.skin)

    const leftLeg = this.box(0.13, legLength, 0.16, -0.085, legLength / 2, 0, legsMaterial)
    const rightLeg = this.box(0.13, legLength, 0.16, 0.085, legLength / 2, 0, legsMaterial)
    this.legs = [leftLeg, rightLeg]

    this.box(0.36, torsoLength, 0.22, 0, legLength + torsoLength / 2, 0, topMaterial)

    const head = new THREE.Mesh(new THREE.SphereGeometry(headRadius, 12, 10), skinMaterial)
    head.position.y = legLength + torsoLength + headRadius * 0.85
    this.object.add(head)
  }

  sync(walker: Walker): void {
    const crosswalk = walker.crosswalk
    const alongCrossing = walker.offset - crosswalk.length / 2

    const x = crosswalk.centre.x + crosswalk.across.x * alongCrossing
    const z = crosswalk.centre.z + crosswalk.across.z * alongCrossing

    const walking = walker.state === 'walking'
    const swing = walking ? Math.sin(walker.stride) * SWING : NO_SWING

    const bob = walking ? Math.abs(Math.cos(walker.stride)) * BOB : 0
    this.object.position.set(x, GROUND_Y + bob, z)

    // Always facing the way they are about to go: a crowd waiting on a kerb
    // all facing the crossing reads as intent, which is what a queue of
    // people at a signal is.
    const faceX = crosswalk.across.x * walker.direction
    const faceZ = crosswalk.across.z * walker.direction
    this.object.rotation.y = headingOf({ x: faceX, z: faceZ })

    const [leftLeg, rightLeg] = this.legs
    if (leftLeg) leftLeg.rotation.x = swing
    if (rightLeg) rightLeg.rotation.x = -swing
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
  }

  private material(color: string): THREE.MeshLambertMaterial {
    const material = new THREE.MeshLambertMaterial({ color })
    this.materials.push(material)
    return material
  }

  private box(
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
