import * as THREE from 'three'

import store from '../store'

import {
  ENTRY_TYPE_IMAGE,
  ENTRY_TYPE_INDIVIDUAL_CHAR,
  ENTRY_TYPE_WORD_LINE,
  ENTRY_TYPE_SYMBOL_DOT,
  ENTRY_TYPE_SYMBOL_CROSS,
  FONT_NAME,
  TEXTURE_LABEL_ATLAS,
  ENTRY_TYPE_SYMBOL_SQUARE,
  EVT_ALLOCATE_TEXTURE,
} from '../constants'

import styles from '../label-styles.json'

const IDEAL_TEXTURE_SIZE = 4096

const DRAW_COLOR = 'green'

const styleMap = new Map(Object.entries(styles))

export default class TextureManager {
  constructor ({ size }) {
    this._textureSet = new Map()
    this._size = size

    this._domDebugContainer = document.getElementById('texture-manager-wrapper')

    const { canvas, ctx } = this._makeCanvas(TEXTURE_LABEL_ATLAS, size)
    const entriesPerRow = 60
    const cellWidth = size / entriesPerRow

    for (let i = 0; i < entriesPerRow * entriesPerRow; i++) {
      const xIdx = i % entriesPerRow
      const yIdx = (i - xIdx) / entriesPerRow
      const drawX = xIdx * cellWidth
      const drawY = yIdx * cellWidth
      ctx.strokeStyle = DRAW_COLOR
      ctx.lineWidth = 20
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
      // ctx.font = '60px Arial'
      // ctx.fillText(i, drawX + 5, drawY + cellWidth / 2)
      // ctx.strokeRect(drawX, drawY, cellWidth, cellWidth)
    }

    this._textureSet.set(TEXTURE_LABEL_ATLAS, {
      size,
      entriesPerRow,
      cellWidth,
      atlasIdxX: 0,
      atlasIdxY: 0,
      texture: new THREE.CanvasTexture(canvas),
      canvas,
      ctx,
      atlas: new Map(),
      textureUniformIdx: this._textureSet.size
    })

    // this.addAtlasEntry({ type: ENTRY_TYPE_SYMBOL_DOT }, TEXTURE_LABEL_ATLAS)
    // this.addAtlasEntry({ type: 'CROSS' }, TEXTURE_LABEL_ATLAS)

    const { isDebugMode } = store.getState()
    if (isDebugMode) {
      this._domDebugContainer.style.display = 'block'
    }
    this._domDebugContainer.style.display = 'block'

    document.addEventListener(EVT_ALLOCATE_TEXTURE, this.allocateTexture.bind(this))

  }
  _drawImage (entry, textureId) {
    const { canvas, ctx, entriesPerRow, atlas, cellWidth } = this._textureSet.get(textureId)

    const texCoords = []

    const imageCellsHeight = 20

    for (let i = 0; i < entriesPerRow * imageCellsHeight; i++) {
      const xIdx = i % entriesPerRow
      const yIdx = (i - xIdx) / entriesPerRow
      const texAtlasX = xIdx / entriesPerRow
      const texAtlasY = yIdx / entriesPerRow
      texCoords.push([texAtlasX, texAtlasY])
    }

    ctx.save()
    // ctx.drawImage(image, 0, 0, size, size, 0, 0, canvas.width, canvas.height * 0.8)
    ctx.drawImage(entry.value, 0, cellWidth * 2, canvas.width, entry.value.naturalHeight)

    atlas.set(entry.src, texCoords)

    ctx.restore()

    return texCoords
  }
  _drawChar (entry, textureId) {
    const textureData = this._textureSet.get(textureId)
    const {
      ctx,
      atlas,
      cellWidth,
      entriesPerRow,
      size
    } = textureData

    let {
      atlasIdxX,
      atlasIdxY
    } = textureData

    const texWidthDelta = size / IDEAL_TEXTURE_SIZE

    const style = Object.assign({}, entry, styleMap.get(entry.styleID))

    const fontSize = (style.fontSize || 100) * texWidthDelta

    const drawX = atlasIdxX * cellWidth
    const drawY = atlasIdxY * cellWidth
    ctx.save()
    // ctx.fillStyle = DRAW_COLOR
    ctx.font = `${fontSize}px ${FONT_NAME}`
    ctx.textAlign = 'center'
    const textMetrics = ctx.measureText(entry.value)
    ctx.translate(drawX + cellWidth / 2, drawY + cellWidth / 2 + textMetrics.actualBoundingBoxAscent / 2)
    ctx.fillText(entry.value, 0, 0)
    ctx.restore()
    const texAtlasX = atlasIdxX / entriesPerRow
    const texAtlasY = 1.0 - (atlasIdxY + 1) / entriesPerRow

    const texAtlasCoords = [texAtlasX, texAtlasY]
    
    atlas.set(entry.value, texAtlasCoords)

    atlasIdxX++

    if (atlasIdxX >= entriesPerRow) {
      atlasIdxX = 0
      atlasIdxY++
    }

    this._textureSet.set(textureId, {
      ...textureData,
      atlasIdxX,
      atlasIdxY
    })

    return texAtlasCoords
  }
  _drawWordLine (entry, textureId) {
    const textureData = this._textureSet.get(textureId)
    const {
      ctx,
      atlas,
      cellWidth,
      entriesPerRow,
      size
    } = textureData

    let {
      atlasIdxX,
      atlasIdxY,
    } = textureData
    
    const texWidthDelta = size / IDEAL_TEXTURE_SIZE
    
    const style = Object.assign({}, entry, styleMap.get(entry.styleID))
    
    const fontSize = (style.fontSize || 120) * texWidthDelta

    ctx.save()
    ctx.fillStyle = DRAW_COLOR
    ctx.font = `${fontSize}px ${FONT_NAME}`

    const textMetrics = ctx.measureText(entry.value)

    const { textureXOffset = 0 } = entry
    // const cellsOccupied = Math.round(textMetrics.width / cellWidth) + Math.ceil(cellWidth * textureXOffset / size)

    const cellsOccupied = Math.ceil(textMetrics.width / cellWidth)

    if (atlasIdxX + cellsOccupied > entriesPerRow) {
      atlasIdxX = 0
      atlasIdxY++
    }

    const drawX = atlasIdxX * cellWidth
    const drawY = atlasIdxY * cellWidth

    ctx.strokeStyle = DRAW_COLOR
    ctx.lineWidth = 10

    const texAtlasesForLine = []
    
    for (let i = atlasIdxX; i < atlasIdxX + cellsOccupied; i++) {
      const texAtlasX = i / entriesPerRow
      const texAtlasY = 1.0 - (atlasIdxY + 1) / entriesPerRow
      texAtlasesForLine.push([texAtlasX, texAtlasY])
      // ctx.strokeRect(x, drawY, cellWidth, cellWidth)
    }
    atlasIdxX += cellsOccupied

    ctx.translate(drawX + cellWidth * textureXOffset, drawY + cellWidth / 2 + textMetrics.actualBoundingBoxAscent / 2)
    
    ctx.fillText(entry.value, 0, 0)
    ctx.restore()

    atlas.set(entry.value, texAtlasesForLine)

    this._textureSet.set(textureId, {
      ...textureData,
      atlasIdxX,
      atlasIdxY
    })

    return texAtlasesForLine
  }
  _drawDecoration (entry, textureId) {
    const textureData = this._textureSet.get(textureId)
    const {
      ctx,
      atlas,
      cellWidth,
      entriesPerRow,
      size
    } = textureData

    let {
      atlasIdxX,
      atlasIdxY,
    } = textureData

    const drawX = atlasIdxX * cellWidth
    const drawY = atlasIdxY * cellWidth
    ctx.save()
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
    ctx.translate(drawX + cellWidth / 2, drawY + cellWidth / 2)
    const texWidthDelta = size / IDEAL_TEXTURE_SIZE
    if (entry.type === ENTRY_TYPE_SYMBOL_DOT) {
      const idealRadius = 32 / 3
      ctx.beginPath()
      ctx.arc(0, 0, idealRadius * texWidthDelta, 0, Math.PI * 2, false)
      ctx.closePath()
      ctx.fill()
    } else if (entry.type === ENTRY_TYPE_SYMBOL_CROSS) {
      const idealRadius = 50 / 3
      const idealLineWidth = 30 / 3
      const radius = idealRadius * texWidthDelta
      const lineWidth = idealLineWidth * texWidthDelta
      ctx.lineWidth = lineWidth
      ctx.beginPath()
      ctx.moveTo(-radius, -radius)
      ctx.lineTo(radius, radius)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(radius, -radius)
      ctx.lineTo(-radius, radius)
      ctx.stroke()
    } else if (entry.type === ENTRY_TYPE_SYMBOL_SQUARE) {
      const idealRadius = 100 / 3
      const radius = idealRadius * texWidthDelta
      ctx.strokeRect(-radius / 2, -radius / 2, radius / 2, radius / 2)
    }
    ctx.restore()
    const texAtlasX = atlasIdxX / entriesPerRow
    const texAtlasY = 1.0 - (atlasIdxY + 1) / entriesPerRow

    const texAtlasCoords = [texAtlasX, texAtlasY]
    
    atlas.set(entry.type, texAtlasCoords)

    atlasIdxX++

    console.log('atlasIdxX', atlasIdxX)

    if (atlasIdxX >= entriesPerRow) {
      atlasIdxX = 0
      atlasIdxY++
    }

    this._textureSet.set(textureId, {
      ...textureData,
      atlasIdxX,
      atlasIdxY
    })

    return texAtlasCoords
  }
  addAtlasEntry (entry, textureId) {
    const { atlas, texture } = this._textureSet.get(textureId)
    let texAtlasCoords = atlas.get(entry.value)
    if (texAtlasCoords) {
      return texAtlasCoords
    }
    if (entry.type === ENTRY_TYPE_IMAGE) {
      texAtlasCoords = this._drawImage(entry, textureId)
    } else if (entry.type === ENTRY_TYPE_INDIVIDUAL_CHAR || entry === ' ') {
      texAtlasCoords = this._drawChar(entry, textureId)
    } else if (entry.type === ENTRY_TYPE_WORD_LINE) {
      texAtlasCoords = this._drawWordLine(entry, textureId)
    } else {
      texAtlasCoords = this._drawDecoration(entry, textureId)
    }
    // console.log('%c mark texture as needs update', 'background: yellow;color:black;')
    texture.needsUpdate = true
    return texAtlasCoords
  }
  _makeCanvas (textureId, size) {
    console.log(textureId)
    const { isDebugMode } = store.getState()
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    canvas.dataset.textureId = textureId
    canvas.width = canvas.height = size == null ? this._size : size
    if (isDebugMode) {
      this._domDebugContainer.appendChild(canvas)
    }
    if (textureId === TEXTURE_LABEL_ATLAS) {
      // this._domDebugContainer.appendChild(canvas)
    }
    this._domDebugContainer.appendChild(canvas)
    return { canvas, ctx }
  }
  getTexture (textureName) {
    const textureData = this._textureSet.get(textureName)
    if (!textureData) {
      throw new Error('Texture data not found')
    }
    return textureData
  }
  allocateTexture ({ detail: { textureId, size } }) {
    const { canvas, ctx } = this._makeCanvas(textureId, size)
    const textureUniformIdx = this._textureSet.size

    const entriesPerRow = 60
    const cellWidth = size / entriesPerRow

    const texture = new THREE.CanvasTexture(canvas)

    this._textureSet.set(textureId, {
      size,
      entriesPerRow,
      cellWidth,
      atlasIdxX: 0,
      atlasIdxY: 0,
      texture,
      canvas,
      ctx,
      atlas: new Map(),
      textureUniformIdx
    })

    console.log('allocated new texture with id', textureId)
  }
  getEntryTexCoordinate (entry, textureId = TEXTURE_LABEL_ATLAS) {
    // console.log(entry.value)
    const textureData = this._textureSet.get(textureId)

    let textureUniformIdx
    let atlas
    let texCoordinates

    if (textureData) {
      textureUniformIdx = textureData.textureUniformIdx
      atlas = textureData.atlas
      texCoordinates = atlas.get(entry.value || entry.type)
    } else {
      // throw new Error('Texture data not found for this ID')
    }
    
    if (!texCoordinates) {
      texCoordinates = this.addAtlasEntry(entry, textureId)
    }

    return {
      texCoordinates,
      textureUniformIdx
    }
  }
}
