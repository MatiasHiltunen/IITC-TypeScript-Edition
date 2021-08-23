// UTILS + MISC  ///////////////////////////////////////////////////////
import { store } from './store'
import { DEFAULT_ZOOM } from "./config";
import { dialog } from "./dialog";
import { isSmartphone } from './smartphone';
import { show } from './panes';
import L from 'leaflet';
import { renderPortalDetails } from './portal_detail_display';
import $ from "jquery"

export const aboutIITC = function() {
    // Plugins metadata come from 2 sources:
    // - buildName, pluginId, dateTimeVersion: inserted in plugin body by build script
    //   (only standard plugins)
    // - script.name/version/description: from GM_info object, passed to wrapper
    //   `script` may be not available if userscript manager does not provede GM_info
    //   (atm: IITC-Mobile for iOS)
    // @ts-ignore
    let pluginsInfo = window.bootPlugins.info;
    // @ts-ignore
    let iitc = window.script_info;
    let iitcVersion = (iitc.script && iitc.script.version || iitc.dateTimeVersion) + ' [' + iitc.buildName + ']';

    function prepData(info, idx) { // try to gather plugin metadata from both sources
        let data = {
            build: info.buildName,
            name: info.pluginId,
            date: info.dateTimeVersion,
            error: info.error,
            version: null,
            description: null
        };
        let script = info.script;
        if (script) {
            if (typeof script.name === 'string') { // cut non-informative name part
                data.name = script.name.replace(/^IITC plugin: /, '');
            }
            data.version = script.version;
            data.description = script.description;
        }
        if (!data.name) {
            if (iitc.script) { // check if GM_info is available
                data.name = '[unknown plugin: index ' + idx + ']';
                data.description = "this plugin does not have proper wrapper; report to it's author";
            } else { // userscript manager fault
                data.name = '[3rd-party plugin: index ' + idx + ']';
            }
        }
        return data;
    }
    let extra = iitc.script && iitc.script.version.match(/^\d+\.\d+\.\d+(\..+)$/);
    extra = extra && extra[1];

    function formatVerInfo(p) {
        if (p.version && extra) {
            let cutPos = p.version.length - extra.length;
            // cut extra version component (timestamp) if it is equal to main script's one
            if (p.version.substring(cutPos) === extra) {
                p.version = p.version.substring(0, cutPos);
            }
        }
        p.version = p.version || p.date;
        if (p.version) {
            let tooltip = [];
            if (p.build) { tooltip.push('[' + p.build + ']'); }
            if (p.date && p.date !== p.version) { tooltip.push(p.date); }
    
            return L.Util.template(' - <code{title}>{version}</code>', {
                title: tooltip[0] ? ' title="' + tooltip.join(' ') + '"' : '',
                version: p.version
            });
        }
    }
    let plugins = pluginsInfo.map(prepData)
        .sort(function(a, b) { return a.name > b.name ? 1 : -1; })
        .map(function(p) {
            p.style = '';
            p.description = p.description || '';
            if (p.error) {
                p.style += 'text-decoration:line-through;';
                p.description = p.error;
            } else if (p.build === iitc.buildName && p.date === iitc.dateTimeVersion) { // is standard plugin
                p.style += 'color:darkgray;';
            }
            p.verinfo = formatVerInfo(p) || '';
         
            return L.Util.template('<li style="{style}" title="{description}">{name}{verinfo}</li>', p);
        })
        .join('\n');

    let html = '' +
        '<div><b>About IITC</b></div> ' +
        '<div>Ingress Intel Total Conversion</div> ' +
        '<hr>' +
        '<div>' +
        '  <a href="#" target="_blank">IITC Homepage</a> |' +
        '  <a href="#" target="_blank">Telegram channel</a><br />' +
        '   On the script’s homepage you can:' +
        '   <ul>' +
        '     <li>Find Updates</li>' +
        '     <li>Get Plugins</li>' +
        '     <li>Report Bugs</li>' +
        '     <li>Contribute!</li>' +
        '   </ul>' +
        '</div>' +
        '<hr>' +
        '<div>Version: ' + iitcVersion + '</div>';
// @ts-ignore
    if (typeof window.android !== 'undefined' && window.android.getVersionName) {
        // @ts-ignore
        html += '<div>IITC Mobile ' + window.android.getVersionName() + '</div>';
    }
    if (plugins) {
        html += '<div><p>Plugins:</p><ul>' + plugins + '</ul></div>';
    }
    
    dialog({
        title: 'IITC ' + iitcVersion,
        id: 'iitc-about',
        html: html,
        width: 'auto',
        dialogClass: 'ui-dialog-aboutIITC'
    });
}


