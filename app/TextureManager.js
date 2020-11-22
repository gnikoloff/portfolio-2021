import * as THREE from 'three'

import {
  ENTRY_TYPE_IMAGE,
  ENTRY_TYPE_INDIVIDUAL_CHAR,
  ENTRY_TYPE_WORD_LINE,
  ENTRY_TYPE_SYMBOL_DOT,
  DECORATION_TYPE_BORDER,
} from './constants'

let instance

const IDEAL_TEXTURE_SIZE = 4096

export default class TextureManager {
  static init ({ size }) {
    if (!instance) {
      instance = new TextureManager(size)
    }
    return instance
  }
  static getInstance () {
    return instance
  }
  constructor (size) {
    this._textureSet = new Map()
    this._size = size

    this._domDebugContainer = document.getElementById('texture-manager-wrapper')

    const { canvas, ctx } = this._makeCanvas('characters', size)
    const entriesPerRow = 20
    const cellWidth = size / entriesPerRow

    for (let i = 0; i < entriesPerRow * entriesPerRow; i++) {
      const xIdx = i % entriesPerRow
      const yIdx = (i - xIdx) / entriesPerRow
      const drawX = xIdx * cellWidth
      const drawY = yIdx * cellWidth
      ctx.strokeStyle = 'red'
      ctx.lineWidth = 20
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
      // ctx.font = '60px Arial'
      // ctx.fillText(i, drawX + 5, drawY + cellWidth / 2)
      // ctx.strokeRect(drawX, drawY, cellWidth, cellWidth)
    }

    this._textureSet.set('characters', {
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

  }
  get entriesPerRow () {
    return entriesPerRow
  }
  _drawImage (entry, textureId) {
    const { canvas, ctx, entriesPerRow, size, atlas, texture, cellWidth } = this._textureSet.get(textureId)
    const imageSource = entry.value
    const texCoords = []

    const imageCellsHeight = 20

    for (let i = 0; i < entriesPerRow * imageCellsHeight; i++) {
      const xIdx = i % entriesPerRow
      const yIdx = (i - xIdx) / entriesPerRow
      const texAtlasX = xIdx / entriesPerRow
      const texAtlasY = yIdx / entriesPerRow
      texCoords.push([texAtlasX, texAtlasY])
    }

    const {
      x, y
    } = entry

    const image = new Image()
    image.onload = () => {
      ctx.save()
      // ctx.drawImage(image, 0, 0, size, size, 0, 0, canvas.width, canvas.height * 0.8)
      ctx.drawImage(image, 0, cellWidth * 2)

      atlas.set(entry.value, texCoords)
      // debugger

      ctx.restore()
      texture.needsUpdate = true
    }
    image.src = imageSource

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
      atlasIdxY,
    } = textureData

    const texWidthDelta = size / IDEAL_TEXTURE_SIZE
    const fontSize = (entry.fontSize || 200) * texWidthDelta

    const drawX = atlasIdxX * cellWidth
    const drawY = atlasIdxY * cellWidth
    ctx.save()
    ctx.fillStyle = 'black'
    ctx.font = `${fontSize}px monospace`
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
    const fontSize = entry.fontSize * texWidthDelta

    ctx.save()
    ctx.fillStyle = 'black'
    ctx.font = `${fontSize}px monospace`

    const textMetrics = ctx.measureText(entry.value)
    
    const cellsOccupied = Math.ceil(textMetrics.width / cellWidth)

    console.log(fontSize)
    
    if (atlasIdxX + cellsOccupied > entriesPerRow) {
      atlasIdxX = 0
      atlasIdxY++
    }

    const drawX = atlasIdxX * cellWidth
    const drawY = atlasIdxY * cellWidth

    ctx.strokeStyle = 'red'
    ctx.lineWidth = 10

    const texAtlasesForLine = []
    
    for (let i = atlasIdxX; i < atlasIdxX +cellsOccupied; i++) {
      const texAtlasX = i / entriesPerRow
      const texAtlasY = 1.0 - (atlasIdxY + 1) / entriesPerRow
      texAtlasesForLine.push([texAtlasX, texAtlasY])
      // ctx.strokeRect(x, drawY, cellWidth, cellWidth)
    }
    atlasIdxX += cellsOccupied

    ctx.translate(drawX, drawY + cellWidth / 2 + textMetrics.actualBoundingBoxAscent / 2)
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
    // ctx.fillStyle = 'white'
    ctx.translate(drawX + cellWidth / 2, drawY + cellWidth / 2)
    if (entry.type === ENTRY_TYPE_SYMBOL_DOT) {
      ctx.beginPath()
      ctx.arc(0, 0, 50, 0, Math.PI * 2, false)
      ctx.closePath()
      ctx.fill()
    } else if (entry.type === 'CROSS') {
      const idealRadius = 50
      const idealLineWidth = 30
      const texWidthDelta = size / IDEAL_TEXTURE_SIZE
      const radius = idealRadius * texWidthDelta
      const lineWidth = idealLineWidth * texWidthDelta
      ctx.lineWidth = lineWidth
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
      ctx.beginPath()
      ctx.moveTo(-radius, -radius)
      ctx.lineTo(radius, radius)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(radius, -radius)
      ctx.lineTo(-radius, radius)
      ctx.stroke()
    }
    ctx.restore()
    const texAtlasX = atlasIdxX / entriesPerRow
    const texAtlasY = 1.0 - (atlasIdxY + 1) / entriesPerRow

    const texAtlasCoords = [texAtlasX, texAtlasY]
    
    atlas.set(entry.type, texAtlasCoords)

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
  _addAtlasEntry (entry, textureId) {
    const { atlas, texture } = this._textureSet.get(textureId)
    let texAtlasCoords = atlas.get(entry.value)
    if (texAtlasCoords) {
      return texAtlasCoords
    }
    if (entry.type === ENTRY_TYPE_IMAGE) {
      texAtlasCoords = this._drawImage(entry, textureId)
    } else if (entry.type === ENTRY_TYPE_INDIVIDUAL_CHAR) {
      texAtlasCoords = this._drawChar(entry, textureId)
    } else if (entry.type === ENTRY_TYPE_WORD_LINE) {
      texAtlasCoords = this._drawWordLine(entry, textureId)
    } else {
      texAtlasCoords = this._drawDecoration(entry, textureId)
    }
    console.log('%c mark texture as needs update', 'background: yellow;color:black;')
    texture.needsUpdate = true
    return texAtlasCoords
  }
  _makeCanvas (textureId, size) {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    canvas.dataset.textureId = textureId
    canvas.width = canvas.height = size == null ? this._size : size
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
  getEntryTexCoordinate (entry, textureId = 'characters') {
    const textureData = this._textureSet.get(textureId)

    let textureUniformIdx

    if (textureData) {
      textureUniformIdx = textureData.textureUniformIdx
    }
    
    let atlas
    // debugger
    if (textureData) {
      atlas = textureData.atlas
    } else {
      let size = this._size
      let lineWidth = 20
      if (entry.type === ENTRY_TYPE_IMAGE) {
        size = 256
        lineWidth = 5
      }
      
      const { canvas, ctx } = this._makeCanvas(textureId, size)

      atlas = new Map()

      const entriesPerRow = 20
      const cellWidth = size / entriesPerRow

      for (let i = 0; i < entriesPerRow * entriesPerRow; i++) {
        const xIdx = i % entriesPerRow
        const yIdx = (i - xIdx) / entriesPerRow
        const drawX = xIdx * cellWidth
        const drawY = yIdx * cellWidth
        ctx.strokeStyle = 'red'
        ctx.lineWidth = lineWidth
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
        // ctx.font = '60px Arial'
        // ctx.fillText(i, drawX + cellWidth / 2, drawY + cellWidth / 2)
        // ctx.strokeRect(drawX, drawY, cellWidth, cellWidth)
      }

      textureUniformIdx = this._textureSet.size

      console.log('allocated new tex', textureUniformIdx)
      
      this._textureSet.set(textureId, {
        size,
        entriesPerRow,
        cellWidth,
        atlasIdxX: 0,
        atlasIdxY: 0,
        texture: new THREE.CanvasTexture(canvas),
        canvas,
        ctx,
        atlas: new Map(),
        textureUniformIdx
      })
    }
    let texCoordinates
    // TODO fix decoration logic
    if (entry.type === ENTRY_TYPE_SYMBOL_DOT || entry.type === "CROSS") {
      // texCoordinates = atlas.get(entry.type)
      texCoordinates = atlas.get(entry.value)
    } else {
      texCoordinates = atlas.get(entry.value)
    }
    if (!texCoordinates) {
      texCoordinates = this._addAtlasEntry(entry, textureId)
      // debugger
      // throw new Error('cant find texture coordinate for this entry')
    }
    return {
      texCoordinates,
      textureUniformIdx
    }
  }
}
