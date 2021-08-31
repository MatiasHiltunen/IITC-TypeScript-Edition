


import * as React from 'react'
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

class App extends React.Component {
  componentDidMount(){
    console.log(getCsrfToken())
  }

  render() {
    return <div>
      <IitcMap></IitcMap>
      <ChatComponent></ChatComponent>
      <SideBar></SideBar>
      <UpdateStatus></UpdateStatus>
      <PlayButton></PlayButton>
      <Header></Header>
    </div>
  }

}

export default App