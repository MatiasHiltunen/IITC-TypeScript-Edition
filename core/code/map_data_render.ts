// MAP DATA RENDER ////////////////////////////////////////////////
// class to handle rendering into leaflet the JSON data from the servers



import L from 'leaflet';
import { GeodesicLine } from 'leaflet.geodesic'
import { store } from './store'
import { COLORS, DEFAULT_ZOOM, TEAM_NONE } from "./config";
import { decodeArray } from "./entity_decode";
import { teamStringToId } from "./entity_info";
import { runHooks } from "./hooks";
import { ornaments } from "./ornaments";
import { show } from "./panes";
import { pushPortalGuidPositionCache } from "./portal_data";
import { renderPortalDetails } from "./portal_detail_display";
import { resetHighlightedPortals } from "./portal_highlighter";
import { createMarker, portalMarkerScale } from "./portal_marker";
import { isSmartphone } from "./smartphone";
import $ from "jquery"




export class Render {
  portalMarkerScale?: number;
  deletedGuid: {};
  isRendering: boolean;
  seenLinksGuid: {};
  seenPortalsGuid: {};
  seenFieldsGuid: {};
  bounds: L.LatLngBounds;
  level: number;

  constructor() {
    this.portalMarkerScale = undefined;

  }
  // start a render pass. called as we start to make the batch of data requests to the servers
  startRenderPass(level: number, bounds: L.LatLngBounds) {

    this.isRendering = true;

    this.deletedGuid = {};  // object - represents the set of all deleted game entity GUIDs seen in a render pass

    this.seenPortalsGuid = {};
    this.seenLinksGuid = {};
    this.seenFieldsGuid = {};

    this.bounds = bounds;
    this.level = level;

    // we pad the bounds used for clearing a litle bit, as entities are sometimes returned outside of their specified tile boundaries
    // this will just avoid a few entity removals at start of render when they'll just be added again
    let paddedBounds = bounds.pad(0.1);

    this.clearPortalsOutsideBounds(paddedBounds);

    this.clearLinksOutsideBounds(paddedBounds);
    this.clearFieldsOutsideBounds(paddedBounds);


    this.rescalePortalMarkers();
  }

  clearPortalsOutsideBounds(bounds) {
    let count = 0;
    for (let guid in store.portals) {
      let p = store.portals[guid];
      // clear portals outside visible bounds - unless it's the selected portal, or it's relevant to artifacts
      if (!bounds.contains(p.getLatLng()) && guid !== store.selectedPortal && !store.artifact.isInterestingPortal(guid)) {
        this.deletePortalEntity(guid);
        count++;
      }
    }
  }

  clearLinksOutsideBounds(bounds: L.LatLngBounds) {

    for (let guid in store.links) {
      let l = store.links[guid];

      // NOTE: our geodesic lines can have lots of intermediate points. the bounds calculation hasn't been optimised for this
      // so can be particularly slow. a simple bounds check based on start+end point will be good enough for this check
      let lls = l.getLatLngs();
      let linkBounds = L.latLngBounds(lls);

   
      if (!bounds.intersects(linkBounds)) {
        this.deleteLinkEntity(guid);
      }
    }
  }

  clearFieldsOutsideBounds(bounds) {
    let count = 0;
    for (let guid in store.fields) {
      let f = store.fields[guid];

      // NOTE: our geodesic polys can have lots of intermediate points. the bounds calculation hasn't been optimised for this
      // so can be particularly slow. a simple bounds check based on corner points will be good enough for this check
      let lls = f.getLatLngs();
      let fieldBounds = L.latLngBounds([lls[0], lls[1]]).extend(lls[2]);

      if (!bounds.intersects(fieldBounds)) {
        this.deleteFieldEntity(guid);
        count++;
      }
    }
  }


  // process deleted entity list and entity data
  processTileData(tiledata) {
    this.processDeletedGameEntityGuids(tiledata.deletedGameEntityGuids || []);
    this.processGameEntities(tiledata.gameEntities || []);
  }


