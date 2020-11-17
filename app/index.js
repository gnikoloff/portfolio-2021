import * as THREE from 'three'
import OrbitControlsA from 'three-orbit-controls'

import screens from './screens.json'

const OrbitControls = OrbitControlsA(THREE)

import ExtendMaterial from './ExtendMaterial'
import TextureManager from './TextureManager'

ExtendMaterial(THREE)

const dpr = window.devicePixelRatio

let viewportWidth = window.innerWidth
let viewportHeight = window.innerHeight

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

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
alphabet.split('').map(char => {
  texManager.addAtlasEntry({ value: char.toUpperCase(), type: 'CHAR' })
  texManager.addAtlasEntry({ value: char.toLowerCase(), type: 'CHAR' })
})
texManager.addAtlasEntry({ type: 'DECORATION' })

// new THREE.TextureLoader().load('/assets/displacementmap2.jpg', tex => {
//   mat.uniforms.bumpMap.value = tex
//   baseMaterial.uniforms.bumpMap.value = tex
// })

const mat = THREE.extendMaterial(THREE.MeshPhongMaterial, {
  uniforms: {
    letterTexture: { value: texManager.texture },
    bumpMap: { texture: null }
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

const light = new THREE.PointLight( 0xaaaaaa, 1, 100 );
// light.intensity = 0.7
light.position.set(30, 10, 50 );
scene.add( light );

const numBoxes = totalWidth * totalHeight

const box = new THREE.BoxBufferGeometry(1, 1, totalDepth)
box.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0, totalDepth / 2))
// box.maxInstancedCount = numBoxes

const scales = new Float32Array(numBoxes)
const letterOffsets = new Float32Array(numBoxes * 2)
for (let i = 0; i < numBoxes; i++) {
  scales[i] = 1
  scales[i] = 1 + Math.random() * 0.05
}

box.setAttribute('scale', new THREE.InstancedBufferAttribute(scales, 1))
box.setAttribute('letterOffset', new THREE.InstancedBufferAttribute(letterOffsets, 2))

const baseMaterial = THREE.extendMaterial(THREE.MeshPhongMaterial, {
  uniforms: {
    bumpMap: { texture: null }
  },
  header: `
    varying vec2 vUv;
  `,
  vertexHeader: `
    attribute float scale;
    uniform mat3 uvTransform;
  `,
  vertex: {
    'project_vertex': {
      '@vec4 mvPosition = vec4( transformed, 1.0 );': `
        vec4 mvPosition = vec4(1.0, 1.0, scale, 1.0) * vec4(transformed, 1.0);
      `,
    },
    '@#include <uv_vertex>': `
      vUv = (uvTransform * vec3(uv, 1)).xy;
    `
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
mesh.position.set(0, 0, -totalDepth / 2)
mesh.castShadow = true
mesh.receiveShadow = true

getScreenData()

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

  raycaster.setFromCamera(mouse, camera)

  const intersection = raycaster.intersectObject(mesh)

  let instanceId

  if (intersection.length > 0) {
    instanceId = intersection[0] && intersection[0].instanceId
    Object.entries(screens).map(keyValue => {
      const key = keyValue[0]
      const { x, y } = keyValue[1]
      const startIdx = x + totalWidth * (totalHeight - y)

      if (instanceId >= startIdx && instanceId < startIdx + key.length) {
        document.body.classList.add('hovering')
        for (let n = startIdx; n < startIdx + key.length; n++) {
          mesh.geometry.attributes.scale.array[n] = 1.2
        }
      } else {
        document.body.classList.remove('hovering')
        for (let i = 0; i < numBoxes; i++) {
          // mesh.geometry.attributes.scale.array[i] = 1
        }
      }
    })
  } else {
    for (let i = 0; i < numBoxes; i++) {
      // getScreenData()
      // mesh.geometry.attributes.scale.array[i] = 1
    }
    
  }

  mesh.geometry.attributes.scale.needsUpdate = true
  mesh.geometry.attributes.letterOffset.needsUpdate = true

  renderer.render( scene, camera );

  requestAnimationFrame(updateFrame)
}
