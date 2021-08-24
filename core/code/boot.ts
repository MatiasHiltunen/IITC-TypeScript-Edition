import { CHAT_SHRINKED, COLORS, HIDDEN_SCROLLBAR_ASSUMED_WIDTH, MIN_ZOOM, ON_MOVE_REFRESH, SIDEBAR_WIDTH, TEAM_ENL, TEAM_NONE, TEAM_RES, } from './config'
import { convertTextToTableMagic, digits, getURLParam, isLayerGroupDisplayed, updateDisplayedLayerGroup } from './utils_misc';
import { PortalDetail } from './portal_detail';
import { MapDataRequest } from './map_data_request';
import { extractFromStock } from './extract_niantic_parameters';
import { Artifact } from './artifact';
import { addResumeFunction, idleReset, setupIdle } from './idle';
import { Chat } from './chat'
import { runHooks } from './hooks';
import { requests, startRefreshTimeout } from './request_handling';
import { store } from './store'
import { setupDataTileParams } from './map_data_calc_tools';
import { ornaments } from './ornaments';
import { search } from './search';
import { setupRedeem } from './redeeming';
import { updateGameScore } from './game_status';
import L from 'leaflet';
import { getPosition, storeMapPosition } from './location';
import OverlappingMarkerSpiderfier from 'overlapping-marker-spiderfier'
import { isSmartphone, runOnSmartphonesAfterBoot, runOnSmartphonesBeforeBoot } from './smartphone';
import { dialog, setupDialogs } from './dialog';
import $ from 'jquery'
import { resetScrollOnNewPortal } from './portal_detail_display';

// @ts-ignore
import markerUrl from '../images/marker-ingress.png'
// @ts-ignore
import marker2xUrl from '../images/marker-ingress.png'
// @ts-ignore
import markerShadowUrl from '../images/marker-ingress.png'
import { Player, Team } from './player';
import { RegionScoreboard } from './region_scoreboard';






/// SETUP /////////////////////////////////////////////////////////////
// these functions set up specific areas after the boot function
// created a basic framework. All of these functions should only ever
// be run once.

const setupLargeImagePreview = function () {

    $('#portaldetails').on('click', '.imgpreview', function (e) {
        const img = this.querySelector('img');
        //dialogs have 12px padding around the content
        const dlgWidth = Math.max(img.naturalWidth + 24, 500);
        // This might be a case where multiple dialogs make sense, for example
        // someone might want to compare images of multiple portals.  But
        // usually we only want to show one version of each image.
        // To support that, we'd need a unique key per portal.  Example, guid.
        // So that would have to be in the html fetched into details.

        const preview = new Image(img.width, img.height);
        preview.src = img.src;
        preview.style.setProperty('margin', 'auto')
        preview.style.setProperty('display', 'block')


        let title = (e.delegateTarget.querySelector('.title') as HTMLElement).innerText;
        dialog({
            html: preview,
            title: title,
            id: 'iitc-portal-image',
            width: dlgWidth,
        });
    });
}

// adds listeners to the layer chooser such that a long press hides
// all custom layers except the long pressed one.
const setupLayerChooserSelectOne = function () {
    $('.leaflet-control-layers-overlays').on('click taphold', 'label', function (e) {
        if (!e) return;
        if (!(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.type === 'taphold')) return;

        let m = store.map;

        let add = function (layer: { layer: any; }) {
            if (!m.hasLayer(layer.layer)) m.addLayer(layer.layer);
        };
        let rem = function (layer: { layer: any; }) {
            if (m.hasLayer(layer.layer)) m.removeLayer(layer.layer);
        };

        let isChecked = $(e.target).find('input').is(':checked');
        let checkSize = $('.leaflet-control-layers-overlays input:checked').length;
        if ((isChecked && checkSize === 1) || checkSize === 0) {
            // if nothing is selected or the users long-clicks the only
            // selected element, assume all boxes should be checked again

            $.each(store.layerChooser._layers, function (ind, layer) {
                if (!layer.overlay) return true;
                add(layer);
            });
        } else {
            // uncheck all

            let keep = $.trim($(e.target).text());

            $.each(store.layerChooser._layers, function (ind, layer) {
                if (layer.overlay !== true) return true;
                if (layer.name === keep) { add(layer); return true; }
                rem(layer);
            });
        }
        e.preventDefault();
    });
}

// Setup the function to record the on/off status of overlay layerGroups
const setupLayerChooserStatusRecorder = function () {
    // Record already added layerGroups

    $.each(store.layerChooser._layers, function (ind, chooserEntry) {
        if (!chooserEntry.overlay) return true;

        const display = store.map.hasLayer(chooserEntry.layer);

        updateDisplayedLayerGroup(chooserEntry.name, display);
    });

    store.map.on('overlayadd overlayremove', function (e: any) {
        const display = (e.type === 'overlayadd');

        updateDisplayedLayerGroup(e.name, display);
    });
}