  processDeletedGameEntityGuids(deleted) {
    for (let i in deleted) {
      let guid: string = deleted[i];

      if (!(guid in this.deletedGuid)) {
        this.deletedGuid[guid] = true;  // flag this guid as having being processed

        if (guid == store.selectedPortal) {
          // the rare case of the selected portal being deleted. clear the details tab and deselect it
          renderPortalDetails(null);
        }

        this.deleteEntity(guid);

      }
    }

  }

  processGameEntities(entities, details?) { // details expected in decodeArray.portal

    // we loop through the entities three times - for fields, links and portals separately
    // this is a reasonably efficient work-around for leafletjs limitations on svg render order


    for (let ent of entities) {
 
      if (ent[2][0] == 'r' && !(ent[0] in this.deletedGuid)) {
        this.createFieldEntity(ent);
      }

      if (ent[2][0] == 'e' && !(ent[0] in this.deletedGuid)) {
        this.createLinkEntity(ent);
      }

      if (ent[2][0] == 'p' && !(ent[0] in this.deletedGuid)) {
        this.createPortalEntity(ent, details);
      }
    }
  }


  // end a render pass. does any cleaning up required, postponed processing of data, etc. called when the render
  // is considered complete
  endRenderPass() {
    let countp = 0, countl = 0, countf = 0;

    // check to see if there are any entities we haven't seen. if so, delete them
    for (let guid in store.portals) {

      // special case for selected portal - it's kept even if not seen
      // artifact (e.g. jarvis shard) portals are also kept - but they're always 'seen'
      if (!(guid in this.seenPortalsGuid) && guid !== store.selectedPortal) {
        this.deletePortalEntity(guid);
        countp++;
      }
    }
    for (let guid in store.links) {
      if (!(guid in this.seenLinksGuid)) {
        this.deleteLinkEntity(guid);
        countl++;
      }
    }
    for (let guid in store.fields) {
      if (!(guid in this.seenFieldsGuid)) {
        this.deleteFieldEntity(guid);
        countf++;
      }
    }

    console.log('Render: end cleanup: removed ' + countp + ' portals, ' + countl + ' links, ' + countf + ' fields');

    // reorder portals to be after links/fields
    /* this.bringPortalsToFront(); */

    this.isRendering = false;

    // re-select the selected portal, to re-render the side-bar. ensures that any data calculated from the map data is up to date
    if (store.selectedPortal) {

      renderPortalDetails(store.selectedPortal);
    }
  }

  // Completely useless for now
/* 
  bringPortalsToFront() { */

   /*  const interestingPortals:[] = store.artifact.getInterestingPortals()

    for (let lvl in store.portalsFactionLayers) {
      // portals are stored in separate layers per faction
      // to avoid giving weight to one faction or another, we'll push portals to front based on GUID order
      let lvlPortals = {};
      for (let fac in store.portalsFactionLayers[lvl]) {

        store.portalsFactionLayers[lvl][fac].eachLayer((p) => {

          // @ts-ignore
          lvlPortals[p.options.guid] = p;
          p.b
        });

      }

      let guids = Object.keys(lvlPortals);

           console.log(guids)
           guids.sort();
           console.log("after sort: ",guids)
     
      for (let j in guids) {
        let guid = guids[j];
        lvlPortals[guid].bringToFront();
      }
    }

    store.artifact.getInterestingPortals().forEach(guid => {
      if (store.portals[guid] && store.portals[guid]._map) {
        store.portals[guid].bringToFront();
      }
    }); */

    // artifact portals are always brought to the front, above all others
    /* $.each(store.artifact.getInterestingPortals(), function (i, guid) {
      if (store.portals[guid] && store.portals[guid]._map) {
        store.portals[guid].bringToFront();
      }
    }); */

/*   } */


  deleteEntity = function (guid) {
    this.deletePortalEntity(guid);
    this.deleteLinkEntity(guid);
    this.deleteFieldEntity(guid);
  }