export const layerGroupLength = function(layerGroup) {
    let layersCount = 0;
    let layers = layerGroup._layers;
    if (layers)
        layersCount = Object.keys(layers).length;
    return layersCount;
}

// retrieves parameter from the URL?query=string.
export const getURLParam = function(param) {
    const items = window.location.search.substr(1).split('&');
    if (items.length == 0) return "";

    for (let i = 0; i < items.length; i++) {
        let item = items[i].split('=');

        if (item[0] == param) {
            let val = item.length == 1 ? '' : decodeURIComponent(item[1].replace(/\+/g, ' '));
            return val;
        }
    }

    return '';
}

// read cookie by name.
// http://stackoverflow.com/a/5639455/1684530 by cwolves
export const readCookie = function(name) {
    let C, i, c = document.cookie.split('; ');
    let cookies = {};
    for (i = c.length - 1; i >= 0; i--) {
        C = c[i].split('=');
        cookies[C[0]] = unescape(C[1]);
    }
    return cookies[name];
}

export const writeCookie = function(name, val) {
    let d = new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = name + "=" + val + '; expires=' + d + '; path=/';
}

export const eraseCookie = function(name) {
    document.cookie = name + '=; expires=Thu, 1 Jan 1970 00:00:00 GMT; path=/';
}

//certain values were stored in cookies, but we're better off using localStorage instead - make it easy to convert
export const convertCookieToLocalStorage = function(name) {
    let cookie = readCookie(name);
    if (cookie !== undefined) {
 /*        log.log('converting cookie ' + name + ' to localStorage'); */
        if (localStorage[name] === undefined) {
            localStorage[name] = cookie;
        }
        eraseCookie(name);
    }
}

// add thousand separators to given number.
// http://stackoverflow.com/a/1990590/1684530 by Doug Neiner.
export const digits = function(d): number {
    // U+2009 - Thin Space. Recommended for use as a thousands separator...
    // https://en.wikipedia.org/wiki/Space_(punctuation)#Table_of_spaces
    return +(d + "").replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1&#8201;");
}


export const zeroPad = function(number, pad) {
    number = number.toString();
    let zeros = pad - number.length;
    return Array(zeros > 0 ? zeros + 1 : 0).join("0") + number;
}


// converts javascript timestamps to HH:mm:ss format if it was today;
// otherwise it returns YYYY-MM-DD
export const unixTimeToString = function(time, full) {
    if (!time) return null;
    let d = new Date(typeof time === 'string' ? parseInt(time) : time);
    time = d.toLocaleTimeString();
    //  let time = zeroPad(d.getHours(),2)+':'+zeroPad(d.getMinutes(),2)+':'+zeroPad(d.getSeconds(),2);
    let date = d.getFullYear() + '-' + zeroPad(d.getMonth() + 1, 2) + '-' + zeroPad(d.getDate(), 2);
    if (typeof full !== 'undefined' && full) return date + ' ' + time;
    if (d.toDateString() == new Date().toDateString())
        return time;
    else
        return date;
}

// converts a javascript time to a precise date and time (optionally with millisecond precision)
// formatted in ISO-style YYYY-MM-DD hh:mm:ss.mmm - but using local timezone
export const unixTimeToDateTimeString = function(time, millisecond) {
    if (!time) return null;
    let d = new Date(typeof time === 'string' ? parseInt(time) : time);
    return d.getFullYear() + '-' + zeroPad(d.getMonth() + 1, 2) + '-' + zeroPad(d.getDate(), 2) +
        ' ' + zeroPad(d.getHours(), 2) + ':' + zeroPad(d.getMinutes(), 2) + ':' + zeroPad(d.getSeconds(), 2) + (millisecond ? '.' + zeroPad(d.getMilliseconds(), 3) : '');
}