const setupStyles = function () {
    $('head').append('<style>' + ['#largepreview.enl img { border:2px solid ' + COLORS[TEAM_ENL] + '; } ',
    '#largepreview.res img { border:2px solid ' + COLORS[TEAM_RES] + '; } ',
    '#largepreview.none img { border:2px solid ' + COLORS[TEAM_NONE] + '; } ',
    '#chatcontrols { bottom: ' + (CHAT_SHRINKED + 22) + 'px; }',
    '#chat { height: ' + CHAT_SHRINKED + 'px; } ',
    '.leaflet-right { margin-right: ' + (SIDEBAR_WIDTH + 1) + 'px } ',
    '#updatestatus { width:' + (SIDEBAR_WIDTH + 2) + 'px;  } ',
    '#sidebar { width:' + (SIDEBAR_WIDTH + HIDDEN_SCROLLBAR_ASSUMED_WIDTH + 1) + 'px; display: block; } ',
    '#sidebartoggle { right:' + (SIDEBAR_WIDTH + 1) + 'px;  } ',
    '#scrollwrapper  { width:' + (SIDEBAR_WIDTH + 2 * HIDDEN_SCROLLBAR_ASSUMED_WIDTH) + 'px; right:-' + (2 * HIDDEN_SCROLLBAR_ASSUMED_WIDTH - 2) + 'px } ',
    '#sidebar > * { width:' + (SIDEBAR_WIDTH + 1) + 'px;  }'
    ].join("\n") +
        '</style>');
}

const setupIcons = function () {
    $(['<svg>',
        // Material Icons

        // portal_detail_display.js
        '<symbol id="ic_place_24px" viewBox="0 0 24 24">',
        '<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z"/>',
        '</symbol>',
        '</svg>'
    ].join('\\n')).appendTo('body');
}

const createDefaultBaseMapLayers = () => {
    let baseLayers = {};

    //OpenStreetMap attribution - required by several of the layers
    /*   const osmAttribution = 'Map data © OpenStreetMap contributors'; */

    // MapQuest - http://developer.mapquest.com/web/products/open/map
    // now requires an API key
    //let mqSubdomains = [ 'otile1','otile2', 'otile3', 'otile4' ];
    //let mqTileUrlPrefix = window.location.protocol !== 'https:' ? 'http://{s}.mqcdn.com' : 'https://{s}-s.mqcdn.com';
    //let mqMapOpt = {attribution: osmAttribution+', Tiles Courtesy of MapQuest', maxNativeZoom: 18, maxZoom: 21, subdomains: mqSubdomains};
    //baseLayers['MapQuest OSM'] = new L.TileLayer(mqTileUrlPrefix+'/tiles/1.0.0/map/{z}/{x}/{y}.jpg',mqMapOpt);

    // cartodb has some nice tiles too - both dark and light subtle maps - http://cartodb.com/basemaps/
    // (not available over https though - not on the right domain name anyway)
    let cartoAttr = '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="http://cartodb.com/attributions">CartoDB</a>';
    let cartoUrl = `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png`;

    baseLayers['CartoDB Dark Matter'] = L.tileLayer(cartoUrl, { attribution: cartoAttr });

    baseLayers['CartoDB Positron'] = L.tileLayer(cartoUrl, { attribution: cartoAttr });


    /* 

    baseLayers['Google Default Ingress Map'] = L.gridLayer.g googleMutant({
        type: 'roadmap',
        backgroundColor: '#0e3d4e',
        styles: [{
            featureType: "all",
            elementType: "all",
            stylers: [{ visibility: "on" }, { hue: "#131c1c" }, { saturation: "-50" }, { invert_lightness: true }]
        },
        {
            featureType: "water",
            elementType: "all",
            stylers: [{ visibility: "on" }, { hue: "#005eff" }, { invert_lightness: true }]
        },
        { featureType: "poi", stylers: [{ visibility: "off" }] },
        { featureType: "transit", elementType: "all", stylers: [{ visibility: "off" }] },
        { featureType: "road", elementType: "labels.icon", stylers: [{ invert_lightness: !0 }] }
        ],
    });
    // 

    baseLayers['Google Roads'] = googleMutant({ type: 'roadmap' });
    // 

    let trafficMutant = googleMutant({ type: 'roadmap' });

    trafficMutant.addGoogleLayer('TrafficLayer');
    baseLayers['Google Roads + Traffic'] = trafficMutant;
    // 

    baseLayers['Google Satellite'] = googleMutant({ type: 'satellite' });
    // 

    baseLayers['Google Hybrid'] = googleMutant({ type: 'hybrid' });
    // 

    baseLayers['Google Terrain'] = googleMutant({ type: 'terrain' });
 */

    return baseLayers;
}


