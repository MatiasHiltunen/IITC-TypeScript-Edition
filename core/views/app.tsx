


import * as React from 'react'
import { extractFromStock, NianticParams } from '../functions/extract'
import ChatComponent from './chat'
import Header from './header'
import IitcMap from './map'
import SideBar from './sidebar'
import UpdateStatus from './updateStatus'



const getCsrfToken = () => document.cookie.split(";")
  .find(a => a.includes('csrftoken'))
  .split("=")[1].trim()


class PlayButton extends React.Component {
  render() {
    return <div id="play_button" />
  }
}

interface AppState {
  niaData: NianticParams
}

interface AppProps {

}

class App extends React.Component<AppProps, AppState> {
  constructor(props) {
    super(props);

    this.state = {
      niaData: { ...extractFromStock(), token: getCsrfToken() }
    }
  }


  render() {
    return <div>
      <IitcMap niaData={this.state.niaData}></IitcMap>
{/*       <ChatComponent></ChatComponent>
      <SideBar></SideBar>
      <UpdateStatus></UpdateStatus>
      <PlayButton></PlayButton>
      <Header></Header> */}
    </div>
  }

}

export default App