import * as THREE from 'three'

import {
  ENTRY_TYPE_IMAGE,
  ENTRY_TYPE_INDIVIDUAL_CHAR,
  ENTRY_TYPE_WORD_LINE,
  ENTRY_TYPE_SYMBOL_DOT,
  DECORATION_TYPE_BORDER,
} from './constants'

let instance

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
      ctx.strokeRect(drawX, drawY, cellWidth, cellWidth)
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
    })

  }
  get entriesPerRow () {
    return entriesPerRow
  }
  _drawImage (entry, textureId) {
    const { ctx, entriesPerRow, size, atlas } = this._textureSet.get(textureId)
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

    const image = new Image()
    image.onload = () => {
      ctx.save()
      ctx.drawImage(image, 0, 0, size, size)

      // for (let i = 0; i < entriesPerRow * entriesPerRow; i++) {
      //   const xIdx = i % entriesPerRow
      //   const yIdx = (i - xIdx) / entriesPerRow
      //   const drawX = xIdx * cellWidth
      //   const drawY = yIdx * cellWidth
      //   ctx.strokeStyle = 'red'
      //   ctx.lineWidth = 3
      //   ctx.strokeRect(drawX, drawY, cellWidth, cellWidth)
      // }
      atlas.set(entry.value, texCoords)
      // debugger

      ctx.restore()
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
      entriesPerRow
    } = textureData

    let {
      atlasIdxX,
      atlasIdxY,
    } = textureData

    const drawX = atlasIdxX * cellWidth
    const drawY = atlasIdxY * cellWidth
    ctx.save()
    ctx.fillStyle = 'black'
    ctx.font = `${150}px monospace`
    ctx.textAlign = 'center'
    ctx.translate(drawX + cellWidth / 2, drawY + cellWidth / 2 + 85)
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
  _drawDecoration (entry, textureId) {
    const textureData = this._textureSet.get(textureId)
    const {
      ctx,
      atlas,
      cellWidth,
      entriesPerRow,
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
      const radius = 50
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
  _drawWordLine (entry, textureId) {
    const textureData = this._textureSet.get(textureId)
    const {
      ctx,
      atlas,
      cellWidth,
      entriesPerRow
    } = textureData

    let {
      atlasIdxX,
      atlasIdxY,
    } = textureData

    ctx.save()
    ctx.fillStyle = 'black'
    ctx.font = `${150}px monospace`

    const textMetrics = ctx.measureText(entry.value)
    
    const cellsOccupied = Math.ceil(textMetrics.width / cellWidth)
    
    // this._atlasIdX += cellsOccupied
    // atlasIdxY += 1



    // atlasIdxX++
    
    if (atlasIdxX + cellsOccupied > entriesPerRow) {
      atlasIdxX = 0
      atlasIdxY++
    }

    const drawX = atlasIdxX * cellWidth
    const drawY = atlasIdxY * cellWidth

    ctx.strokeStyle = 'red'
    ctx.lineWidth = 10

    const texAtlasesForLine = []
    
    for (let i = 0; i < cellsOccupied; i++) {
      const x = drawX + i * cellWidth
      const texAtlasX = atlasIdxX / entriesPerRow + i / entriesPerRow
      const texAtlasY = 1.0 - (atlasIdxY + 1) / entriesPerRow
      texAtlasesForLine.push([texAtlasX, texAtlasY])
      // ctx.strokeRect(x, drawY, cellWidth, cellWidth)
    }
    atlasIdxX += cellsOccupied

    ctx.translate(drawX, drawY + cellWidth / 2 + 85)
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
    let atlas
    // debugger
    if (textureData) {
      atlas = textureData.atlas
    } else {
      let size = this._size
      let lineWidth = 20
      if (entry.type === ENTRY_TYPE_IMAGE) {
        size = 1024
        lineWidth = 5
      }
      
      const { canvas, ctx } = this._makeCanvas(textureId, size)

      atlas = new Map()

      const entriesPerRow = 20
      const cellWidth = size / entriesPerRow

      console.log(size)

      for (let i = 0; i < entriesPerRow * entriesPerRow; i++) {
        const xIdx = i % entriesPerRow
        const yIdx = (i - xIdx) / entriesPerRow
        const drawX = xIdx * cellWidth
        const drawY = yIdx * cellWidth
        ctx.strokeStyle = 'red'
        ctx.lineWidth = lineWidth
        ctx.strokeRect(drawX, drawY, cellWidth, cellWidth)
      }
      
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
      })
    }
    let texCoordinates
    // TODO fix decoration logic
    if (entry.type === ENTRY_TYPE_SYMBOL_DOT || entry.type === "CROSS") {
      // texCoordinates = atlas.get(entry.type)
    } else {
      texCoordinates = atlas.get(entry.value, textureId)
      if (entry.type === ENTRY_TYPE_IMAGE) {
        // debugger
      }
    }
    if (!texCoordinates) {
      texCoordinates = this._addAtlasEntry(entry, textureId)
      // throw new Error('cant find texture coordinate for this entry')
    }
    return texCoordinates
  }
}