const setupMap = () => {
    $('#map').text('');




    // proper initial position is now delayed until all plugins are loaded and the base layer is set

    store.map = new L.Map('map', {
        center: [0, 0],
        zoom: 1,
        zoomControl: true,
        minZoom: MIN_ZOOM,
        //    zoomAnimation: false,
        markerZoomAnimation: false,
        bounceAtZoomLimits: false,
        maxBoundsViscosity: 0.7,
        worldCopyJump: true, // wrap longitude to not find ourselves looking beyond +-180 degrees        
        preferCanvas: true // default

    });

    // console.log("MAP OPTIONS CRS", store.map.options.crs)


    let max_lat = store.map.options.crs.getProjectedBounds(1).max.x;

    // console.log(max_lat)

    store.map.setMaxBounds([
        [max_lat, 360],
        [-max_lat, -360]
    ]);


    L.Renderer.mergeOptions({
        padding: 0.5
    });

    // add empty div to leaflet control areas - to force other leaflet controls to move around IITC UI elements
    // TODO? move the actual IITC DOM into the leaflet control areas, so dummy <div>s aren't needed
    // 
    if (!isSmartphone()) {
        // chat window area
        // 
        $((store.map as any)._controlCorners['bottomleft']).append(
            $('<div>').width(708).height(108).addClass('leaflet-control').css({ 'pointer-events': 'none', 'margin': '0' }));
    }

    let addLayers = {};
    let hiddenLayer = [];

    store.portalsFactionLayers = [];
    let portalsLayers = [];
    for (let i = 0; i <= 8; i++) {



        store.portalsFactionLayers[i] = [L.layerGroup(), L.layerGroup(), L.layerGroup()];


        portalsLayers[i] = L.layerGroup(store.portalsFactionLayers[i]);

        store.map.addLayer(portalsLayers[i]);

        let t = (i === 0 ? 'Unclaimed/Placeholder' : 'Level ' + i) + ' Portals';

        addLayers[t] = portalsLayers[i];
        // Store it in hiddenLayer to remove later

        if (!isLayerGroupDisplayed(t, true)) hiddenLayer.push(portalsLayers[i]);
    }

    store.fieldsFactionLayers = [L.layerGroup(), L.layerGroup(), L.layerGroup()];


    let fieldsLayer = L.layerGroup(store.fieldsFactionLayers);


    store.map.addLayer(fieldsLayer);
    addLayers['Fields'] = fieldsLayer;


    if (!isLayerGroupDisplayed('Fields', true)) hiddenLayer.push(fieldsLayer);


    store.linksFactionLayers = [L.layerGroup(), L.layerGroup(), L.layerGroup()];

    let linksLayer = L.layerGroup(store.linksFactionLayers);

    store.map.addLayer(linksLayer);
    addLayers['Links'] = linksLayer;
    // Store it in hiddenLayer to remove later

    if (!isLayerGroupDisplayed('Links', true)) hiddenLayer.push(linksLayer);

    // faction-specific layers
    // these layers don't actually contain any data. instead, every time they're added/removed from the map,
    // the matching sub-layers within the above portals/fields/links are added/removed from their parent with
    // the below 'onoverlayadd/onoverlayremove' events

    let factionLayers = [L.layerGroup(), L.layerGroup(), L.layerGroup()];
    for (let fac in factionLayers) {

        store.map.addLayer(factionLayers[fac]);
    }

    let setFactionLayersState = function (fac: number, enabled: boolean) {
        if (enabled) {

            if (!fieldsLayer.hasLayer(store.fieldsFactionLayers[fac])) fieldsLayer.addLayer(store.fieldsFactionLayers[fac]);


            if (!linksLayer.hasLayer(store.linksFactionLayers[fac])) linksLayer.addLayer(store.linksFactionLayers[fac]);
            for (let lvl in portalsLayers) {

                if (!portalsLayers[lvl].hasLayer(store.portalsFactionLayers[lvl][fac])) portalsLayers[lvl].addLayer(store.portalsFactionLayers[lvl][fac]);
            }
        } else {

            if (fieldsLayer.hasLayer(store.fieldsFactionLayers[fac])) fieldsLayer.removeLayer(store.fieldsFactionLayers[fac]);

            if (linksLayer.hasLayer(store.linksFactionLayers[fac])) linksLayer.removeLayer(store.linksFactionLayers[fac]);
            for (let lvl in portalsLayers) {

                if (portalsLayers[lvl].hasLayer(store.portalsFactionLayers[lvl][fac])) portalsLayers[lvl].removeLayer(store.portalsFactionLayers[lvl][fac]);
            }
        }
    }

    // to avoid any favouritism, we'll put the player's own faction layer first

    if (store.PLAYER.team == Team.ENLIGHTENED) {
        addLayers['Enlightened'] = factionLayers[TEAM_ENL];
        addLayers['Resistance'] = factionLayers[TEAM_RES];
    } else {
        addLayers['Resistance'] = factionLayers[TEAM_RES];
        addLayers['Enlightened'] = factionLayers[TEAM_ENL];
    }

    if (!isLayerGroupDisplayed('Resistance', true)) hiddenLayer.push(factionLayers[TEAM_RES]);

    if (!isLayerGroupDisplayed('Enlightened', true)) hiddenLayer.push(factionLayers[TEAM_ENL]);

    setFactionLayersState(TEAM_NONE, true);

    setFactionLayersState(TEAM_RES, isLayerGroupDisplayed('Resistance', true));

    setFactionLayersState(TEAM_ENL, isLayerGroupDisplayed('Enlightened', true));

    // NOTE: these events are fired by the layer chooser, so won't happen until that's created and added to the map

    store.map.on('overlayadd overlayremove', function (e: any) {
        let displayed = (e.type == 'overlayadd');
        switch (e.name) {
            case 'Resistance':
                setFactionLayersState(TEAM_RES, displayed);
                break;
            case 'Enlightened':
                setFactionLayersState(TEAM_ENL, displayed);
                break;
        }
    });

    let baseLayers = createDefaultBaseMapLayers();

    store.layerChooser = new L.Control.Layers(baseLayers, addLayers);

    // Remove the hidden layer after layerChooser built, to avoid messing up ordering of layers 
    // 
    $.each(hiddenLayer, function (ind, layer) {

        store.map.removeLayer(layer);

        // as users often become confused if they accidentally switch a standard layer off, display a warning in this case
        $('#portaldetails').html('<div class="layer_off_warning">' +
            '<p><b>Warning</b>: some of the standard layers are turned off. Some portals/links/fields will not be visible.</p>' +
            '<a id="enable_standard_layers">Enable standard layers</a>' +
            '</div>');

        $('#enable_standard_layers').on('click', function () {

            $.each(addLayers, function (ind, layer) {

                if (!store.map.hasLayer(layer)) store.map.addLayer(layer);
            });
            $('#portaldetails').html('');
        });

    });

    store.map.addControl(store.layerChooser);

    store.map.attributionControl.setPrefix('');
    // listen for changes and store them in cookies

    store.map.on('moveend', storeMapPosition);

    // map update status handling & update map hooks
    // ensures order of calls

    store.map.on('movestart', function () {

        store.mapRunsUserAction = true;
        requests.abort();
        startRefreshTimeout(-1);
    });

    store.map.on('moveend', function () {

        store.mapRunsUserAction = false;

        startRefreshTimeout(ON_MOVE_REFRESH * 1000);
    });

    // set a 'moveend' handler for the map to clear idle state. e.g. after mobile 'my location' is used.
    // possibly some cases when resizing desktop browser too

    store.map.on('moveend', idleReset);

    addResumeFunction(function () { startRefreshTimeout(ON_MOVE_REFRESH * 1000); });



    // create the map data requester

    store.mapDataRequest = new MapDataRequest();

    /*   debu(store.mapDataRequest.start); */

    // start the refresh process with a small timeout, so the first data request happens quickly
    // (the code originally called the request function directly, and triggered a normal delay for the next refresh.
    //  however, the moveend/zoomend gets triggered on map load, causing a duplicate refresh. this helps prevent that

    startRefreshTimeout(ON_MOVE_REFRESH * 1000);
};

