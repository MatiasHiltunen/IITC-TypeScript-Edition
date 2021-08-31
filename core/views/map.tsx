import L, { LatLng } from 'leaflet'
import * as React from 'react'
import { LayersControl, MapContainer, Polyline, TileLayer } from 'react-leaflet'
import { createElementHook, createPathHook, createLeafComponent } from '@react-leaflet/core'


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
    polyLIne?: [number, number][]
}
const limeOptions = { color: 'lime' }


class IitcMap extends React.Component<IProps, IState> {
    state: IState
    constructor(props) {
        super(props);
        this.state = {
            center: [62.0, 23.0],
            polyLIne: [
                [63.0, 23.5],
                [63.5, 22.0],
                [64.0, 22.9],
                [63.0, 23.5],
            ]
        }

    }

    getFields() {

        Array(10).fill(this.state.polyLIne).map(a => (<Polyline pathOptions={limeOptions} positions={this.state.polyLIne} />))
    }

    render() {

        return <MapContainer center={this.state.center} zoom={13} style={{ height: 100 + 'vh' }} scrollWheelZoom={false}>
            <LayersControl>

            <LayersControl.BaseLayer checked name="OpenStreetMap.Mapnik">
                <TileLayer
                    attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="OpenStreetMap.BlackAndWhite">
                <TileLayer
                    attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
                    url="https://tiles.wmflabs.org/bw-mapnik/{z}/{x}/{y}.png"
                    />
            </LayersControl.BaseLayer>
                    </LayersControl>
            <Square center={this.state.center} size={1000} />

        </MapContainer>


    }
}

export default IitcMap