
// LOCATION HANDLING /////////////////////////////////////////////////
// i.e. setting initial position and storing new position after moving

import { DEFAULT_ZOOM } from "./config";
import { getURLParam, readCookie, writeCookie } from "./utils_misc";
import L, { LatLng } from 'leaflet'
import { store } from "./store";


// retrieves current position from map and stores it cookies
export const storeMapPosition = (center: LatLng, zoom:number) => {

  if (center['lat'] >= -90 && center['lat'] <= 90)
    writeCookie('ingress.intelmap.lat', center['lat']);

  if (center['lng'] >= -180 && center['lng'] <= 180)
    writeCookie('ingress.intelmap.lng', center['lng']);

  writeCookie('ingress.intelmap.zoom', zoom);
}


// either retrieves the last shown position from a cookie, from the
// URL or if neither is present, via Geolocation. If that fails, it
// returns a map that shows the whole world.
export const getPosition = function () {
  if (getURLParam('latE6') && getURLParam('lngE6')) {
    // log.log("mappos: reading email URL params");
    var lat = parseInt(getURLParam('latE6')) / 1E6 || 0.0;
    var lng = parseInt(getURLParam('lngE6')) / 1E6 || 0.0;
    var z = parseInt(getURLParam('z')) || DEFAULT_ZOOM;
    return { center: new L.LatLng(lat, lng), zoom: z };
  }

  if (getURLParam('ll')) {
    // log.log("mappos: reading stock Intel URL params");
    var lat = parseFloat(getURLParam('ll').split(",")[0]) || 0.0;
    var lng = parseFloat(getURLParam('ll').split(",")[1]) || 0.0;
    var z = parseInt(getURLParam('z')) || DEFAULT_ZOOM;
    return { center: new L.LatLng(lat, lng), zoom: z };
  }

  if (getURLParam('pll')) {
    // log.log("mappos: reading stock Intel URL portal params");
    var lat = parseFloat(getURLParam('pll').split(",")[0]) || 0.0;
    var lng = parseFloat(getURLParam('pll').split(",")[1]) || 0.0;
    var z = parseInt(getURLParam('z')) || DEFAULT_ZOOM;
    return { center: new L.LatLng(lat, lng), zoom: z };
  }

  if (readCookie('ingress.intelmap.lat') && readCookie('ingress.intelmap.lng')) {
    // log.log("mappos: reading cookies");
    var lat = parseFloat(readCookie('ingress.intelmap.lat')) || 0.0;
    var lng = parseFloat(readCookie('ingress.intelmap.lng')) || 0.0;
    var z = parseInt(readCookie('ingress.intelmap.zoom')) || DEFAULT_ZOOM;

    if (lat < -90 || lat > 90) lat = 0.0;
    if (lng < -180 || lng > 180) lng = 0.0;

    return { center: new L.LatLng(lat, lng), zoom: z };
  }

  setTimeout(() => {
 
    store.map.locate({ setView: true });
  }, 50);

  return { center: new L.LatLng(0.0, 0.0), zoom: 1 };
}
