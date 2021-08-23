// PORTAL MARKER //////////////////////////////////////////////
// code to create and update a portal marker

import L from "leaflet";
import { COLORS, COLOR_SELECTED_PORTAL, TEAM_NONE } from "./config";
import { highlightPortal } from "./portal_highlighter";
import { store } from "./store";

export const portalMarkerScale = function() : number {

  let zoom = store.map.getZoom();
  if (L.Browser.mobile)
    return zoom >= 16 ? 1.5 : zoom >= 14 ? 1.2 : zoom >= 11 ? 1.0 : zoom >= 8 ? 0.65 : 0.5;
  else
    return zoom >= 14 ? 1 : zoom >= 11 ? 0.8 : zoom >= 8 ? 0.65 : 0.5;
}

// create a new marker. 'data' contain the IITC-specific entity data to be stored in the object options
export const createMarker = function(latlng, data) {
  let styleOptions = getMarkerStyleOptions(data);

  let options = L.extend({}, data, styleOptions, { interactive: true });

  let marker = L.circleMarker(latlng, options);

  highlightPortal(marker);

  return marker;
}


export const setMarkerStyle = function(marker, selected) {

  let styleOptions = getMarkerStyleOptions(marker.options);

  marker.setStyle(styleOptions);

  // FIXME? it's inefficient to set the marker style (above), then do it again inside the highlighter
  // the highlighter API would need to be changed for this to be improved though. will it be too slow?
  highlightPortal(marker);

  if (selected) {
    marker.setStyle ({color: COLOR_SELECTED_PORTAL});
  }
}


export const getMarkerStyleOptions = function(details) {
  let scale = portalMarkerScale();

  //   portal level      0  1  2  3  4  5  6  7  8
  let LEVEL_TO_WEIGHT = [2, 2, 2, 2, 2, 3, 3, 4, 4];
  let LEVEL_TO_RADIUS = [7, 7, 7, 7, 8, 8, 9,10,11];

  let level = Math.floor(details.level||0);

  let lvlWeight = LEVEL_TO_WEIGHT[level] * Math.sqrt(scale);
  let lvlRadius = LEVEL_TO_RADIUS[level] * scale;

  let dashArray = null;
  // thinner and dashed outline for placeholder portals
  if (details.team != TEAM_NONE && level==0) {
    lvlWeight = 1;
    dashArray = '1,2';
  }

  let options = {
    radius: lvlRadius,
    stroke: true,
    color: COLORS[details.team],
    weight: lvlWeight,
    opacity: 1,
    fill: true,
    fillColor: COLORS[details.team],
    fillOpacity: 0.5,
    dashArray: dashArray
  };

  return options;
}

