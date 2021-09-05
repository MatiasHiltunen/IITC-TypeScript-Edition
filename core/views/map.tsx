import L, { LatLng } from 'leaflet'
import * as React from 'react'
import { FeatureGroup, LayerGroup, LayersControl, MapContainer, Polygon, Polyline, TileLayer } from 'react-leaflet'
import { clampLatLngBounds } from '../code/utils_misc'
import { NianticParams } from '../functions/extract'
import { FetchActions, fetchData, makeRequests } from '../functions/fetch'
import { storeMapPosition } from '../functions/cookies'
import { Entities, EntityData, ZoomTileParameters } from '../interfaces/enity'
import { parseEntitydata } from '../functions/entity'








interface MapActionsState {
    entityData: EntityData,

}
interface MapActionsProps {
    fetch(tileparams: ZoomTileParameters, bounds: L.LatLngBounds): Promise<EntityData>,
    niaData: NianticParams,
    map?: L.Map
}

class MapActions extends React.Component<MapActionsProps, MapActionsState> {
    map?: L.Map


    constructor(props) {
        super(props)

        this.state = {
            entityData: null
        }
        this.map = this.props.map

    }

    componentDidMount() {
        if (!this.map) return
        this.map.addEventListener('moveend', () => {
            this.setState({
                entityData: null
            })
            let bounds = clampLatLngBounds(this.map.getBounds());
            let zoom = this.map.getZoom();

            storeMapPosition(this.map.getCenter(), zoom);


            this.props.fetch(this.getMapZoomTileParameters(zoom), bounds)
                .then((entityData: EntityData) => {
                    this.setState({
                        entityData: entityData
                    })
                }).catch(console.error)


        })

         /* this.map.addEventListener('movestart',()=>{
             this.setState({
                 entityData:null
             })
         }) */
    }

    getMapZoomTileParameters(zoom): ZoomTileParameters {
        this.props.niaData.tilesPerEdge
        let maxTilesPerEdge = this.props.niaData.tilesPerEdge[this.props.niaData.tilesPerEdge.length - 1];

        return {
            level: this.props.niaData.zoomToLevel[zoom] || 0, // deprecated
            tilesPerEdge: this.props.niaData.tilesPerEdge[zoom] || maxTilesPerEdge,
            minLinkLength: this.props.niaData.zoomLinkToLength[zoom] || 0,
            hasPortals: zoom >= this.props.niaData.zoomLinkToLength.length,  // no portals returned at all when link length limits things
            zoom: zoom  // include the zoom level, for reference
        };
    }

    enlLinks() {
        return <LayersControl.Overlay checked name="ENL Links" >
            <Polyline pathOptions={{ color: '#2bd82e', weight: 1 }} positions={this.state.entityData.enl.links} ></Polyline>
        </LayersControl.Overlay>
    }

    resLinks() {
        return <LayersControl.Overlay checked name="RES Links" >
            <Polyline pathOptions={{ color: '#3cb1fc', weight: 1 }} positions={this.state.entityData.res.links} ></Polyline>
        </LayersControl.Overlay>
    }

    enlFields() {
        return <LayersControl.Overlay checked name="ENL Fields" >
            <Polygon pathOptions={{ weight: 1, color: '#2bd82e', fillColor: '#2bd82e', fillOpacity: 0.3 }} positions={this.state.entityData.enl.fields} ></Polygon>
        </LayersControl.Overlay>
    }

    resFields() {
        return <LayersControl.Overlay checked name="RES Fields" >
            <Polygon pathOptions={{ weight: 1, color: '#3cb1fc', fillColor: '#3cb1fc', fillOpacity: 0.3 }} positions={this.state.entityData.res.fields} ></Polygon>
        </LayersControl.Overlay>
    }

    render() {

        return this.state.entityData === null ? null : <template> {this.enlLinks()} {this.resLinks()} {this.resFields()} {this.enlFields()}</template>
    }
}

interface IitcMapProps {
    niaData: NianticParams
}

interface IitcMapState {
    center?: LatLng;
    centerS?: LatLng;
    polyLIne?: [number, number][];
    map?: L.Map
}

class IitcMap extends React.Component<IitcMapProps, IitcMapState> {
    /* state: IitcMapState */
    niaData: NianticParams
    constructor(props) {
        super(props);
        this.state = {
            center: new LatLng(62.0, 23.0),
            centerS: new LatLng(62.0, 23.0),
            polyLIne: [
                [63.0, 23.5],
                [63.5, 22.0],
                [64.0, 22.9],
                [63.0, 23.5],
            ],
            map: null
        }
        this.niaData = this.props.niaData


    }




    async fetch(tileParams: ZoomTileParameters, bounds: L.LatLngBounds): Promise<EntityData> {


        const data: Entities[] = await makeRequests(
            tileParams,
            bounds,
            this.niaData.token,
            this.niaData.version
        );

        let obj: EntityData = parseEntitydata(data, {
            res: {
                portals: [],
                links: [],
                fields: [],
            },
            enl: {
                portals: [],
                links: [],
                fields: [],
            },
            none: {
                portals: []
            },
            error: []
        })

        let tries = 0

        while (obj.error.length > 0 && tries <= 5) {
            let tileIds = []
            let results = []

            for (let i = 0; i < obj.error.length; i++) {

                tileIds.push(obj.error[i])

                if (tileIds.length >= 24) {
                    results.push(fetchData({
                        v: this.niaData.version,
                        tileKeys: tileIds
                    },
                        FetchActions.getEntities,
                        this.niaData.token))
                    tileIds = [];
                }

            }
            if (tileIds.length > 0) {
                results.push(fetchData({
                    v: this.niaData.version,
                    tileKeys: tileIds
                },
                    FetchActions.getEntities,
                    this.niaData.token))
            }


            obj = parseEntitydata(await Promise.all(results), obj)
           
            tries++
        }

      
        return obj

        /* console.log("tileIds", tileIds); */


    }

    setMap(map: L.Map) {

        this.setState({
            map: map
        })

    }

    render() {

        return <MapContainer preferCanvas={true} renderer={L.canvas()} center={this.state.center} zoom={13} style={{ height: 100 + 'vh' }} scrollWheelZoom={true} whenCreated={(map) => this.setMap(map)}>
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
                <LayersControl.BaseLayer name="Carto Dark">
                    <TileLayer subdomains='abcd'
                        attribution='&copy; <a href="https://carto.com/basemaps/">Carto Dark'
                        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"
                    />
                </LayersControl.BaseLayer>

                
                {this.state.map !== null ? <MapActions fetch={this.fetch} niaData={this.props.niaData} map={this.state.map}></MapActions> : null}





            </LayersControl>

        </MapContainer>


    }
}

export default IitcMap