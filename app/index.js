import * as THREE from 'three'
import OrbitControlsA from 'three-orbit-controls'

import screens from './screens.json'

const OrbitControls = OrbitControlsA(THREE)

import ExtendMaterial from './ExtendMaterial'
import TextureManager from './TextureManager'
import CubeView from './CubeView'

import {
  VIEW_HOME
} from './constants'

ExtendMaterial(THREE)

const dpr = window.devicePixelRatio

let viewportWidth = window.innerWidth
let viewportHeight = window.innerHeight

let activeView1 = VIEW_HOME
let activeView2 = null

const mouse = new THREE.Vector2(-100, -100)
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(45, viewportWidth / viewportHeight, 0.1, 1000)
const renderer = new THREE.WebGLRenderer({ antialias: true })
const raycaster = new THREE.Raycaster()

const texManager = new TextureManager({
  size: Math.min(4096, renderer.capabilities.maxTextureSize)
})

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

const view1 = new CubeView({
  radius: 20,
  lightPosition: new THREE.Vector3(700, 700, 700),
  textureManager: texManager
})

view1.drawScreen(screens['works'])

scene.add(view1.mesh)

new OrbitControls(camera)
document.body.addEventListener('mousemove', onMouseMove)
updateFrame()

function onMouseMove (e) {
  e.preventDefault()
  mouse.x = (e.clientX / viewportWidth) * 2 - 1
  mouse.y = - (e.clientY / viewportHeight) * 2 + 1
}

function getScreenData () {
  Object.entries(screens).map(keyValue => {
    const key = keyValue[0]
    const { x, y } = keyValue[1]
    const startIdx = x + totalWidth * (totalHeight - y)
    for (let i = startIdx, n = 0; i < startIdx + key.length; i++) {
      const texCoords = texManager.getEntryTexCoordinate(key[n])
      mesh.geometry.attributes.letterOffset.array[i * 2] = texCoords[0]
      mesh.geometry.attributes.letterOffset.array[i * 2 + 1] = texCoords[1]
      n++
    }
  })
  for (let i = 0; i < numBoxes; i++) {
    const xIdx = i % totalWidth
    const yIdx = (i - xIdx) / totalHeight
    if (xIdx === 0 || xIdx === totalWidth - 1 || yIdx === 0 || yIdx === totalHeight - 1) {
      const texCoords = texManager.getEntryTexCoordinate('DECORATION')
      mesh.geometry.attributes.letterOffset.array[i * 2] = texCoords[0]
      mesh.geometry.attributes.letterOffset.array[i * 2 + 1] = texCoords[1]
    }
  }
  // for (let i = 0; i < numBoxes; i += totalWidth) {
  //   const texCoords = texManager.getEntryTexCoordinate('DECORATION')
  //   mesh.geometry.attributes.letterOffset.array[i * 2] = texCoords[0]
  //   mesh.geometry.attributes.letterOffset.array[i * 2 + 1] = texCoords[1]
  // }
}

function updateFrame (ts = 0) {
  renderer.clearColor()

  

  view1.onUpdateFrame({
    raycaster,
    mouse,
    camera
  })

  renderer.render( scene, camera );

  requestAnimationFrame(updateFrame)
}