export const unixTimeToHHmm = function(time) {
    if (!time) return null;
    let d = new Date(typeof time === 'string' ? parseInt(time) : time);
    let h = '' + d.getHours();
    h = h.length === 1 ? '0' + h : h;
    let s = '' + d.getMinutes();
    s = s.length === 1 ? '0' + s : s;
    return h + ':' + s;
}

export const formatInterval = function(seconds, maxTerms?) {

    let d = Math.floor(seconds / 86400);
    let h = Math.floor((seconds % 86400) / 3600);
    let m = Math.floor((seconds % 3600) / 60);
    let s = seconds % 60;

    let terms = [];
    if (d > 0) terms.push(d + 'd');
    if (h > 0) terms.push(h + 'h');
    if (m > 0) terms.push(m + 'm');
    if (s > 0 || terms.length == 0) terms.push(s + 's');

    if (maxTerms) terms = terms.slice(0, maxTerms);

    return terms.join(' ');
}


export const rangeLinkClick = function() {
 
    if (store.portalRangeIndicator)

        store.map.fitBounds(store.portalRangeIndicator.getBounds());
    
    if (isSmartphone())

        show('map');
}

export const showPortalPosLinks = function(lat, lng, name) {
    let encoded_name = 'undefined';
    if (name !== undefined) {
        encoded_name = encodeURIComponent(name);
    }
// @ts-ignore
    if (typeof android !== 'undefined' && android && android.intentPosLink) {
        // @ts-ignore
        android.intentPosLink(lat, lng, store.map.getZoom(), name, true);
    } else {
        let qrcode = '<div id="qrcode"></div>';
        let script = '<script>$(\'#qrcode\').qrcode({text:\'GEO:' + lat + ',' + lng + '\'});</script>';
        let gmaps = '<a href="https://maps.google.com/maps?ll=' + lat + ',' + lng + '&q=' + lat + ',' + lng + '%20(' + encoded_name + ')">Google Maps</a>';
        let bingmaps = '<a href="https://www.bing.com/maps/?v=2&cp=' + lat + '~' + lng + '&lvl=16&sp=Point.' + lat + '_' + lng + '_' + encoded_name + '___">Bing Maps</a>';
        let osm = '<a href="https://www.openstreetmap.org/?mlat=' + lat + '&mlon=' + lng + '&zoom=16">OpenStreetMap</a>';
        let latLng = '<span>' + lat + ',' + lng + '</span>';


        dialog({
            html: '<div style="text-align: center;">' + qrcode + script + gmaps + '; ' + bingmaps + '; ' + osm + '<br />' + latLng + '</div>',
            title: name,
            id: 'poslinks'
        });
    }
}

export const isTouchDevice = function() {
    return 'ontouchstart' in window // works on most browsers
        ||
        'onmsgesturechange' in window; // works on ie10
};

export const androidCopy = function(text) {
    // @ts-ignore
    if (typeof android === 'undefined' || !android || !android.copy)
        return true; // i.e. execute other actions
    else
    // @ts-ignore
        android.copy(text);
    return false;
}

// returns number of pixels left to scroll down before reaching the
// bottom. Works similar to the native scrollTop function.
export const scrollBottom = function(elm) {
    if (typeof elm === 'string') elm = null/* $(elm); */
    return elm.get(0).scrollHeight - elm.innerHeight() - elm.scrollTop();
}

export const zoomToAndShowPortal = function(guid, latlng) {
  
    store.map.setView(latlng, DEFAULT_ZOOM);
    // if the data is available, render it immediately. Otherwise defer
    // until it becomes available.

    if (store.portals[guid])

        renderPortalDetails(guid);
    else

    store.urlPortal = guid;
}

