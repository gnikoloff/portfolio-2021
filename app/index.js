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
  setDebugMode
} from './store/actions'

import {
  extractViewFromURL
} from './helpers'

import {
  ENTRY_TYPE_IMAGE,
  RESOURCE_IMAGE,
  RESOURCE_FONT,
  FONT_NAME,
  MAX_VIEWPORT_WIDTH,
} from './constants'

import eventEmitter from './event-emitter.js'

const queryParams = new URLSearchParams(window.location.search)
const isDebugMode = queryParams.has('debugMode')
store.dispatch(setDebugMode(isDebugMode))

let viewportWidth
let viewportHeight
let dpr = window.devicePixelRatio
let loadProgress = 0

const domContainer = document.getElementById('app-container')
const domLoadIndicator = document.getElementById('load-indicator')
const mouse = new THREE.Vector2(-100, -100)
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(45, viewportWidth / viewportHeight, 0.1, 50)
const renderer = new THREE.WebGLRenderer({ antialias: true })
const raycaster = new THREE.Raycaster()
const clock = new THREE.Clock()
const container = new THREE.Object3D()
const cameraLookAt = new THREE.Vector3()
const cameraPosTarget = new THREE.Vector3()

const maxTextureSize = Math.min(4096, renderer.capabilities.maxTextureSize)
// const maxTextureSize = 1024
const texManager = TextureManager.init({ size: maxTextureSize })

const loadManager = LoadManager.init()

Object.values(screens).reduce((acc, value) => {
  Object.values(value.entries).forEach(entry => {
    if (entry.type === RESOURCE_IMAGE) {
      acc.push(entry)
      const { src } = entry
      loadManager.addResourceToLoad({ type: ENTRY_TYPE_IMAGE, src })
      texManager.allocateTexture({ textureId: src, size: 512 })
    }
  })
  return acc
}, [])

loadManager.addResourceToLoad({
  type: RESOURCE_FONT,
  fontName: `${FONT_NAME}:400:latin`,
  text: Object.entries(screens).reduce((acc, [key, value]) => {
    const appendChar = char => {
      if (!acc.includes(char)) {
        acc += char
      }
    }
    key.split('').forEach(appendChar)
    Object.keys(value.entries).forEach(key => key.split('').forEach(appendChar))
    return acc
  }, '')
})

const light2 = new THREE.AmbientLight( 0xFFFFFF )
scene.add( light2 )

var light = new THREE.PointLight(0xffffff, 1);
light.decay = 2
light.position.set(10, 30, 60)
light.castShadow = true; // default false
light.shadow.mapSize.width = maxTextureSize
light.shadow.mapSize.height = maxTextureSize
// light.shadow.camera.left = -20;
// light.shadow.camera.right = 20;
// light.shadow.camera.top = 20;
// light.shadow.camera.bottom = -20;
// light.shadow.camera.near = 0.5;
// light.shadow.camera.far = 4000
scene.add(light)

renderer.shadowMap.enabled = true
renderer.shadowMap.needsUpdate = true
renderer.setClearColor(0xFFFFFF)
renderer.shadowMap.enabled = true
renderer.outputEncoding = THREE.sRGBEncoding
renderer.domElement.id = 'webgl-scene'
domContainer.appendChild(renderer.domElement)

camera.position.set(0, 0, 45)
camera.lookAt(cameraLookAt)

scene.add(container)

let viewA = new CubeView({
  radius: 20,
  lightPosition: light.position
})

let viewB = new CubeView({
  radius: 20,
  lightPosition: light.position
})

container.add(viewA.mesh)
container.add(viewB.mesh)

document.addEventListener('DOMContentLoaded', init)

function init () {
  loadManager.loadResources().then(onLoadResources)

  if (isDebugMode) {
    new OrbitControls(camera, domContainer)
  }
  document.body.addEventListener('mousemove', onMouseMove)
  document.body.addEventListener('click', onMouseClick)

  window.addEventListener('resize', onResize)

  window.onpopstate = () => {
    const viewName = extractViewFromURL()
    onNavigation(viewName, screens[viewName])
  }

  onResize()
  updateFrame()
}

function onLoadResources (allResources) {
  const imageEntries = allResources.filter(({ type }) => type === ENTRY_TYPE_IMAGE)
  imageEntries.forEach(image => texManager.addAtlasEntry(image, image.src))
  eventEmitter.emit('loaded-textures', imageEntries)


  viewA.interactable = true
  viewA.visible = true

  const viewName = extractViewFromURL()
  viewA.drawScreen(viewName, screens[viewName])
}

function onResize () {
  if (window.innerWidth > MAX_VIEWPORT_WIDTH) {
    viewportWidth = window.innerWidth * (MAX_VIEWPORT_WIDTH / window.innerWidth)
    viewportHeight = window.innerHeight * (MAX_VIEWPORT_WIDTH / window.innerWidth)
  } else {
    viewportWidth = window.innerWidth
    viewportHeight = window.innerHeight
  }
  dpr = window.devicePixelRatio
  
  camera.aspect = viewportWidth / viewportHeight
  camera.updateProjectionMatrix()
  renderer.setSize(viewportWidth, viewportHeight)
  renderer.setPixelRatio(dpr)
}

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
  } else if (hoverEntryName.linksTo.includes('https') || hoverEntryName.linksTo.includes('http')) {
    window.open(hoverEntryName.linksTo, '_blank')
    return
  }

  document.title = `${hoverEntryName.linksTo.substring(0, 1)}${hoverEntryName.linksTo.substring(1).toLowerCase()} - Georgi Nikolov`
  
  const pathname = screens[hoverEntryName.linksTo].url
  window.history.pushState({}, pathname, `${window.location.origin}${pathname}`)
  onNavigation(hoverEntryName.linksTo, screens[hoverEntryName.linksTo])
}

function onNavigation (to) {
  viewB.drawScreen(to, screens[to])

  let hasSwitchedSides = false

  const direction = Math.floor(Math.random() * 4)

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
  
}

function onMouseMove (e) {
  e.preventDefault()
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1
  mouse.y = - (e.clientY / window.innerHeight) * 2 + 1

  cameraPosTarget.x = mouse.x * 4
  cameraPosTarget.y = mouse.y * 4
}

function updateFrame (ts = 0) {
  const { loadProgress: newLoadProgress, isDebugMode } = store.getState()

  const dt = clock.getDelta()

  const loadProgressDiff = Math.abs(1 - loadProgress)
  if (loadProgressDiff > 0.01) {
    loadProgress += (newLoadProgress - loadProgress) * (dt)
    domLoadIndicator.textContent = `${Math.round(loadProgress * 100)}%`
  } else {
    domLoadIndicator.classList.add('hidden')
  }
  if (!isDebugMode) {
    camera.position.x += (cameraPosTarget.x - camera.position.x) * (dt * 2)
    camera.position.y += (cameraPosTarget.y - camera.position.y) * (dt * 2)
    camera.lookAt(cameraLookAt)
  }

  raycaster.setFromCamera(mouse, camera)

  const opts = {
    dt,
    raycaster,
  }
  viewA.onUpdateFrame(opts)
  viewB.onUpdateFrame(opts)

  renderer.render( scene, camera )

  requestAnimationFrame(updateFrame)
}