//adds a base layer to the map. done separately from the above, so that plugins that add base layers can be the default
const setMapBaseLayer = () => {
    //create a map name -> layer mapping - depends on internals of L.Control.Layers
    let nameToLayer = {};
    let firstLayer = null;


    for (let i in store.layerChooser._layers) {
        // 
        let obj = store.layerChooser._layers[i];
        if (!obj.overlay) {
            nameToLayer[obj.name] = obj.layer;
            if (!firstLayer) firstLayer = obj.layer;
        }
    }

    let baseLayer = nameToLayer[window.localStorage['iitc-base-map']] || firstLayer;
    // 

    store.map.addLayer(baseLayer);

    // now we have a base layer we can set the map position
    // (setting an initial position, before a base layer is added, causes issues with leaflet)
    // 
    let pos = getPosition();
    // 



    store.map.setView(pos.center, pos.zoom,);



    //event to track layer changes and store the name
    // 
    store.map.on('baselayerchange', function (info: { layer: any; }) {

        // console.log("adding baselayerchange listener")
        // 
        for (let i in store.layerChooser._layers) {
            // 
            let obj = store.layerChooser._layers[i];
            if (info.layer === obj.layer) {
                window.localStorage['iitc-base-map'] = obj.name;
                break;
            }
        }

        //also, leaflet no longer ensures the base layer zoom is suitable for the map (a bug? feature change?), so do so here
        // 
        store.map.setZoom(store.map.getZoom());


    });


}