  deletePortalEntity = function (guid) {
    if (guid in store.portals) {
      let p = store.portals[guid];
      ornaments.removePortal(p);
      this.removePortalFromMapLayer(p);
      delete store.portals[guid];
      runHooks('portalRemoved', { portal: p, data: p.options.data });
    }
  }

  deleteLinkEntity = function (guid) {
    if (guid in store.links) {
      let l = store.links[guid];
      if (store.linksFactionLayers[l.options.team]) store.linksFactionLayers[l.options.team].removeLayer(l);
      delete store.links[guid];
      runHooks('linkRemoved', { link: l, data: l.options.data });
    }
  }


  deleteFieldEntity = function (guid) {
    if (guid in store.fields) {
      let f = store.fields[guid];

      store.fieldsFactionLayers[f.options.team].removeLayer(f);
      delete store.fields[guid];
      runHooks('fieldRemoved', { field: f, data: f.options.data });
    }
  }


  createPlaceholderPortalEntity(guid, latE6, lngE6, team) {
    // intel no longer returns portals at anything but the closest zoom
    // stock intel creates 'placeholder' portals from the data in links/fields - IITC needs to do the same
    // we only have the portal guid, lat/lng coords, and the faction - no other data
    // having the guid, at least, allows the portal details to be loaded once it's selected. however,
    // no highlighters, portal level numbers, portal names, useful counts of portals, etc are possible


    let ent = [
      guid,       //ent[0] = guid
      0,          //ent[1] = timestamp - zero will mean any other source of portal data will have a higher timestamp
      //ent[2] = an array with the entity data
      ['p',      //0 - a portal
        team,     //1 - team
        latE6,    //2 - lat
        lngE6     //3 - lng
      ]
    ];

    // placeholder portals don't have a useful timestamp value - so the standard code that checks for updated
    // portal details doesn't apply
    // so, check that the basic details are valid and delete the existing portal if out of date
    if (guid in store.portals) {
      let p = store.portals[guid];
      if (team != p.options.data.team || latE6 != p.options.data.latE6 || lngE6 != p.options.data.lngE6) {
        // team or location have changed - delete existing portal
        this.deletePortalEntity(guid);
      }
    }

    this.createPortalEntity(ent, 'core'); // placeholder

  }


