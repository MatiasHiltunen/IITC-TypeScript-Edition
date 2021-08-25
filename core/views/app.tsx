

import L from 'leaflet'
import * as React from 'react'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import { createElementHook, createPathHook, createLeafComponent } from '@react-leaflet/core'
import ChatComponent from './chat'
import SideBar from './sidebar'


function getBounds(props) { return L.latLng(props.center).toBounds(props.size) }
function createSquare(props, context) { return { instance: new L.Rectangle(getBounds(props)), context } }
function updateSquare(instance, props, prevProps) { if (props.center !== prevProps.center || props.size !== prevProps.size) { instance.setBounds(getBounds(props)) } }
const useSquareElement = createElementHook(createSquare, updateSquare)
const useSquare = createPathHook(useSquareElement)
const Square = createLeafComponent(useSquare)

interface IProps {
}

interface IState {
  center?: [number, number];
}

class IitcMap extends React.Component<IProps, IState> {
  state: IState
  constructor(props) {
    super(props);
    this.state = { center: [62.0, 23.0] }
  }
  
  render() {

    return <div id="map">
      <MapContainer center={this.state.center} zoom={13} style={{ height: 100+'%' }} scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Square center={this.state.center} size={1000} />
      </MapContainer>
    </div>

  }
}

class Header extends React.Component {
  render() {
    return <div id="header">
      <div id="nav" />
    </div>
  }
}

class UpdateStatus extends React.Component {
  render() {
    return <div id="updatestatus">
      <div id="innerstatus" />
    </div>
  }
}

class PlayButton extends React.Component {
  render() {
    return <div id="play_button" />
  }
}

class App extends React.Component {

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