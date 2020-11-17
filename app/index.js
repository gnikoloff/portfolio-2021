import * as THREE from 'three'
import OrbitControlsA from 'three-orbit-controls'
const OrbitControls = OrbitControlsA(THREE)

import ExtendMaterial from './ExtendMaterial'
import TextureManager from './TextureManager'

ExtendMaterial(THREE)

const dpr = window.devicePixelRatio

let viewportWidth = window.innerWidth
let viewportHeight = window.innerHeight

const mouse = new THREE.Vector2()
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(45, viewportWidth / viewportHeight, 0.1, 1000)
const renderer = new THREE.WebGLRenderer()
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

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
alphabet.split('').map(char => {
  texManager.addAtlasEntry(char.toUpperCase())
  texManager.addAtlasEntry(char.toLowerCase())
})

const mat = THREE.extendMaterial(THREE.MeshPhongMaterial, {
  uniforms: {
    letterTexture: { value: texManager.texture },
  },
  header: `
    varying vec2 v_letterOffset;
    varying vec2 vUv;
  `,
  vertexHeader: `
    attribute float scale;
    attribute vec2 letterOffset;

    uniform mat3 uvTransform;
  `,
  fragmentHeader: `
    uniform sampler2D letterTexture;
  `,
  vertex: {
    'project_vertex': {
      '@vec4 mvPosition = vec4( transformed, 1.0 );': `
        vec4 mvPosition = vec4(1.0, 1.0, scale, 1.0) * vec4(transformed, 1.0);
      `,
    },
    '@#include <uv_vertex>': `
      vUv = (uvTransform * vec3(uv, 1)).xy;
      v_letterOffset = letterOffset;
    `
  },
  fragment: {
    '@#include <map_fragment>': `
      diffuseColor *= texture(letterTexture, vUv * vec2(1.0 / 10.0, 1.0 / 10.0) + v_letterOffset);
    `
  },
})

console.log(mat)

var light = new THREE.DirectionalLight( 0xffffff );
light.position.set(0, 10, 10)
light.castShadow = true
light.shadow.camera.zoom = 2
scene.add(light);

const numBoxes = totalWidth * totalHeight

const box = new THREE.BoxBufferGeometry(1, 1, totalDepth)
box.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0, totalDepth / 2))
// box.maxInstancedCount = numBoxes

const scales = new Float32Array(numBoxes)
const letterOffsets = new Float32Array(numBoxes * 2)
for (let i = 0; i < numBoxes; i++) {
  scales[i] = 1//Math.random()
  // const size = 1 / 10
  const size = 1 / 10
  letterOffsets[i * 2 + 0] = Math.round(i % 10 / 10 / size) * size
  letterOffsets[i * 2 + 1] = Math.round(i % 10 / 10 / size) * size
}

box.setAttribute('scale', new THREE.InstancedBufferAttribute(scales, 1))
box.setAttribute('letterOffset', new THREE.InstancedBufferAttribute(letterOffsets, 2))

const baseMaterial = THREE.extendMaterial(THREE.MeshPhongMaterial, {
  vertexHeader: `
    attribute float scale;
  `,
  vertex: {
    'project_vertex': {
      '@vec4 mvPosition = vec4( transformed, 1.0 );': `
        vec4 mvPosition = vec4(1.0, 1.0, scale, 1.0) * vec4(transformed, 1.0);
      `,
    },
  },
})

const materials = [
  baseMaterial,
  baseMaterial,
  baseMaterial,
  baseMaterial,
  mat,
  baseMaterial,
]
const mesh = new THREE.InstancedMesh(box, materials, numBoxes)
mesh.castShadow = true
mesh.receiveShadow = true

const matrix = new THREE.Matrix4()
for (let i = 0; i < numBoxes; i++) {
  const xIdx = i % totalWidth
  const yIdx = (i - xIdx) / totalHeight
  const x = xIdx - totalWidth / 2
  const y = yIdx - totalHeight / 2
  matrix.setPosition(x, y, 0)
  mesh.setMatrixAt(i, matrix)
}
scene.add(mesh)

new OrbitControls(camera)
document.body.addEventListener('mousemove', onMouseMove)
updateFrame()

function onMouseMove (e) {
  e.preventDefault()
  mouse.x = (e.clientX / viewportWidth) * 2 - 1
  mouse.y = - (e.clientY / viewportHeight) * 2 + 1
}

function updateFrame (ts = 0) {
  renderer.clearColor()

  raycaster.setFromCamera(mouse, camera)

  const intersection = raycaster.intersectObject(mesh)

  let instanceId

  const size = 1 / 10
  if (intersection.length > 0) {
    instanceId = intersection[0] && intersection[0].instanceId
    for (let i = 0; i < numBoxes; i++) {
      if (i === instanceId) {
        intersection[0].object.geometry.attributes.letterOffset.array[i * 2] = Math.round(i % 10 / 10 / size) * size
      } else {
        // mesh.geometry.attributes.letterOffset.array[i] = Math.round(i % 10 / 10 / size) * size
      }
    }
  } else {
    for (let i = 0; i < numBoxes; i++) {
      let texCoordsForB
      if (i % 2 === 0) {
        texCoordsForB = texManager.getEntryTexCoordinate('b')
      } else {
        texCoordsForB = texManager.getEntryTexCoordinate('B')
      }
      mesh.geometry.attributes.letterOffset.array[i * 2] = texCoordsForB[0]
      mesh.geometry.attributes.letterOffset.array[i * 2 + 1] = texCoordsForB[1]
    }
  }

  mesh.geometry.attributes.letterOffset.needsUpdate = true

  renderer.render( scene, camera );

  requestAnimationFrame(updateFrame)
}