  createPortalEntity(ent, details) { // details expected in decodeArray.portal
    this.seenPortalsGuid[ent[0]] = true;  // flag we've seen it

    let previousData = undefined;

    let data = decodeArray.portal(ent[2], details);

    // check if entity already exists
    if (ent[0] in store.portals) {
      // yes. now check to see if the entity data we have is newer than that in place
      let p = store.portals[ent[0]];

      if (!data.history || p.options.data.history === data.history)
        if (p.options.timestamp >= ent[1]) {
          return; // this data is identical or older - abort processing
        }

      // the data we have is newer. many data changes require re-rendering of the portal
      // (e.g. level changed, so size is different, or stats changed so highlighter is different)
      // so to keep things simple we'll always re-create the entity in this case

      // remember the old details, for the callback

      previousData = p.options.data;

      // preserve history
      if (!data.history) {
        data.history = previousData.history;
      }

      this.deletePortalEntity(ent[0]);
    }

    let portalLevel = parseInt(data.level) || 0;
    let team = teamStringToId(data.team);
    // the data returns unclaimed portals as level 1 - but IITC wants them treated as level 0
    if (team == TEAM_NONE) portalLevel = 0;

    let latlng = L.latLng(data.latE6 / 1E6, data.lngE6 / 1E6);

    let dataOptions = {
      level: portalLevel,
      team: team,
      ent: ent,  // LEGACY - TO BE REMOVED AT SOME POINT! use .guid, .timestamp and .data instead
      guid: ent[0],
      timestamp: ent[1],
      data: data
    };

    pushPortalGuidPositionCache(ent[0], data.latE6, data.lngE6);

    let marker = createMarker(latlng, dataOptions);

    function handler_portal_click(e) {
      renderPortalDetails(e.target.options.guid);
    }
    function handler_portal_dblclick(e) {
      renderPortalDetails(e.target.options.guid);

      store.map.setView(e.target.getLatLng(), DEFAULT_ZOOM);
    }
    function handler_portal_contextmenu(e) {
      console.log("handler_portal_contextmenu DOES IT GET HERE?")
      renderPortalDetails(e.target.options.guid);
      if (isSmartphone()) {
        show('info');
      } else if (!$('#scrollwrapper').is(':visible')) {
        $('#sidebartoggle').click();
      }
    }

    marker.on('click', handler_portal_click);
    marker.on('dblclick', handler_portal_dblclick);
    marker.on('contextmenu', handler_portal_contextmenu);

    runHooks('portalAdded', { portal: marker, previousData: previousData });

    store.portals[ent[0]] = marker;

    // check for URL links to portal, and select it if this is the one
    if (store.urlPortalLL && store.urlPortalLL[0] == marker.getLatLng().lat && store.urlPortalLL[1] == marker.getLatLng().lng) {
      // URL-passed portal found via pll parameter - set the guid-based parameter
      /*  log.log('urlPortalLL '+urlPortalLL[0]+','+urlPortalLL[1]+' matches portal GUID '+ent[0]); */

      store.urlPortal = ent[0];
      store.urlPortalLL = undefined;  // clear the URL parameter so it's not matched again
    }
    if (store.urlPortal == ent[0]) {
      // URL-passed portal found via guid parameter - set it as the selected portal
      /*   log.log('urlPortal GUID '+store.urlPortal+' found - selecting...'); */
      store.selectedPortal = ent[0];
      store.urlPortal = undefined;  // clear the URL parameter so it's not matched again
    }

    // (re-)select the portal, to refresh the sidebar on any changes
    if (ent[0] == store.selectedPortal) {
      /*  log.log('portal guid '+ent[0]+' is the selected portal - re-rendering portal details'); */
      renderPortalDetails(store.selectedPortal);
    }

    ornaments.addPortal(marker);

    //TODO? postpone adding to the map layer
    this.addPortalToMapLayer(marker);

  }


  createFieldEntity(ent) {
    this.seenFieldsGuid[ent[0]] = true;  // flag we've seen it

    let data = {
      //    type: ent[2][0],
      team: ent[2][1],
      points: ent[2][2].map(function (arr) { return { guid: arr[0], latE6: arr[1], lngE6: arr[2] }; })
    };

    //create placeholder portals for field corners. we already do links, but there are the odd case where this is useful
    for (let i = 0; i < 3; i++) {
      let p = data.points[i];
      this.createPlaceholderPortalEntity(p.guid, p.latE6, p.lngE6, data.team);
    }

    // check if entity already exists
    if (ent[0] in store.fields) {
      // yes. in theory, we should never get updated data for an existing field. they're created, and they're destroyed - never changed
      // but theory and practice may not be the same thing...
      let f = store.fields[ent[0]];

      if (f.options.timestamp >= ent[1]) return; // this data is identical (or order) than that rendered - abort processing

      // the data we have is newer - two options
      // 1. just update the data, assume the field render appearance is unmodified
      // 2. delete the entity, then re-create with the new data
      this.deleteFieldEntity(ent[0]); // option 2, for now
    }

    let team = teamStringToId(ent[2][1]);
    let latlngs = [
      L.latLng(data.points[0].latE6 / 1E6, data.points[0].lngE6 / 1E6),
      L.latLng(data.points[1].latE6 / 1E6, data.points[1].lngE6 / 1E6),
      L.latLng(data.points[2].latE6 / 1E6, data.points[2].lngE6 / 1E6)
    ];
    let poly = new GeodesicLine(latlngs, {
      fillColor: COLORS[team],
      fillOpacity: 0.25,
      stroke: false,
      interactive: false,
      // @ts-ignore
      team: team,
      ent: ent,  // LEGACY - TO BE REMOVED AT SOME POINT! use .guid, .timestamp and .data instead
      guid: ent[0],
      timestamp: ent[1],
      data: data,
      fill: true,
    });

    runHooks('fieldAdded', { field: poly });

    store.fields[ent[0]] = poly;

    // TODO? postpone adding to the layer??
    store.fieldsFactionLayers[team].addLayer(poly);
  }