export const selectPortalByLatLng = function(lat, lng) {
    if (lng === undefined && lat instanceof Array) {
        lng = lat[1];
        lat = lat[0];
    } else if (lng === undefined && lat instanceof L.LatLng) {
        lng = lat.lng;
        lat = lat.lat;
    }

    for (let guid in store.portals) {
       
        let latlng = store.portals[guid].getLatLng();
        if (latlng.lat == lat && latlng.lng == lng) {
          
            renderPortalDetails(guid);
            return;
        }
    }

    // not currently visible
    
    store.urlPortalLL = [lat, lng];
  
    store.map.setView(store.urlPortalLL, DEFAULT_ZOOM);
};

export const capitalize = function(str:string) {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// http://stackoverflow.com/a/646643/1684530 by Bergi and CMS
if (typeof String.prototype.startsWith !== 'function') {
    String.prototype.startsWith = function(str) {
        return this.slice(0, str.length) === str;
    };
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/trunc#polyfill
// (required for KitKat support)
if (!Math.trunc) {
    Math.trunc = function(v) {
        return v < 0 ? Math.ceil(v) : Math.floor(v);
    };
}

// escape a javascript string, so quotes and backslashes are escaped with a backslash
// (for strings passed as parameters to html onclick="..." for example)
export const escapeJavascriptString = function(str) {
    return (str + '').replace(/[\\"']/g, '\\$&');
}

//escape special characters, such as tags
export const escapeHtmlSpecialChars = function(str) {
    let div = document.createElement('div');
    let text = document.createTextNode(str);
    div.appendChild(text);
    return div.innerHTML;
}

export const prettyEnergy = function(nrg) {
    return nrg > 1000 ? Math.round(nrg / 1000) + ' k' : nrg;
}

export const uniqueArray = function(arr) {
    return $.grep(arr, function(v, i) {
        return $.inArray(v, arr) === i;
    });
}

export const genFourColumnTable = function(blocks) {
    let t = blocks.map(function(detail, index) {
        if (!detail) return '';
        let title = detail[2] ? ' title="' + escapeHtmlSpecialChars(detail[2]) + '"' : '';
        if (index % 2 === 0)
            return '<tr><td' + title + '>' + detail[1] + '</td><th' + title + '>' + detail[0] + '</th>';
        else
            return '    <th' + title + '>' + detail[0] + '</th><td' + title + '>' + detail[1] + '</td></tr>';
    }).join('');
    if (t.length % 2 === 1) t + '<td></td><td></td></tr>';
    return t;
}


// converts given text with newlines (\n) and tabs (\t) to a HTML
// table automatically.
export const convertTextToTableMagic = function(text) {
    // check if it should be converted to a table
    if (!text.match(/\t/)) return text.replace(/\n/g, '<br>');
let  data = [];
    let  columnCount = 0;

    // parse data
    let  rows = text.split('\n');

    rows.forEach((row, i) => {        
        data[i] = row.split('\t');
        if (data[i].length > columnCount) columnCount = data[i].length;
    });



    // build the table
    let table = '<table>';
    $.each(data, function(i, row) {
        table += '<tr>';
        $.each(data[i], function(k, cell) {
            let attributes = '';
            if (k === 0 && data[i].length < columnCount) {
                attributes = ' colspan="' + (columnCount - data[i].length + 1) + '"';
            }
            table += '<td' + attributes + '>' + cell + '</td>';
        });
        table += '</tr>';
    });
    table += '</table>';
    return table;
}

// Given 3 sets of points in an array[3]{lat, lng} returns the area of the triangle
export const calcTriArea = function(p) {
    return Math.abs((p[0].lat * (p[1].lng - p[2].lng) + p[1].lat * (p[2].lng - p[0].lng) + p[2].lat * (p[0].lng - p[1].lng)) / 2);
}

// Update layerGroups display status to window.overlayStatus and localStorage 'ingress.intelmap.layergroupdisplayed'
export const updateDisplayedLayerGroup = function(name, display) {

    store.overlayStatus[name] = display;

    localStorage['ingress.intelmap.layergroupdisplayed'] = JSON.stringify(store.overlayStatus);
}

// Read layerGroup status from window.overlayStatus if it was added to map,
// read from cookie if it has not added to map yet.
// return 'defaultDisplay' if both overlayStatus and cookie didn't have the record
export const isLayerGroupDisplayed = function(name, defaultDisplay) {

    if (typeof(store.overlayStatus[name]) !== 'undefined') return store.overlayStatus[name];

    convertCookieToLocalStorage('ingress.intelmap.layergroupdisplayed');
    const layersJSON = localStorage['ingress.intelmap.layergroupdisplayed'];
    if (!layersJSON) return defaultDisplay;

    const layers = JSON.parse(layersJSON);
    // keep latest overlayStatus
  
    store.overlayStatus = {...layers, ...store.overlayStatus};

    if (typeof(store.overlayStatus[name]) === 'undefined') return defaultDisplay;

    return store.overlayStatus[name];
}

export const addLayerGroup = function(name:string, layerGroup:L.LayerGroup, defaultDisplay?:boolean) {
    if (defaultDisplay === undefined) defaultDisplay = true;
  
    if (isLayerGroupDisplayed(name, defaultDisplay)) store.map.addLayer(layerGroup);

    store.layerChooser.addOverlay(layerGroup, name);
}

export const removeLayerGroup = function(layerGroup) {
    function find(arr, callback) { // ES5 doesn't include Array.prototype.find()
        for (let i = 0; i < arr.length; i++) {
            if (callback(arr[i], i, arr)) { return arr[i]; }
        }
    }
  
    const element = find(store.layerChooser._layers, function(el) { return el.layer === layerGroup; });
    if (!element) {
        throw new Error('Layer was not found');
    }
    // removing the layer will set it's default visibility to false (store if layer gets added again)

    const enabled = isLayerGroupDisplayed(element.name, null);

    store.map.removeLayer(layerGroup);

    store.layerChooser.removeLayer(layerGroup);
    updateDisplayedLayerGroup(element.name, enabled);
};

function clamp(n, max, min) {
    if (n === 0) { return 0; }
    return n > 0 ? Math.min(n, max) : Math.max(n, min);
}

let MAX_LATITUDE = 85.051128; // L.Projection.SphericalMercator.MAX_LATITUDE
export const clampLatLng = function(latlng) {
    // Ingress accepts requests only for this range
    return L.latLng([
        clamp(latlng.lat, MAX_LATITUDE, -MAX_LATITUDE),
        clamp(latlng.lng, 179.999999, -180)
    ]);
}

export const clampLatLngBounds = function(bounds) {
    let SW = bounds.getSouthWest(),
        NE = bounds.getNorthEast();
    
    return L.latLngBounds(clampLatLng(SW), clampLatLng(NE));
}

// @function makePermalink(latlng?: LatLng, options?: Object): String
// Makes the permalink for the portal with specified latlng, possibly including current map view.
// Portal latlng can be omitted to create mapview-only permalink.
// @option: includeMapView: Boolean = null
// Use to add zoom level and latlng of current map center.
// @option: fullURL: Boolean = null
// Use to make absolute fully qualified URL (default: relative link).
export const makePermalink = function(latlng, options?) {
    options = options || {};

    function round(l) { // ensures that lat,lng are with same precision as in stock intel permalinks
        return Math.floor(l * 1e6) / 1e6;
    }
    let args = [];
    if (!latlng || options.includeMapView) {
      
        let c = store.map.getCenter();
        args.push(
            'll=' + [round(c.lat), round(c.lng)].join(','),
        
            'z=' + store.map.getZoom()
        );
    }
    if (latlng) {
        if ('lat' in latlng) { latlng = [latlng.lat, latlng.lng]; }
        args.push('pll=' + latlng.join(','));
    }
    let url = options.fullURL ? '@url_intel_base@' : '/';
    return url + '?' + args.join('&');
};

export const setPermaLink = function(elm) { // deprecated
    $(elm).attr('href', makePermalink(null, true));
}

export const androidPermalink = function() { // deprecated
    // @ts-ignore
    if (typeof android === 'undefined' || !android || !android.intentPosLink)
        return true; // i.e. execute other actions

    let center = store.map.getCenter();
    // @ts-ignore
    android.intentPosLink(center.lat, center.lng, store.map.getZoom(), "Selected map view", false);
    return false;
}

// todo refactor main.js to get rid of setPermaLink and androidPermalink