// renders player details into the website. Since the player info is
// included as inline script in the original site, the data is static
// and cannot be updated.
export const setupPlayerStat = function () {
    // stock site updated to supply the actual player level, AP requirements and XM capacity values


    let t = 'Level:\t' + store.PLAYER.verified_level + '\n' +

        'XM:\t' + store.PLAYER.energy + ' / ' + store.PLAYER.xm_capacity + '\n' +

        'AP:\t' + store.PLAYER.ap + '\n' +
        (store.PLAYER.min_ap_for_next_level > 0 ? 'level up in:\t' + store.PLAYER.lvlUpAp + ' AP' : 'Maximum level reached(!)') +

        '\n\Invites:\t' + store.PLAYER.available_invites +
        '\n\nNote: your player stats can only be updated by a full reload (F5)';

    $('#playerstat').html('' +
        '<h2 title="' + t + '">' + store.PLAYER.verified_level + '&nbsp;' +
        '<div id="name">' +

        '<span class="' + store.PLAYER.cls + '">' + store.PLAYER.nickname + '</span>' +
        '<a href="https://intel.ingress.com/logout" id="signout">sign out</a>' +
        '</div>' +
        '<div id="stats">' +
        '<sup>XM: ' + store.PLAYER.xmRatio + '%</sup>' +
        '<sub>' + (store.PLAYER.min_ap_for_next_level > 0 ? 'level: ' + store.PLAYER.lvlApProg + '%' : 'max level') + '</sub>' +
        '</div>' +
        '</h2>'
    );


}

const setupSidebarToggle = function () {


    $('#sidebartoggle').on('click', function () {
        let toggle = $('#sidebartoggle');
        let sidebar = $('#scrollwrapper');
        if (sidebar.is(':visible')) {
            sidebar.hide();
            $('.leaflet-right').css('margin-right', '0');
            toggle.html('<span class="toggle open"></span>');
            toggle.css('right', '0');
        } else {
            sidebar.show();

            resetScrollOnNewPortal();
            $('.leaflet-right').css('margin-right', SIDEBAR_WIDTH + 1 + 'px');
            toggle.html('<span class="toggle close"></span>');
            toggle.css('right', SIDEBAR_WIDTH + 1 + 'px');
        }
        $('.ui-tooltip').remove();
    });
}

const setupTooltips = function (element?: JQuery<any>) {
    element = element || $(document);


    console.log(element, element.attr('title'));


    /* .tooltip({
        // disable show/hide animation
        show: { effect: 'none', duration: 0, delay: 350 },
        hide: false,
        open: function (event, ui) {
            // ensure all other tooltips are closed
            $(".ui-tooltip").not((<any>ui).tooltip).remove();
        },
        content: function () {
            let title = $(this).attr('title');
          
            return convertTextToTableMagic(title);
        }
    }); */

    // @ts-ignore
    if (!window.tooltipClearerHasBeenSetup) {
        // @ts-ignore
        window.tooltipClearerHasBeenSetup = true;
        $(document).on('click', '.ui-tooltip', function () { $(this).remove(); });
    }
}




