import * as THREE from 'three'
import OrbitControlsA from 'three-orbit-controls'
import * as popmotion from 'popmotion'

import screens from './screens.json'

const OrbitControls = OrbitControlsA(THREE)

import store from './store'

import TextureManager from './TextureManager'
import LoadManager from './LoadManager'
import CubeView from './CubeView'

import {
  VIEW_HOME,
  EVT_HOVER_MENU_ITEM,
  ENTRY_TYPE_IMAGE
} from './constants'

import eventEmitter from './event-emitter.js'

let viewportWidth = window.innerWidth
let viewportHeight = window.innerHeight

const domContainer = document.getElementById('app-container')
const dpr = window.devicePixelRatio
const mouse = new THREE.Vector2(-100, -100)
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(45, viewportWidth / viewportHeight, 0.1, 50)
const renderer = new THREE.WebGLRenderer({ antialias: true, shadowMapEnabled: true })
const raycaster = new THREE.Raycaster()
const clock = new THREE.Clock()
const container = new THREE.Object3D()

const maxTextureSize = Math.min(4096, renderer.capabilities.maxTextureSize)
// const maxTextureSize = 1024
const texManager = TextureManager.init({ size: maxTextureSize })

const loadManager = LoadManager.init()

Object.values(screens).reduce((acc, value) => {
  Object.values(value).forEach(entry => {
    if (entry.type === ENTRY_TYPE_IMAGE) {
      acc.push(entry)
      const { src } = entry
      loadManager.addResourceToLoad({ type: ENTRY_TYPE_IMAGE, src })
      texManager.allocateTexture({ textureId: src, size: 256 })
    }
  })
  return acc
}, [])

loadManager.loadResources().then(allResources => {
  const imageEntries = allResources
    .filter(({ type }) => type === ENTRY_TYPE_IMAGE)
    .map(image => texManager.addAtlasEntry(image, image.src))
  eventEmitter.emit('loaded-textures', imageEntries)
})

// Promise
//   .all(imageEntries.map(({ src }) => loadImage({ src })))
//   .then(images => {
//     const newImageEntries = images.map((image, i) => {
//       const entry = {
//         ...imageEntries[i],
//         value: image
//       }
//       console.log(texManager._textureSet)
//       texManager.addAtlasEntry(entry, entry.src)
//       return entry
//     })
//     
//   })

const light2 = new THREE.AmbientLight( 0xFFFFFF )
scene.add( light2 )

var light = new THREE.PointLight(0xffffff, 1);
light.position.set(10, 30, 60)
light.castShadow = true; // default false
light.shadow.mapSize.width = maxTextureSize;
light.shadow.mapSize.height = maxTextureSize;
// light.shadow.camera.left = -20;
// light.shadow.camera.right = 20;
// light.shadow.camera.top = 20;
// light.shadow.camera.bottom = -20;
// light.shadow.camera.near = 0.5;
// light.shadow.camera.far = 4000
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

scene.add(container)

let viewA = new CubeView({
  radius: 20,
  lightPosition: light.position
})
viewA.interactable = true
viewA.visible = true
viewA.drawScreen(VIEW_HOME, screens[VIEW_HOME])
viewA.name = 'view a'

let viewB = new CubeView({
  radius: 20,
  lightPosition: light.position
})
viewB.name = 'view b'

container.add(viewA.mesh)
container.add(viewB.mesh)

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
  
  viewB.drawScreen(hoverEntryName.linksTo, screens[hoverEntryName.linksTo])

  // viewA.addToRotation([0, Math.PI, 0])
  // viewB.addToRotation([0, Math.PI, 0])

  // viewA.visible = false
  
  // let temp = viewB
  // viewB = viewA
  // viewA = temp

  // return
  let hasSwitchedSides = false

  const direction = Math.floor(Math.random() * 4)
  // const direction = 3


  const oldRotation = container.rotation.clone()
  const newRotation = new THREE.Vector3()

  if (direction === 0) {
    newRotation.y -= Math.PI / 2
  } else if (direction === 1) {
    newRotation.y += Math.PI / 2
  } else if (direction === 2) {
    newRotation.x += Math.PI / 2
  } else if (direction === 3) {
    newRotation.x -= Math.PI / 2
  }


  // const newRotation = new THREE.Vector3(
  //   oldRotation.x === Math.PI * 0.5 ? 0 : Math.PI * 0.5,
  //   oldRotation.y === Math.PI * 0.5 ? 0 : Math.PI * 0.5,
  //   0
  // )

  viewA.interactable = false

  eventEmitter.emit('transitioning-start', direction)
  viewB.visible = true
// return
  popmotion.animate({
    duration: 1000,
    ease: popmotion.easeOut,
    onUpdate: v => {
      eventEmitter.emit('transitioning', v)
      container.rotation.x = oldRotation.x + (newRotation.x - oldRotation.x) * v
      container.rotation.y = oldRotation.y + (newRotation.y - oldRotation.y) * v
      container.rotation.z = oldRotation.z + (newRotation.z - oldRotation.z) * v
      if (v > 0.5 && !hasSwitchedSides) {
        hasSwitchedSides = true
      }
    },
    onComplete: () => {
      viewB.interactable = true
      viewA.visible = false
      const temp = viewB
      viewB = viewA
      viewA = temp
      eventEmitter.emit('transitioning-end')
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
  raycaster.setFromCamera(mouse, camera)

  const opts = {
    dt: clock.getDelta(),
    raycaster,
  }
  viewA.onUpdateFrame(opts)
  viewB.onUpdateFrame(opts)

  renderer.render( scene, camera );

  requestAnimationFrame(updateFrame)
}
