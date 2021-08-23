/// PORTAL DATA TOOLS ///////////////////////////////////////////////////
// misc functions to get portal info

import { store } from './store'
import { CAPTURE_PORTAL, COMPLETION_BONUS, DEPLOY_RESONATOR, DESTROY_FIELD, DESTROY_LINK, DESTROY_RESONATOR } from "./config";
import L from 'leaflet';
import $ from "jquery"

// search through the links data for all that link from or to a portal. returns an object with separate lists of in
// and out links. may or may not be as accurate as the portal details, depending on how much data the API returns
export const getPortalLinks = function(guid) {

    let links = { in: [], out: [] };

    $.each(store.links, function(g, l:any) {
        let d = l.options.data;

        if (d.oGuid == guid) {
            links.out.push(g);
        }
        if (d.dGuid == guid) {
            links.in.push(g);
        }
    });

    return links;
}

export const getPortalLinksCount = function(guid) {
    let links = getPortalLinks(guid);
    return links.in.length + links.out.length;
}


// search through the fields for all that reference a portal
export const getPortalFields = function(guid) {
    let fields = [];
    let index = 0;

    for(let field in store.fields){

        let d = store.fields[field].options.data;

        if (d.points[0].guid == guid ||
            d.points[1].guid == guid ||
            d.points[2].guid == guid) {
            
                // console.log(guid, index)
            fields.push(index);
            index++
        }
    }

    $.each(store.fields, function(g, f:any) {
        let d = f.options.data;

        if (d.points[0].guid == guid ||
            d.points[1].guid == guid ||
            d.points[2].guid == guid) {

            fields.push(g);
        }
    });

    return fields;
}

export const getPortalFieldsCount = function(guid) {
    let fields = getPortalFields(guid);
    return fields.length;
}


// find the lat/lon for a portal, using any and all available data
// (we have the list of portals, the cached portal details, plus links and fields as sources of portal locations)
export const findPortalLatLng = function(guid) {
    if (store.portals[guid]) {
        return store.portals[guid].getLatLng();
    }

    // not found in portals - try the cached (and possibly stale) details - good enough for location
    let details = store.portalDetail.get(guid);
    if (details) {
        return L.latLng(details.latE6 / 1E6, details.lngE6 / 1E6);
    }

    // now try searching through fields
    for (let fguid in store.fields) {
        let f = store.fields[fguid].options.data;

        for (let i in f.points) {
            if (f.points[i].guid == guid) {
                return L.latLng(f.points[i].latE6 / 1E6, f.points[i].lngE6 / 1E6);
            }
        }
    }

    // and finally search through links
    for (let lguid in store.links) {
        let l = store.links[lguid].options.data;
        if (l.oGuid == guid) {
            return L.latLng(l.oLatE6 / 1E6, l.oLngE6 / 1E6);
        }
        if (l.dGuid == guid) {
            return L.latLng(l.dLatE6 / 1E6, l.dLngE6 / 1E6);
        }
    }

    // no luck finding portal lat/lng
    return undefined;
};



let local_cache = {};
let cache_level = 0;
let GC_LIMIT = 15000; // run garbage collector when local_cache has more that 5000 items
let GC_KEEP = 10000; // keep the 4000 most recent items

export const findPortalGuidByPositionE6 = function(latE6, lngE6) {
    let item = local_cache[latE6 + "," + lngE6];
    if (item) return item[0];

    // now try searching through currently rendered portals
    for (let guid in store.portals) {
        let data = store.portals[guid].options.data;
        if (data.latE6 == latE6 && data.lngE6 == lngE6) return guid;
    }

    // now try searching through fields
    for (let fguid in store.fields) {
        let points = store.fields[fguid].options.data.points;

        for (let i in points) {
            let point = points[i];
            if (point.latE6 == latE6 && point.lngE6 == lngE6) return point.guid;
        }
    }

    // and finally search through links
    for (let lguid in store.links) {
        let l = store.links[lguid].options.data;
        if (l.oLatE6 == latE6 && l.oLngE6 == lngE6) return l.oGuid;
        if (l.dLatE6 == latE6 && l.dLngE6 == lngE6) return l.dGuid;
    }

    return null;
};

// TODO: This method is older than earth itself, modernize this.
export const pushPortalGuidPositionCache = function(guid, latE6, lngE6) {
    local_cache[latE6 + "," + lngE6] = [guid, Date.now()];
    cache_level += 1;

    if (cache_level > GC_LIMIT) {
        Object.keys(local_cache) // get all latlngs
            .map(function(latlng) { return [latlng, local_cache[latlng][1]]; }) // map them to [latlng, timestamp]
            .sort(function(a, b) { return b[1] - a[1]; }) // sort them
            .slice(GC_KEEP) // drop the MRU
            .forEach(function(item) { delete local_cache[item[0]] }); // delete the rest
        cache_level = Object.keys(local_cache).length
    }
}



// get the AP gains from a portal, based only on the brief summary data from portals, links and fields
// not entirely accurate - but available for all portals on the screen
export const getPortalApGain = function(guid) {

    let p = store.portals[guid];
    if (p) {
        let data = p.options.data;

        let linkCount = getPortalLinksCount(guid);
        let fieldCount = getPortalFieldsCount(guid);

        let result = portalApGainMaths(data.resCount, linkCount, fieldCount);
        return result;
    }

    return undefined;
}

// given counts of resonators, links and fields, calculate the available AP
// doesn't take account AP for resonator upgrades or AP for adding mods
export const portalApGainMaths = function(resCount, linkCount, fieldCount) {

    let deployAp = (8 - resCount) * DEPLOY_RESONATOR;
    if (resCount == 0) deployAp += CAPTURE_PORTAL;
    if (resCount != 8) deployAp += COMPLETION_BONUS;
    // there could also be AP for upgrading existing resonators, and for deploying mods - but we don't have data for that
    let friendlyAp = deployAp;

    let destroyResoAp = resCount * DESTROY_RESONATOR;
    let destroyLinkAp = linkCount * DESTROY_LINK;
    let destroyFieldAp = fieldCount * DESTROY_FIELD;
    let captureAp = CAPTURE_PORTAL + 8 * DEPLOY_RESONATOR + COMPLETION_BONUS;
    let destroyAp = destroyResoAp + destroyLinkAp + destroyFieldAp;
    let enemyAp = destroyAp + captureAp;

    return {
        friendlyAp: friendlyAp,
        enemyAp: enemyAp,
        destroyAp: destroyAp,
        destroyResoAp: destroyResoAp,
        captureAp: captureAp
    }
}