const setupLayerChooserApi = function () {
    // hide layer chooser if booted with the iitcm android app
    // @ts-ignore
    if (typeof android !== 'undefined' && android && android.setLayers) {
        $('.leaflet-control-layers').hide();
    }

    //hook some additional code into the LayerControl so it's easy for the mobile app to interface with it
    //WARNING: does depend on internals of the L.Control.Layers code
    // 

    store.layerChooser.getLayers = function () {
        let baseLayers = [];
        let overlayLayers = [];
        this._layers.forEach(function (obj: { layer: any; name: any; overlay: any; }, idx: any) {
            // 
            let layerActive = store.map.hasLayer(obj.layer);
            let info = {
                layerId: idx,
                name: obj.name,
                active: layerActive
            }
            if (obj.overlay) {
                overlayLayers.push(info);
            } else {
                baseLayers.push(info);
            }
        });

        let overlayLayersJSON = JSON.stringify(overlayLayers);
        let baseLayersJSON = JSON.stringify(baseLayers);

        // @ts-ignore
        if (typeof android !== 'undefined' && android && android.setLayers) {
            if (this.androidTimer) clearTimeout(this.androidTimer);
            this.androidTimer = setTimeout(function () {
                this.androidTimer = null;
                // @ts-ignore
                android.setLayers(baseLayersJSON, overlayLayersJSON);
            }, 1000);
        }

        return {
            baseLayers: baseLayers,
            overlayLayers: overlayLayers
        }
    }


    store.layerChooser.showLayer = function (id: string, show: boolean) {
        if (show === undefined) show = true;
        const obj = this._layers[id];
        if (!obj) return false;

        if (show) {
            if (!this._map.hasLayer(obj.layer)) {
                //the layer to show is not currently active
                this._map.addLayer(obj.layer);

                //if it's a base layer, remove any others
                if (!obj.overlay) {
                    for (let i in this._layers) {
                        if (i != id) {
                            let other = this._layers[i];
                            if (!other.overlay && this._map.hasLayer(other.layer)) this._map.removeLayer(other.layer);
                        }
                    }
                }
            }
        } else {
            if (this._map.hasLayer(obj.layer)) {
                this._map.removeLayer(obj.layer);
            }
        }



        //below logic based on code in L.Control.Layers _onInputClick
        if (!obj.overlay) {
            this._map.setZoom(this._map.getZoom());
            this._map.fire('baselayerchange', { layer: obj.layer });
        }

        return true;
    };

    // 
    let _update = store.layerChooser._update;
    // 
    store.layerChooser._update = function () {
        // update layer menu in IITCm
        try {
            // @ts-ignore
            if (typeof android !== 'undefined')

                store.layerChooser.getLayers();
        } catch (e) {
            console.error(e);
        }
        // call through
        return _update.apply(this, arguments);
    }
    // as this setupLayerChooserApi function is called after the layer menu is populated, we need to also get they layers once
    // so they're passed through to the android app
    try {
        // @ts-ignore
        if (typeof android !== 'undefined')
            store.layerChooser.getLayers();
    } catch (e) {
        console.error(e);
    }
}


