import * as THREE from 'three'

import { FOG_FAR, FOG_NEAR } from '../core'

/**
 * The stage: renderer, camera, light and fog — everything the scene owns that
 * is not a mesh.
 *
 * The palette below is `DESIGN.md`'s, carried into the WebGL context rather
 * than read from the stylesheet at runtime, because a colour that changes
 * meaning between the DOM and the canvas would break the one rule the design
 * system is built on: near-black navy is the ground, and everything that is
 * not near-black navy is deliberate. The fog is `core/`'s `FOG_NEAR` and
 * `FOG_FAR` and the background is the same colour as the fog, which is what
 * makes the horizon disappear instead of ending — a visible far edge would
 * frame the junction with a lie about where the world stops.
 *
 * No shadow maps. Depth in this scene comes from the tonal steps and from fog,
 * exactly as it does in the panels around the canvas, and a directional shadow
 * at this camera distance is the most expensive thing the frame could buy with
 * a mid-range laptop's budget.
 */

/** Console Black — the page, the fog and the asphalt share it. */
const CANVAS = '#070B14'
/** Signal Teal's dimmer sibling is the only cool light in the room. */
const HEMISPHERE_SKY = '#4E6284'
const HEMISPHERE_GROUND = '#0A0F19'
const KEY_LIGHT = '#E8EEF8'

/**
 * Camera placement, and why the distance is the number it is.
 *
 * The camera sits over the south-east corner at about sixty metres from the
 * origin, which is the longest distance at which the junction itself is still
 * inside `FOG_NEAR` — push it back and the thing the whole screen exists to
 * show starts dissolving into its own fog. The three-quarter angle is chosen
 * so both roads run diagonally across the frame, which is the only view in
 * which a queue, a stop line and the head serving it are legible at once.
 */
const CAMERA_POSITION = new THREE.Vector3(32, 40, 32)

/** Horizontal half-field of view the framing is held to; the vertical FOV is
 *  solved from it every resize, so a narrow canvas zooms out instead of
 *  cropping the junction off both approaches. */
const HORIZONTAL_HALF_FOV = THREE.MathUtils.degToRad(30)

/** Cap on the solved vertical FOV. Below this aspect the honest solve asks for
 *  a wide-angle lens that bows the junction; cropping the approaches a little
 *  is the lesser of the two distortions, and the fog was going to eat them
 *  anyway. */
const MAX_VERTICAL_HALF_FOV = THREE.MathUtils.degToRad(27.5)

const MAX_PIXEL_RATIO = 2

export interface Stage {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  /** Renders the scene as it currently stands — what a resize needs, since the
   *  runner deliberately stops emitting frames while the world is paused. */
  render: () => void
  resize: (width: number, height: number) => void
  dispose: () => void
}

export function createStage(canvas: HTMLCanvasElement): Stage {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO))

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(CANVAS)
  scene.fog = new THREE.Fog(CANVAS, FOG_NEAR, FOG_FAR)

  const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 420)
  camera.position.copy(CAMERA_POSITION)
  camera.lookAt(0, 0, 0)

  const hemisphere = new THREE.HemisphereLight(HEMISPHERE_SKY, HEMISPHERE_GROUND, 1.15)
  scene.add(hemisphere)

  const key = new THREE.DirectionalLight(KEY_LIGHT, 1.35)
  key.position.set(48, 70, 18)
  scene.add(key)

  return {
    renderer,
    scene,
    camera,
    render: () => {
      renderer.render(scene, camera)
    },
    resize: (width, height) => {
      if (width <= 0 || height <= 0) {
        return
      }
      renderer.setSize(width, height, false)

      const aspect = width / height
      camera.aspect = aspect
      const verticalHalf = Math.min(
        Math.atan(Math.tan(HORIZONTAL_HALF_FOV) / aspect),
        MAX_VERTICAL_HALF_FOV,
      )
      camera.fov = THREE.MathUtils.radToDeg(verticalHalf * 2)
      camera.updateProjectionMatrix()
    },
    dispose: () => {
      renderer.dispose()
    },
  }
}
