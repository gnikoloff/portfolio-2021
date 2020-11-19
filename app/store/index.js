import { createStore } from 'redux'

import * as actions from './actions'


const initialState = {
  hoverEntryName: null
}

const appState = (state = initialState, action) => {
  switch (action.type) {
    case actions.SET_HOVERING_ENTRY: {
      const { hoverEntryName } = action
      // console.log(hoverEntryName)
      return { ...state, hoverEntryName }
    } 
    default: {
      return state
    }
  }
}

export default createStore(appState)
