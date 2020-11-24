import { createStore } from 'redux'

import * as actions from './actions'


const initialState = {
  hoverEntryName: null,
  loadProgress: 0
}

const appState = (state = initialState, action) => {
  switch (action.type) {
    case actions.SET_HOVERING_ENTRY: {
      const { hoverEntryName } = action
      return { ...state, hoverEntryName }
    } 
    case actions.SET_LOAD_PROGRESS: {
      const { loadProgress } = action
      return { ...state, loadProgress }
    }
    default: {
      return state
    }
  }
}

export default createStore(appState)