const extendLeaflet = function () {

    let markerImage = new Image()
    markerImage.src = markerUrl

    let imageMarker2x = new Image()
    imageMarker2x.src = marker2xUrl

    let imageMarkerShadow = new Image()
    imageMarkerShadow.src = markerShadowUrl

    L.Icon.Default.mergeOptions({
        iconUrl: markerImage,
        iconRetinaUrl: imageMarker2x,
        shadowUrl: imageMarkerShadow
    });

    L.Icon.Default.imagePath = ' '; // in order to suppress _detectIconPath (it fails with data-urls)

    $(['<svg>',
        // search.js, distance-to-portal.user.js, draw-tools.user.js
        '<symbol id="marker-icon" viewBox="0 0 25 41">',
        '<path d="M1.36241844765,18.67488124675 A12.5,12.5 0 1,1 23.63758155235,18.67488124675 L12.5,40.5336158073 Z" style="stroke:none;" />',
        '<path d="M1.80792170975,18.44788599685 A12,12 0 1,1 23.19207829025,18.44788599685 L12.5,39.432271175 Z" style="stroke:#000000; stroke-width:1px; stroke-opacity: 0.15; fill: none;" />',
        '<path d="M2.921679865,17.8803978722 A10.75,10.75 0 1,1 22.078320135,17.8803978722 L12.5,36.6789095943 Z" style="stroke:#ffffff; stroke-width:1.5px; stroke-opacity: 0.35; fill: none;" />',
        '<path d="M19.86121593215,17.25 L12.5,21.5 L5.13878406785,17.25 L5.13878406785,8.75 L12.5,4.5 L19.86121593215,8.75 Z M7.7368602792,10.25 L17.2631397208,10.25 L12.5,18.5 Z M12.5,13 L7.7368602792,10.25 M12.5,13 L17.2631397208,10.25 M12.5,13 L12.5,18.5 M19.86121593215,17.25 L16.39711431705,15.25 M5.13878406785,17.25 L8.60288568295,15.25 M12.5,4.5 L12.5,8.5" style="stroke:#ffffff; stroke-width:1.25px; stroke-opacity: 1; fill: none;" />',
        '</symbol>',
        '</svg>'
    ].join('\\n')).appendTo('body');

    /*  class DivFuckingIcon extends L.DivIcon {
         options: {
             iconSize: [number, number],
             iconAnchor: [number, number],
             className: string,
             // ^ actually any name, just to prevent default
             // ^ (as it's inappropriately styled)
             svgTemplate: string,
             color: string // for draw-tools:
             // L.divIcon does not use the option `color`, but we store it here to
             // be able to simply retrieve the color for serializing markers
             html: string
         }

       constructor(options) {
           super();

           this.options = options
       }
      

       initialize(color: string, options: {color:string}) {
           // 
           this.initialize.call(this, options);
           if (color) { this.options.color = color; }
           // 
           this.options.html = L.Util.template(
               this.options.svgTemplate, { color: this.options.color }
           );
       }

     }
      */


    /*  L.DivIcon.prototype.ColoredSvg = L.DivIcon.extend({
         options: {
             iconSize: [25, 41],
             iconAnchor: [12, 41],
             className: 'leaflet-div-icon-iitc-generic-marker',
             // ^ actually any name, just to prevent default
             // ^ (as it's inappropriately styled)
             svgTemplate: '<svg style="fill: {color}"><use xlink:href="#marker-icon"/></svg>',
             color: '#a24ac3' // for draw-tools:
             // L.divIcon does not use the option `color`, but we store it here to
             // be able to simply retrieve the color for serializing markers
         },
         initialize: function (color: any, options: any) {
             // 
             L.DivIcon.prototype.initialize.call(this, options);
             if (color) { this.options.color = color; }
             // 
             this.options.html = L.Util.template(
                 this.options.svgTemplate, { color: this.options.color }
             );
         }
     }); */
    // 
    /*   L.divIcon = function (color: any, options: any) {
          // 
          return new DivFuckingIcon({
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            className: 'leaflet-div-icon-iitc-generic-marker',
            // ^ actually any name, just to prevent default
            // ^ (as it's inappropriately styled)
            svgTemplate: '<svg style="fill: {color}"><use xlink:href="#marker-icon"/></svg>',
            color: '#a24ac3' // for draw-tools:
            // L.divIcon does not use the option `color`, but we store it here to
            // be able to simply retrieve the color for serializing markers
        })
      }; */

    // use the earth radius value from s2 geometry library
    // https://github.com/google/s2-geometry-library-java/blob/c28f287b996c0cedc5516a0426fbd49f6c9611ec/src/com/google/common/geometry/S2LatLng.java#L31
    let EARTH_RADIUS_METERS = 6367000.0;
    // distance calculations with that constant are a little closer to values observable in Ingress client.
    // difference is:
    // - ~0.06% when using LatLng.distanceTo() (R is 6371 vs 6367)
    // - ~0.17% when using Map.distance() / CRS.destance() (R is 6378.137 vs 6367)
    // (Yes, Leaflet is not consistent here, e.g. see https://github.com/Leaflet/Leaflet/pull/6928)

    // this affects LatLng.distanceTo(), which is currently used in most iitc plugins
    // @ts-ignore
    L.CRS.Earth.R = EARTH_RADIUS_METERS;

    // this affects Map.distance(), which is known to be used in draw-tools
    // 



    let SphericalMercator = L.Projection.SphericalMercator;
    // @ts-ignore
    SphericalMercator.S2 = L.Util.extend({}, SphericalMercator, {
        R: EARTH_RADIUS_METERS,
        bounds: (function () {
            let d = EARTH_RADIUS_METERS * Math.PI;
            // 
            return L.bounds([-d, -d], [d, d]);
        })()
    });
    // @ts-ignore
    L.CRS.S2 = L.Util.extend({}, L.CRS.Earth, {
        code: 'Ingress',
        // @ts-ignore
        projection: SphericalMercator.S2,
        transformation: (function () {
            // @ts-ignore
            let scale = 0.5 / (Math.PI * SphericalMercator.S2.R);
            // 
            return L.transformation(scale, 0.5, -scale, 0.5);
        }())
    });

    /* !!This block is commented out as it's unlikely that we still need this workaround in leaflet 1+
    // on zoomend, check to see the zoom level is an int, and reset the view if not
    // (there's a bug on mobile where zoom levels sometimes end up as fractional levels. this causes the base map to be invisible)
    map.on('zoomend', function() {
      let z = map.getZoom();
      if (z != parseInt(z))
      {
        log.warn('Non-integer zoom level at zoomend: '+z+' - trying to fix...');
        map.setZoom(parseInt(z), {animate:false});
      }
    });
    */

    /* !!This block is commented out as it's unlikely that we still need this workaround in leaflet 1+
    // Fix Leaflet: handle touchcancel events in Draggable
    L.Draggable.prototype._onDownOrig = L.Draggable.prototype._onDown;
    L.Draggable.prototype._onDown = function(e) {
      L.Draggable.prototype._onDownOrig.apply(this, arguments);

      if(e.type === "touchstart") {
        L.DomEvent.on(document, "touchcancel", this._onUp, this);
      }
    };
    */
};

// BOOTING ///////////////////////////////////////////////////////////

