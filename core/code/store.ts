import { Player } from "./player";
import {MapDataRequest} from './map_data_request'
import {Chat} from './chat'
import { PortalDetail } from "./portal_detail";

export const store:Store = {
    // map instance
    map: null,
    layerChooser: null,
    mapDataRequest: null,
    PREFER_CANVAS: false,
    storeMapPosition: null,
    oms: null,
  
    refreshTimeout: undefined, // ok
    timeSinceLastRefresh: null, // ok
    urlPortal: null, // some missing
    urlPortalLL: null, // probably ok
    selectedPortal: null, // ok?
    lastVisible: null,
    portalRangeIndicator: null, //
    portalAccessIndicator: null,
    mapRunsUserAction: false,
    portalsFactionLayers: null,
    linksFactionLayers: null,
    fieldsFactionLayers: null,
    artifact: null,
    portalDetail: null,
    tooltipClearerHasBeenSetup: false,
    latestFailedRequestTime: null,
    blockOutOfDateRequests: null,

    // player information
    PLAYER: null,
    // contain references to all entities loaded from the server. If render limits are hit,
    // not all may be added to the leaflet layers
    portals: {},
    links: {},
    fields: {},
    // Store console here instead of window 
    console: {},
    // store chat instance here
    chat: null,
    // Niantic params
    niantic_params: {
        CURRENT_VERSION: null,
        ZOOM_TO_LEVEL: null,
        TILES_PER_EDGE: null
    },
    // Tiles
    TILE_PARAMS: {
        ZOOM_TO_LINK_LENGTH: null,
        ZOOM_TO_LEVEL: null,
        TILES_PER_EDGE: null
    },
    // contain current status(on/off) of overlay layerGroups.
    // But you should use isLayerGroupDisplayed(name) to check the status
    overlayStatus: {},
}

interface Store {

    map?: any,
    layerChooser: any,
    mapDataRequest?: MapDataRequest,
    PREFER_CANVAS?: boolean,
    storeMapPosition?: any,
    oms?: any,

    refreshTimeout?: any, 
    timeSinceLastRefresh?: number, 
    urlPortal?: string, 
    urlPortalLL?: [number, number], 
    selectedPortal?: string, 
    lastVisible?: string,
    portalRangeIndicator: any, 
    portalAccessIndicator: any,
    mapRunsUserAction: boolean,
    portalsFactionLayers: L.LayerGroup[][],
    linksFactionLayers: L.LayerGroup[],
    fieldsFactionLayers: L.LayerGroup[],
    artifact: any,
    portalDetail: PortalDetail,
    tooltipClearerHasBeenSetup: boolean,
    latestFailedRequestTime: any,
    blockOutOfDateRequests: any,

    // player information
    PLAYER: Player,
    // contain references to all entities loaded from the server. If render limits are hit,
    // not all may be added to the leaflet layers
    portals: {},
    links: {},
    fields: {},
    // Store console here instead of window 
    console: {},
    // store chat instance here
    chat: Chat,
    // Niantic params
    niantic_params: {
        CURRENT_VERSION: any,
        ZOOM_TO_LEVEL: any,
        TILES_PER_EDGE: any
    },
    // Tiles
    TILE_PARAMS: {
        ZOOM_TO_LINK_LENGTH: any,
        ZOOM_TO_LEVEL: any,
        TILES_PER_EDGE: any
    },
    // contain current status(on/off) of overlay layerGroups.
    // But you should use isLayerGroupDisplayed(name) to check the status
    overlayStatus: {},
}