  createLinkEntity(ent, faked?) {
    // Niantic have been faking link entities, based on data from fields
    // these faked links are sent along with the real portal links, causing duplicates
    // the faked ones all have longer GUIDs, based on the field GUID (with _ab, _ac, _bc appended)
    let fakedLink = new RegExp("^[0-9a-f]{32}\.b_[ab][bc]$"); //field GUIDs always end with ".b" - faked links append the edge identifier
    if (fakedLink.test(ent[0])) return;


    this.seenLinksGuid[ent[0]] = true;  // flag we've seen it

    let data = { // TODO add other properties and check correction direction
      //    type:   ent[2][0],
      team: ent[2][1],
      oGuid: ent[2][2],
      oLatE6: ent[2][3],
      oLngE6: ent[2][4],
      dGuid: ent[2][5],
      dLatE6: ent[2][6],
      dLngE6: ent[2][7]
    };

    // create placeholder entities for link start and end points (before checking if the link itself already exists
    this.createPlaceholderPortalEntity(data.oGuid, data.oLatE6, data.oLngE6, data.team);
    this.createPlaceholderPortalEntity(data.dGuid, data.dLatE6, data.dLngE6, data.team);


    // check if entity already exists
    if (ent[0] in store.links) {
      // yes. now, as sometimes links are 'faked', they have incomplete data. if the data we have is better, replace the data
      let l = store.links[ent[0]];

      // the faked data will have older timestamps than real data (currently, faked set to zero)
      if (l.options.timestamp >= ent[1]) return; // this data is older or identical to the rendered data - abort processing

      // the data is newer/better - two options
      // 1. just update the data. assume the link render appearance is unmodified
      // 2. delete the entity, then re-create it with the new data
      this.deleteLinkEntity(ent[0]); // option 2 - for now
    }


    let team = teamStringToId(ent[2][1]);
    let latlngs = [

      L.latLng(data.oLatE6 / 1E6, data.oLngE6 / 1E6),
      L.latLng(data.dLatE6 / 1E6, data.dLngE6 / 1E6)
    ];
    let poly = new GeodesicLine(latlngs, {
      color: COLORS[team],
      opacity: 1,
      weight: faked ? 1 : 2,
      interactive: false,
      // @ts-ignore
      ent: ent,
      guid: ent[0],
      timestamp: ent[1],
      data: data
    });


    runHooks('linkAdded', { link: poly });

    store.links[ent[0]] = poly;

    store.linksFactionLayers[team].addLayer(poly);
  }



  rescalePortalMarkers() {
    if (this.portalMarkerScale === undefined || this.portalMarkerScale != portalMarkerScale()) {
      this.portalMarkerScale = portalMarkerScale();

      /*  log.log('Render: map zoom '+map.getZoom()+' changes portal scale to '+portalMarkerScale()+' - redrawing all portals'); */

      //NOTE: we're not calling this because it resets highlights - we're calling it as it
      // resets the style (inc size) of all portal markers, applying the new scale
      resetHighlightedPortals();
    }
  }



  // add the portal to the visible map layer
  addPortalToMapLayer(portal) {
    store.portalsFactionLayers[parseInt(portal.options.level) || 0][portal.options.team].addLayer(portal);
  }

  removePortalFromMapLayer(portal) {
    //remove it from the portalsLevels layer
    store.portalsFactionLayers[parseInt(portal.options.level) || 0][portal.options.team].removeLayer(portal);
  }

}
