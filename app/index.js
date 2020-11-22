import * as THREE from 'three'
import OrbitControlsA from 'three-orbit-controls'
import { animate } from 'popmotion'

import screens from './screens.json'

const OrbitControls = OrbitControlsA(THREE)

import store from './store'

import TextureManager from './TextureManager'
import ExtendMaterial from './ExtendMaterial'
import CubeView from './CubeView'

import {
  VIEW_HOME,
  EVT_HOVER_MENU_ITEM,
  ENTRY_TYPE_IMAGE
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
const clock = new THREE.Clock()

const maxTextureSize = Math.min(4096, renderer.capabilities.maxTextureSize)
const texManager = TextureManager.init({ size: maxTextureSize })

const imageEntries = Object.entries(screens).reduce((acc, keyValue) => {
  const value = keyValue[1]
  Object.entries(value).forEach(keyValue => {
    const value = keyValue[1]
    if (value.type === ENTRY_TYPE_IMAGE) {
      acc.push(value)
    }
  })
  return acc
}, [])
imageEntries.forEach(entry => texManager.getEntryTexCoordinate(entry, entry.value))

const light2 = new THREE.AmbientLight( 0x404040 ); // soft white light
scene.add( light2 );
var light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(8, 30, 40)
light.castShadow = true; // default false
light.shadow.mapSize.width = maxTextureSize;
light.shadow.mapSize.height = maxTextureSize;
light.shadow.camera.left = -20;
light.shadow.camera.right = 20;
light.shadow.camera.top = 20;
light.shadow.camera.bottom = -20;
light.shadow.camera.near = 0.5;
light.shadow.camera.far = 2000

var helper = new THREE.DirectionalLightHelper(light)
scene.add(helper);
scene.add(light)

renderer.shadowMap.enabled = true
renderer.shadowMap.needsUpdate = true
renderer.setSize(viewportWidth, viewportHeight)
renderer.setPixelRatio(dpr)
renderer.setClearColor(0xaaaaaa)
renderer.shadowMap.enabled = true
renderer.outputEncoding = THREE.sRGBEncoding
domContainer.appendChild(renderer.domElement)

camera.position.set(0, 0, 45)
camera.lookAt(new THREE.Vector3())

let viewA = new CubeView({
  radius: 20,
  lightPosition: light.position,
  imageEntries
})
viewA.interactable = true
viewA.visible = true
viewA.drawScreen(screens['HOME'])
viewA.name = 'view a'

let viewB = new CubeView({
  radius: 20,
  lightPosition: light.position,
  rotation: [0, Math.PI, 0],
  imageEntries
})
viewB.name = 'view b'

scene.add(viewA.mesh)
scene.add(viewB.mesh)

// scene.add(new THREE.CameraHelper(light.shadow.camera))

// load all images

new OrbitControls(camera, domContainer)
document.body.addEventListener('mousemove', onMouseMove)
document.body.addEventListener('click', onMouseClick)
updateFrame()

function onMouseClick (e) {
  const { hoverEntryName } = store.getState()
  if (!hoverEntryName) {
    return
  }

  console.log(hoverEntryName.linksTo)

  e.preventDefault()

  if (hoverEntryName.linksTo.includes('mailto')) {
    window.open(hoverEntryName.linksTo)
    return
  }

  document.title = `${hoverEntryName.linksTo.substring(0, 1)}${hoverEntryName.linksTo.substring(1).toLowerCase()} - Georgi Nikolov`
  
  viewB.drawScreen(screens[hoverEntryName.linksTo])

  viewA.addToRotation([0, Math.PI, 0])
  viewB.addToRotation([0, Math.PI, 0])

  viewA.visible = false
  viewA.interactable = false
  viewB.visible = true
  viewB.interactable = true
  
  let temp = viewB
  viewB = viewA
  viewA = temp

  return
  let hasSwitchedSides = false  

  animate({
    // duration: 10000,
    onUpdate: v => {
      if (v > 0.5 && !hasSwitchedSides) {
        viewB.visible = true
        viewA.visible = false
        hasSwitchedSides = true
      }
      console.log(v)
      viewA.addToRotation([0, Math.PI * v, 0])
      viewB.addToRotation([0, Math.PI * v, 0])
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
  const opts = {
    dt: clock.getDelta(),
    raycaster,
    mouse,
    camera
  }
  viewA.onUpdateFrame(opts)
  viewB.onUpdateFrame(opts)

  renderer.render( scene, camera );

  requestAnimationFrame(updateFrame)
}