function prepPluginsToLoad() {

    let priorities = {
        lowest: 100,
        low: 75,
        normal: 50,
        high: 25,
        highest: 0,
        boot: -100
    }

    function getPriority(data: { priority: any; }) {
        let v = data && data.priority || 'normal';
        let prio = v in priorities ? priorities[v] : v;
        if (typeof prio !== 'number') {

            prio = priorities.normal;
        }
        return prio;
    }
    // @ts-ignore
    if (!window.script_info.script) {
        /* log.warn('GM_info is not provided (improper userscript manager?)'); // IITC-Mobile for iOS */
    }

    // executes setup function of plugin
    // and collects info for About IITC
    function safeSetup(setup: { info: any; call: (arg0: any) => void; }) {
        if (!setup) {
            /*  log.warn('plugin must provide setup function'); */
            return;
        }
        let info = setup.info;
        if (typeof info !== 'object') {
            /*    log.warn('plugin does not have proper wrapper:', setup); */
            info = {};
        }
        try {
            setup.call(this);
        } catch (err) {
            /* let name = info.script && info.script.name || info.pluginId; */
            /*  log.error('error starting plugin:', name, ', error:', err); */
            info.error = err;
        }
        pluginsInfo.push(info);
    }
    // @ts-ignore
    if (window.bootPlugins) { // sort plugins by priority
        // @ts-ignore
        window.bootPlugins.sort(function (a: any, b: any) {
            return getPriority(a) - getPriority(b);
        });
    } else {
        // @ts-ignore
        window.bootPlugins = [];
    }

    let pluginsInfo = []; // for About IITC
    // @ts-ignore
    window.bootPlugins.info = pluginsInfo;

    // loader function returned
    // if called with parameter then load plugins with priorities up to specified
    return function (prio: string | number) {
        // @ts-ignore
        while (window.bootPlugins[0]) {
            // @ts-ignore
            if (prio && getPriority(window.bootPlugins[0]) > priorities[prio]) { break; }
            // @ts-ignore
            safeSetup(window.bootPlugins.shift());
        }
    };
}


export const boot = function () {
  
    runOnSmartphonesBeforeBoot()

    const loadPlugins = prepPluginsToLoad();
    loadPlugins('boot')

    extendLeaflet()
    extractFromStock()
    setupIdle()
    setupStyles()
    setupIcons()
    setupDialogs()
    setupDataTileParams()
    setupMap()
    setupOMS()
    search.setup()
    setupRedeem()
    setupLargeImagePreview()
    setupSidebarToggle()

    updateGameScore()
    store.artifact = new Artifact();
    ornaments.setup()
    setupPlayerStat()
    setupTooltips();

    store.chat = new Chat()
    store.portalDetail = new PortalDetail()

    setupLayerChooserSelectOne()
    setupLayerChooserStatusRecorder()

    // read here ONCE, so the URL is only evaluated one time after the
    // necessary data has been loaded.
    let pll = getURLParam('pll');

    if (pll) {
        let pllArr = pll.split(",");
        store.urlPortalLL = [parseFloat(pllArr[0]) || 0.0, parseFloat(pllArr[1]) || 0.0];
    }

    store.urlPortal = getURLParam('pguid');
    loadPlugins(null);
    setMapBaseLayer();
    setupLayerChooserApi();
    runOnSmartphonesAfterBoot();
    runHooks('iitcLoaded');

     // fixed Addons
    const rboard = new RegionScoreboard()

    rboard.setup()

}

/*
OMS doesn't cancel the original click event, so the topmost marker will get a click event while spiderfying.
Also, OMS only supports a global callback for all managed markers. Therefore, we will use a custom event that gets fired
for each marker.
*/


const setupOMS = function () {
    // 
    store.oms = new OverlappingMarkerSpiderfier(store.map, {
        keepSpiderfied: true,
        legWeight: 3.5,
        legColors: {
            usual: '#FFFF00',
            highlighted: '#FF0000'
        }
    });


    store.oms.addListener('click', function (marker: { fireEvent: (arg0: string, arg1: { target: any; }) => void; }) {

        store.map.closePopup();
        marker.fireEvent('spiderfiedclick', { target: marker });
    });

    store.oms.addListener('spiderfy', function (markers: any) {

        store.map.closePopup();
    });

    (store.map as any)._container.addEventListener("keypress", function (ev: { keyCode: number; }) {
        if (ev.keyCode === 27) // Esc

            store.oms.unspiderfy();
    }, false);
}


export const registerMarkerForOMS = function (marker: { on: (arg0: string, arg1: { (): void; (): void; }) => void; _map: any; }) {
    marker.on('add', function () {

        store.oms.addMarker(marker);
    });
    marker.on('remove', function () {

        store.oms.removeMarker(marker);
    });
    if (marker._map) // marker has already been added

        store.oms.addMarker(marker);
}

