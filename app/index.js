import * as THREE from 'three'
import OrbitControlsA from 'three-orbit-controls'
import * as popmotion from 'popmotion'

import screens from './screens.json'

const OrbitControls = OrbitControlsA(THREE)

import store from './store'

import CubeView from './CubeView'

import TextureManager from './managers/TextureManager'
import LoadManager from './managers/LoadManager'
import AllocationManager from './managers/AllocationManager'

import {
  setDebugMode,
} from './store/actions'

import {
  getAllUsedCharactersString,
  extractViewFromURL,
  dispatchEvent,
} from './helpers'

import {
  ENTRY_TYPE_IMAGE,
  RESOURCE_IMAGE,
  RESOURCE_FONT,
  FONT_NAME,
  MAX_VIEWPORT_WIDTH,

  EVT_LOADED_TEXTURES,
  EVT_TRANSITIONING,
  EVT_TRANSITIONING_START,
  EVT_TRANSITIONING_END,
  EVT_ADD_TO_LOAD_QUEUE,
  EVT_ALLOCATE_TEXTURE,
} from './constants'

const queryParams = new URLSearchParams(window.location.search)
const isDebugMode = queryParams.has('debugMode')

const domContainer = document.getElementById('app-container')
const domLoadIndicator = document.getElementById('load-indicator')
const mouse = new THREE.Vector2(-100, -100)
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(45, viewportWidth / viewportHeight, 0.1, 50)
const renderer = new THREE.WebGLRenderer({
  // antialias: true
})
const raycaster = new THREE.Raycaster()
const clock = new THREE.Clock()
const container = new THREE.Object3D()
const cameraLookAt = new THREE.Vector3()
const cameraPosTarget = new THREE.Vector3()

const maxTextureSize = Math.min(4096, renderer.capabilities.maxTextureSize)
// const maxTextureSize = 1024

const texManager = new TextureManager({ size: maxTextureSize })
const loadManager = new LoadManager()

new AllocationManager()

let ambientLight
let viewportWidth
let viewportHeight
let dpr = window.devicePixelRatio
let loadProgress = 0

// store.dispatch(setDebugMode(isDebugMode))

dispatchEvent(EVT_ADD_TO_LOAD_QUEUE, {
  type: RESOURCE_FONT,
  fontName: `${FONT_NAME}:400:latin`,
  // Load only font chars we actually use
  text: getAllUsedCharactersString()
})

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
  textureManager: texManager,
})

let viewB = new CubeView({
  radius: 20,
  textureManager: texManager,
})

document.addEventListener('DOMContentLoaded', init)

function init () {
  Promise.all([
    viewA.init(),
    viewB.init(),
    loadManager.loadResources(),
    makeAmbientLight(),
    makePointLight(),
    allocateProjectImages()
  ]).then((result) => {
    const viewAMesh = result[0]
    const viewBMesh = result[1]
    const allLoadResources = result[2]
    const ambientLight = result[3]
    const pointLight = result[4]

    container.add(viewAMesh)
    container.add(viewBMesh)

    scene.add(ambientLight)
    scene.add(pointLight)

    onLoadResources(allLoadResources)
  })
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
  const imageEntries = allResources.filter((resource) => resource && resource.type === ENTRY_TYPE_IMAGE)
  imageEntries.forEach(image => texManager.addAtlasEntry(image, image.src))

  dispatchEvent(EVT_LOADED_TEXTURES, { imageEntries })

  viewA.interactable = true
  viewA.visible = true

  const viewName = extractViewFromURL()
  viewA.drawScreen(viewName, screens[viewName])
}

function onResize () {
  dpr = window.devicePixelRatio
  if (window.innerWidth > MAX_VIEWPORT_WIDTH) {
    const widthDelta = (MAX_VIEWPORT_WIDTH / window.innerWidth)
    viewportWidth = window.innerWidth * widthDelta
    viewportHeight = window.innerHeight * widthDelta
    if (dpr >= 2) {
      dpr = 1.5
    }
  } else {
    viewportWidth = window.innerWidth
    viewportHeight = window.innerHeight
  }
  
  camera.aspect = viewportWidth / viewportHeight
  camera.updateProjectionMatrix()
  renderer.setPixelRatio(dpr)
  renderer.setSize(viewportWidth, viewportHeight, false)
}

