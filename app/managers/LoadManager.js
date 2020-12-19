import WebFont from 'webfontloader'

import {
  RESOURCE_IMAGE,
  RESOURCE_FONT,
  EVT_ADD_TO_LOAD_QUEUE
} from '../constants'

import {
  loadImage
} from '../helpers'

import store from '../store'
import {
  setLoadProgress
} from '../store/actions'

export default class LoadManager {
  constructor () {
    this._resourcesToLoad = []

    document.addEventListener(EVT_ADD_TO_LOAD_QUEUE, this.addResourceToLoad.bind(this))
  }
  addResourceToLoad ({ detail: entry }) {
    this._resourcesToLoad.push(entry)
  }
  loadResources () {
    const step = 1 / this._resourcesToLoad.length
    let loadedProgress = 0
    return Promise
      .all(this._resourcesToLoad.map((resource, i) => {
        if (resource.type === RESOURCE_IMAGE) {
          return loadImage({ src: resource.src }).then(res => {
            loadedProgress += step
            store.dispatch(setLoadProgress(loadedProgress))
            return {
              ...resource,
              value: res
          }
          })
          .catch(err => {
            throw new Error(err)
          })
        } else if (resource.type === RESOURCE_FONT) {
          return new Promise((resolve, reject) => {
            const { isDebugMode } = store.getState()
            // if (isDebugMode) {
            //   loadedProgress += step
            //   store.dispatch(setLoadProgress(loadedProgress))
            //   return resolve(resource)
            // }
            WebFont.load({
              google: { families: [resource.fontName] },
              text: resource.text,
              fontactive: () => {
                loadedProgress += step
                store.dispatch(setLoadProgress(loadedProgress))
                resolve(resource)
              },
              fontinactive: fontName => reject(new Error('Font family failed to load', fontName)),
            })
          })
        }
      }))
  }
}
