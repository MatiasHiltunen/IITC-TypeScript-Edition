
import { LatLng } from "leaflet";

export const storeMapPosition = (center: LatLng, zoom:number) => {

    if (center['lat'] >= -90 && center['lat'] <= 90)
      writeCookie('ingress.intelmap.lat', center['lat']);
  
    if (center['lng'] >= -180 && center['lng'] <= 180)
      writeCookie('ingress.intelmap.lng', center['lng']);
  
    writeCookie('ingress.intelmap.zoom', zoom);
  }

const writeCookie = (name, val) => {
    let d = new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = name + "=" + val + '; expires=' + d + '; path=/';
}