function onMouseClick (e) {
  const { hoverEntryName } = store.getState()
  if (!hoverEntryName) {
    return
  }
  e.preventDefault()

  if (hoverEntryName.linksTo.includes('mailto')) {
    window.open(hoverEntryName.linksTo)
    return
  } else if (hoverEntryName.linksTo.includes('http')) {
    window.open(hoverEntryName.linksTo, '_blank')
    return
  }

  document.title = `${hoverEntryName.linksTo.substring(0, 1)}${hoverEntryName.linksTo.substring(1).toLowerCase()} - Georgi Nikolov`
  
  const pathname = screens[hoverEntryName.linksTo].url
  const queryParams = new URLSearchParams(window.location.search)
  window.history.pushState({}, pathname, `${window.location.origin}${pathname}?${queryParams.toString()}`)
  onNavigation(hoverEntryName.linksTo, screens[hoverEntryName.linksTo])
}

let angle = 0

let y = 0
function onNavigation (to) {
  // console.log(to)
  viewB.drawScreen(to, screens[to])

  let hasSwitchedSides = false

  const direction = Math.floor(Math.random() * 2)

  // const direction = 2

  if (direction === 0) {
    y = 1
    angle += Math.PI / 2
  } else if (direction === 1) {
    y = -1
    angle += Math.PI / 2
  }
  
  const currentQuaternion = container.quaternion.clone()
  const targetQuaternion = container.quaternion.clone().setFromAxisAngle(new THREE.Vector3(0, y, 0), angle)
  

  // if (direction === 0) {
  //   newRotation.y -= Math.PI / 2
  // } else if (direction === 1) {
  //   newRotation.y += Math.PI / 2
  // } else if (direction === 2) {
  //   newRotation.x += Math.PI / 2
  // } else if (direction === 3) {
  //   newRotation.x -= Math.PI / 2
  // }


  // const newRotation = new THREE.Vector3(
  //   oldRotation.x === Math.PI * 0.5 ? 0 : Math.PI * 0.5,
  //   oldRotation.y === Math.PI * 0.5 ? 0 : Math.PI * 0.5,
  //   0
  // )

  viewA.interactable = false

  dispatchEvent(EVT_TRANSITIONING_START, { direction })
  viewB.visible = true
  viewB.interactable = true
  
//   viewA.visible = false
//   viewA.interactable = false
//   viewA.rotation.x = Math.PI
// return
  popmotion.animate({
    duration: 1000,
    ease: popmotion.easeOut,
    onUpdate: v => {
      dispatchEvent(EVT_TRANSITIONING, { v })
      currentQuaternion.slerp(targetQuaternion, v)
      // container.setRotationFromQuaternion(currentQuaternion)
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
      dispatchEvent(EVT_TRANSITIONING_END)
    }
  })
  
}

function onMouseMove (e) {
  e.preventDefault()
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1
  mouse.y = - (e.clientY / window.innerHeight) * 2 + 1

  cameraPosTarget.x = mouse.x * 5
  cameraPosTarget.y = mouse.y * 5
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

function makeAmbientLight () {
  return AllocationManager
    .getInstance()
    .allocate(() => {
      ambientLight = new THREE.AmbientLight(0xFFFFFF)
      return ambientLight
    })
}

function makePointLight () {
  return AllocationManager
    .getInstance()
    .allocate(() => {
      const pointLight = new THREE.PointLight(0xffffff, 1)
      pointLight.position.set(Math.random() > 0.5 ? 10 : -10, 80, 60)
      pointLight.castShadow = true
      pointLight.shadow.mapSize.width = maxTextureSize / 2
      pointLight.shadow.mapSize.height = maxTextureSize / 2
      return pointLight
    })
}

function allocateProjectImages () {
  return Object.values(screens).map((value) => {
    return Object.values(value.entries).filter(entry => entry.type === RESOURCE_IMAGE).map(entry => {
      const { src } = entry
      dispatchEvent(EVT_ADD_TO_LOAD_QUEUE, { type: ENTRY_TYPE_IMAGE, src })
      return AllocationManager
        .getInstance()
        .allocate(() => {
          dispatchEvent(EVT_ALLOCATE_TEXTURE, { textureId: src, size: 512 })
        })
    })
  }).flat()
}
