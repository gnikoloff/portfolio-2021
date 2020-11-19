import * as THREE from 'three'

import {
  ENTRY_TYPE_INDIVIDUAL_CHAR,
  ENTRY_TYPE_WORD_LINE,
  ENTRY_TYPE_SYMBOL_DOT,
} from './constants'

export default class TextureManager {
  constructor ({
    size
  } = {}) {
    this._atlas = new Map()
    this._atlasIdxX = 0
    this._atlasIdxY = 0
    this._entriesPerRow = 10

    this._size = size
    this._cellWidth = this._size / this._entriesPerRow

    this._texCanvas = document.createElement('canvas')
    this._texCtx = this._texCanvas.getContext('2d')

    this._texture = new THREE.CanvasTexture(this._texCanvas)

    this._texCanvas.width = this._texCanvas.height = this._size
    this._texCanvas.style.position = 'fixed'
    this._texCanvas.style.top = this._texCanvas.style.left = '24px'
    this._texCanvas.style.transform = 'scale(0.05)'
    this._texCanvas.style.transformOrigin = '0 0'
    this._texCanvas.style.border = '5px solid red'
    document.body.appendChild(this._texCanvas)

    for (let i = 0; i < this._entriesPerRow * this._entriesPerRow; i++) {
      const xIdx = i % this._entriesPerRow
      const yIdx = (i - xIdx) / this._entriesPerRow
      const drawX = xIdx * this._cellWidth
      const drawY = yIdx * this._cellWidth
      this._texCtx.strokeStyle = 'red'
      this._texCtx.lineWidth = 50
      this._texCtx.strokeRect(drawX, drawY, this._cellWidth, this._cellWidth)
    }
  }
  get texture () {
    return this._texture
  }
  _drawChar (entry) {
    const drawX = this._atlasIdxX * this._cellWidth
    const drawY = this._atlasIdxY * this._cellWidth
    this._texCtx.save()
    this._texCtx.fillStyle = 'black'
    this._texCtx.font = `${300}px monospace`
    this._texCtx.textAlign = 'center'
    this._texCtx.translate(drawX + this._cellWidth / 2, drawY + this._cellWidth / 2 + 85)
    this._texCtx.fillText(entry.value, 0, 0)
    this._texCtx.restore()
    const texAtlasX = this._atlasIdxX / this._entriesPerRow
    const texAtlasY = 1.0 - (this._atlasIdxY + 1) / this._entriesPerRow

    const texAtlasCoords = [texAtlasX, texAtlasY]
    
    this._atlas.set(entry.value, texAtlasCoords)

    this._atlasIdxX++

    if (this._atlasIdxX >= this._entriesPerRow) {
      this._atlasIdxX = 0
      this._atlasIdxY++
    }

    return texAtlasCoords
  }
  _drawDecoration (entry) {
    const drawX = this._atlasIdxX * this._cellWidth
    const drawY = this._atlasIdxY * this._cellWidth
    this._texCtx.save()
    // this._texCtx.fillStyle = 'white'
    this._texCtx.translate(drawX + this._cellWidth / 2, drawY + this._cellWidth / 2)
    if (entry.type === ENTRY_TYPE_SYMBOL_DOT) {
      this._texCtx.beginPath()
      this._texCtx.arc(0, 0, 50, 0, Math.PI * 2, false)
      this._texCtx.closePath()
      this._texCtx.fill()
    } else if (entry.type === 'CROSS') {
      const radius = 50
      this._texCtx.beginPath()
      this._texCtx.moveTo(-radius, -radius)
      this._texCtx.lineTo(radius, radius)
      this._texCtx.stroke()
      this._texCtx.beginPath()
      this._texCtx.moveTo(radius, -radius)
      this._texCtx.lineTo(-radius, radius)
      this._texCtx.stroke()
    }
    this._texCtx.restore()
    const texAtlasX = this._atlasIdxX / this._entriesPerRow
    const texAtlasY = 1.0 - (this._atlasIdxY + 1) / this._entriesPerRow

    const texAtlasCoords = [texAtlasX, texAtlasY]
    
    this._atlas.set(entry.type, texAtlasCoords)

    this._atlasIdxX++

    if (this._atlasIdxX >= this._entriesPerRow) {
      this._atlasIdxX = 0
      this._atlasIdxY++
    }

    return texAtlasCoords
  }
  _drawWordLine (entry) {
    this._atlasIdxX = 0
    this._atlasIdxY++

    const drawX = this._atlasIdxX
    const drawY = this._atlasIdxY * this._cellWidth

    this._texCtx.save()
    this._texCtx.fillStyle = 'black'
    this._texCtx.font = `${298}px monospace`

    const textMetrics = this._texCtx.measureText(entry.value)
    
    const cellsOccupied = Math.ceil(textMetrics.width / this._cellWidth)

    this._texCtx.strokeStyle = 'red'
    this._texCtx.lineWidth = 10

    const texAtlasesForLine = []
    
    for (let i = 0; i < cellsOccupied; i++) {
      const x = drawX + i * this._cellWidth
      const texAtlasX = i / this._entriesPerRow
      const texAtlasY = 1.0 - (this._atlasIdxY + 1) / this._entriesPerRow
      texAtlasesForLine.push([texAtlasX, texAtlasY])
      // this._texCtx.strokeRect(x, drawY, this._cellWidth, this._cellWidth)
    }

    this._texCtx.translate(drawX, drawY + this._cellWidth / 2 + 85)
    this._texCtx.fillText(entry.value, 0, 0)
    this._texCtx.restore()

    this._atlas.set(entry.value || entry.type, texAtlasesForLine)
    
    this._atlasIdxY++

    return texAtlasesForLine
  }
  _addAtlasEntry (entry) {
    let texAtlasCoords
    if (entry.type === ENTRY_TYPE_INDIVIDUAL_CHAR) {
      texAtlasCoords = this._drawChar(entry)
    } else if (entry.type === ENTRY_TYPE_WORD_LINE) {
      texAtlasCoords = this._drawWordLine(entry)
    } else {
      texAtlasCoords = this._drawDecoration(entry)
    }
    this._texture.needsUpdate = true
    return texAtlasCoords
  }
  getEntryTexCoordinate (entry) {
    let texCoordinates = this._atlas.get(entry.value)
    if (!texCoordinates) {
      texCoordinates = this._addAtlasEntry(entry)
      // throw new Error('cant find texture coordinate for this entry')
    }
    return texCoordinates
  }
}
