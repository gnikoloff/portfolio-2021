import * as THREE from 'three'
import OrbitControlsA from 'three-orbit-controls'
import { animate } from 'popmotion'

import screens from './screens.json'

const OrbitControls = OrbitControlsA(THREE)

import store from './store'

import ExtendMaterial from './ExtendMaterial'
import TextureManager from './TextureManager'
import CubeView from './CubeView'

import {
  VIEW_HOME,
  EVT_HOVER_MENU_ITEM,
} from './constants'
import eventEmitter from './event-emitter.js'

ExtendMaterial(THREE)

let viewportWidth = window.innerWidth
let viewportHeight = window.innerHeight

const domContainer = document.getElementById('app-container')
const dpr = window.devicePixelRatio
const mouse = new THREE.Vector2(-100, -100)
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(45, viewportWidth / viewportHeight, 0.1, 1000)
const renderer = new THREE.WebGLRenderer({ antialias: true, shadowMapEnabled: true })
const raycaster = new THREE.Raycaster()

const texManager = new TextureManager({
  size: Math.min(4096, renderer.capabilities.maxTextureSize)
})

var light = new THREE.DirectionalLight(0x000000, 1);
light.position.set(30, 700, -500);
light.castShadow = true; // default false
light.shadow.mapSize.width = 128;
light.shadow.mapSize.height = 128;
light.shadow.camera.left = -20;
light.shadow.camera.right = 20;
light.shadow.camera.top = 20;
light.shadow.camera.bottom = -20;
light.shadow.camera.near = 0.5;
light.shadow.camera.far = 2000;



var helper = new THREE.DirectionalLightHelper(light)
scene.add(helper);

scene.add(light);

renderer.shadowMap.enabled = true
renderer.shadowMap.needsUpdate = true
renderer.setSize(viewportWidth, viewportHeight)
renderer.setPixelRatio(dpr)
renderer.setClearColor(0xaaaaaa)
renderer.shadowMap.enabled = true
renderer.outputEncoding = THREE.sRGBEncoding
document.body.appendChild(renderer.domElement)

camera.position.set(0, 0, 70)
camera.lookAt(new THREE.Vector3())

// const boxOffsets = new Float32Array(numBoxes * 3)

const totalWidth = 20
const totalHeight = 20
const totalDepth = 20

// const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
// const specialChars = '.'

// alphabet.split('').map(char => {
//   texManager.addAtlasEntry({ value: char.toUpperCase(), type: 'CHAR' })
//   texManager.addAtlasEntry({ value: char.toLowerCase(), type: 'CHAR' })
// })
// specialChars.split('').map(char => texManager.addAtlasEntry({ value: char, type: 'CHAR' }))
// texManager.addAtlasEntry({ type: 'DECORATION' })

// texManager.addAtlasEntry({ type: 'WORD_LINE', value: 'Focus.de' })
// texManager.addAtlasEntry({ type: 'WORD_LINE', value: 'WebGL Showcase Shop' })

// getScreenData()

let viewA = new CubeView({
  radius: 20,
  lightPosition: light.position,
  textureManager: texManager
})
viewA.interactable = true
viewA.drawScreen(screens[VIEW_HOME])

let viewB = new CubeView({
  radius: 20,
  lightPosition: light.position,
  textureManager: texManager,
  rotation: [0, Math.PI, 0]
})

scene.add(viewA.mesh)
scene.add(viewB.mesh)

var helper = new THREE.CameraHelper(light.shadow.camera);
scene.add(helper);

// eventEmitter.on(EVT_HOVER_MENU_ITEM, itemKey => {
//   viewB.drawScreen(screens[itemKey])
// })

new OrbitControls(camera)
document.body.addEventListener('mousemove', onMouseMove)
document.body.addEventListener('click', onMouseClick)
updateFrame()

function onMouseClick () {
  const { hoverEntryName } = store.getState()
  viewB.drawScreen(screens[hoverEntryName.linksTo])

  let targetRotationA = new THREE.Vector3()
  let targetRotationB = new THREE.Vector3(0, Math.PI, 0)

  targetRotationA.set(
    0,
    targetRotationA.y + Math.PI,
    0
  )
  targetRotationB.set(
    0,
    targetRotationB.y + Math.PI,
    0
  )

  animate({
    onUpdate: v => {
      viewA.rotation.set(...targetRotationA.toArray().map(a => a * v))
      viewB.rotation.set(...targetRotationB.toArray().map(a => a * v))
    },
    onComplete: () => {
      viewA.interactable = false
      viewB.interactable = true
      let temp = viewB
      viewB = viewA
      viewA = temp
    }
  })
  
  // viewA.interactable = true
  // viewB.interactable = true
}

function onMouseMove (e) {
  e.preventDefault()
  mouse.x = (e.clientX / viewportWidth) * 2 - 1
  mouse.y = - (e.clientY / viewportHeight) * 2 + 1
}

function updateFrame (ts = 0) {
  renderer.clearColor()

  const opts = {
    raycaster,
    mouse,
    camera
  }
  viewA.onUpdateFrame(opts)
  viewB.onUpdateFrame(opts)

  renderer.render( scene, camera );

  requestAnimationFrame(updateFrame)
}
