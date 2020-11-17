import * as THREE from 'three'
import OrbitControlsA from 'three-orbit-controls'
const OrbitControls = OrbitControlsA(THREE)

import ExtendMaterial from './ExtendMaterial'

ExtendMaterial(THREE)

const dpr = window.devicePixelRatio

let viewportWidth = window.innerWidth
let viewportHeight = window.innerHeight

const mouse = new THREE.Vector2()
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(45, viewportWidth / viewportHeight, 0.1, 1000)
const renderer = new THREE.WebGLRenderer()
const raycaster = new THREE.Raycaster()

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

console.log(THREE.ShaderChunk)

const texCanvas = document.createElement('canvas')
const texCtx = texCanvas.getContext('2d')
texCanvas.width = Math.min(4096, renderer.capabilities.maxTextureSize)
texCanvas.height = texCanvas.width / 16
texCanvas.style.position = 'fixed'
texCanvas.style.top = texCanvas.style.left = '24px'
texCanvas.style.transform = 'scale(0.5)'
texCanvas.style.transformOrigin = '0 0'
document.body.appendChild(texCanvas)

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
texCtx.fillStyle = 'red'
texCtx.fillRect(0, 0, texCanvas.width, texCanvas.height)
texCtx.fillStyle = 'black'
texCtx.font = `${texCanvas.width / texCanvas.height * 8}px monospace`
texCtx.textAlign = 'center'
const size = texCanvas.width / alphabet.length
const scale = texCanvas.height / size
alphabet.split('').map((char, i) => {
  texCtx.save()
  texCtx.translate(i * size + size / 2, texCanvas.height / 2 + texCanvas.width / texCanvas.height * 2)
  texCtx.scale(1, scale)
  texCtx.fillText(char.toLowerCase(), 0, 0)
  texCtx.restore()
  // texCtx.strokeRect(size * i, 0, size * i + size, texCanvas.height)
})


const tex = new THREE.CanvasTexture(texCanvas)

const mat = THREE.extendMaterial(THREE.MeshPhongMaterial, {
  uniforms: {
    letterTexture: { value: tex },
  },
  header: `
    varying float v_letterOffsetX;
    varying vec2 vUv;
  `,
  vertexHeader: `
    attribute float scale;
    attribute float letterOffsetX;

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
      v_letterOffsetX = letterOffsetX;
    `
  },
  fragment: {
    '@#include <map_fragment>': `
      vec4 texelColor = vec4(vUv, 0.0, 1.0);
      diffuseColor *= texture(letterTexture, vUv * vec2(1.0 / 26.0, 1.0) + vec2(v_letterOffsetX, 0.0));
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
const letterOffsets = new Float32Array(numBoxes)
for (let i = 0; i < numBoxes; i++) {
  scales[i] = 1//Math.random()
  const size = 1 / alphabet.length
  letterOffsets[i] = Math.round(i % alphabet.length / alphabet.length / size) * size
}

box.setAttribute('scale', new THREE.InstancedBufferAttribute(scales, 1))
box.setAttribute('letterOffsetX', new THREE.InstancedBufferAttribute(letterOffsets, 1))

const baseMaterial = THREE.extendMaterial(THREE.MeshPhongMaterial, {
  uniforms: {
    letterTexture: { value: tex },
  },
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

  const size = 1 / alphabet.length
  if (intersection.length > 0) {
    instanceId = intersection[0] && intersection[0].instanceId
    for (let i = 0; i < numBoxes; i++) {
      if (i === instanceId) {
        intersection[0].object.geometry.attributes.letterOffsetX.array[instanceId] = Math.round(Math.random() / size) * size
      } else {
        mesh.geometry.attributes.letterOffsetX.array[i] = Math.round(i % alphabet.length / alphabet.length / size) * size
      }
    }
  } else {
    for (let i = 0; i < numBoxes; i++) {
      mesh.geometry.attributes.letterOffsetX.array[i] = Math.round(i % alphabet.length / alphabet.length / size) * size
    }
  }

  mesh.geometry.attributes.letterOffsetX.needsUpdate = true

  renderer.render( scene, camera );

  requestAnimationFrame(updateFrame)
}
