// MAP DATA DEBUG //////////////////////////////////////
// useful bits to assist debugging map data tiles

import L from "leaflet";
import { store } from "./store";
import { addLayerGroup } from "./utils_misc";


export class RenderDebugTiles  {
  CLEAR_CHECK_TIME: number;
  FADE_TIME: number;
  debugTileLayer: L.LayerGroup<any>;
  debugTileToRectangle: {};
  debugTileClearTimes: {};
  timer: any;

 constructor(){ 
   this.CLEAR_CHECK_TIME = 0.1;
  this.FADE_TIME = 1.0;

  this.debugTileLayer = L.layerGroup();
  addLayerGroup("DEBUG Data Tiles", this.debugTileLayer, false);

  this.debugTileToRectangle = {};
  this.debugTileClearTimes = {};
  this.timer = undefined;
}

reset() {
  this.debugTileLayer.clearLayers();
  this.debugTileToRectangle = {};
  this.debugTileClearTimes = {};
}

create = function(id,bounds) {
  const s = {color: '#666', weight: 1, opacity: 0.4, fillColor: '#666', fillOpacity: 0.1, interactive: false};

  let latLngBounds = new L.LatLngBounds(bounds);
  latLngBounds = latLngBounds.pad(-0.02);

  var l = L.rectangle(latLngBounds,s);
  this.debugTileToRectangle[id] = l;
  this.debugTileLayer.addLayer(l);
  if (store.map.hasLayer(this.debugTileLayer)) {
    // only bring to back if we have the debug layer turned on
    l.bringToBack();
  }
}

setColour (id,bordercol,fillcol) {
  var l = this.debugTileToRectangle[id];
  if (l) {
    var s = {color: bordercol, fillColor: fillcol};
    l.setStyle(s);
  }
}

setState (id,state) {
  var col = '#f0f';
  var fill = '#f0f';
  var clearDelay = -1;
  switch(state) {
    case 'ok': col='#0f0'; fill='#0f0'; clearDelay = 2; break;
    case 'error': col='#f00'; fill='#f00'; clearDelay = 30; break;
    case 'cache-fresh': col='#0f0'; fill='#ff0'; clearDelay = 2; break;
    case 'cache-stale': col='#f00'; fill='#ff0'; clearDelay = 10; break;
    case 'requested': col='#66f'; fill='#66f'; break;
    case 'retrying': col='#666'; fill='#666'; break;
    case 'request-fail': col='#a00'; fill='#666'; break;
    case 'tile-fail': col='#f00'; fill='#666'; break;
    case 'tile-timeout': col='#ff0'; fill='#666'; break;
    case 'render-queue': col='#f0f'; fill='#f0f'; break;
  }
  this.setColour (id, col, fill);
  if (clearDelay >= 0) {
    var clearAt = Date.now() + clearDelay*1000;
    this.debugTileClearTimes[id] = clearAt;

    if (!this.timer) {
      this.startTimer(clearDelay*1000);
    }
  }
}


startTimer (waitTime) {
  let _this = this;
  if (!_this.timer) {
    // a timeout of 0 firing the actual timeout - helps things run smoother
    _this.timer = setTimeout ( function() {
      _this.timer = setTimeout ( function() { _this.timer = undefined; _this.runClearPass(); }, waitTime );
    }, 0);
  }
}

runClearPass () {

  var now = Date.now();
  for (var id in this.debugTileClearTimes) {
    var diff = now - this.debugTileClearTimes[id];
    if (diff > 0) {
      if (diff > this.FADE_TIME*1000) {
        this.debugTileLayer.removeLayer(this.debugTileToRectangle[id]);
        delete this.debugTileClearTimes[id];
      } else {
        var fade = 1.0 - (diff / (this.FADE_TIME*1000));

        this.debugTileToRectangle[id].setStyle ({ opacity: 0.4*fade, fillOpacity: 0.1*fade });
      }
    }
  }

  if (Object.keys(this.debugTileClearTimes).length > 0) {
    this.startTimer(this.CLEAR_CHECK_TIME*1000);
  }
}
}
