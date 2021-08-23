// MAP DATA REQUEST ///////////////////////////////////////////////////
// class to request the map data tiles from the Ingress servers
// and then pass it on to the render class for display purposes
// Uses the map data cache class to reduce network requests

import { store } from './store'
import { DataCache } from "./data_cache";
import { addHook, runHooks } from "./hooks";
import { addResumeFunction, isIdle } from "./idle";
import { renderUpdateStatus } from "./status_bar";
import { clampLatLngBounds } from './utils_misc';
import { getDataZoomForMapZoom, getMapZoomTileParameters, latToTile, lngToTile, pointToTileId, tileToLat, tileToLng } from './map_data_calc_tools';
import L from 'leaflet';
import { postAjax } from './send_request';
import { Render } from './map_data_render';
// import { RenderDebugTiles } from './map_data_debug';

export class MapDataRequest {
    cache: any;
    render: any;
    // debugTiles: any;
    activeRequestCount: number;
    requestedTiles: {};
    renderQueue: any[];
    renderQueueTimer: any;
    renderQueuePaused: boolean;
    idle: boolean;
    MAX_REQUESTS: number;
    NUM_TILES_PER_REQUEST: number;
    MAX_TILE_RETRIES: number;
    MOVE_REFRESH: number;
    STARTUP_REFRESH: number;
    IDLE_RESUME_REFRESH: number;
    DOWNLOAD_DELAY: number;
    RUN_QUEUE_DELAY: number;
    BAD_REQUEST_RUN_QUEUE_DELAY: number;
    EMPTY_RESPONSE_RUN_QUEUE_DELAY: number;
    TIMEOUT_REQUEST_RUN_QUEUE_DELAY: number;
    RENDER_BATCH_SIZE: number;
    RENDER_PAUSE: number;
    REFRESH_CLOSE: number;
    REFRESH_FAR: number;
    FETCH_TO_REFRESH_FACTOR: number;
    fetchedDataParams: any;
    timerExpectedTimeoutTime: number;
    timer: any;
    status: { short: any; long: any; progress: any; };
    refreshStartTime: number;
    tileErrorCount: {};
    cachedTileCount: number;
    requestedTileCount: number;
    successTileCount: number;
    failedTileCount: number;
    staleTileCount: number;
    queuedTiles: {};


    constructor() {
        this.cache = new DataCache();
        this.render = new Render();
        // this.debugTiles = new RenderDebugTiles();
        this.activeRequestCount = 0;
        this.requestedTiles = {};
        this.renderQueue = [];
        this.renderQueueTimer = undefined;
        this.renderQueuePaused = false;
        this.idle = false;

        // no more than this many requests in parallel. stock site seems to rely on browser limits (6, usually), sending
        // many requests at once.
        // using our own queue limit ensures that other requests (e.g. chat, portal details) don't get delayed
        this.MAX_REQUESTS = 40;

        // this many tiles in one request
        this.NUM_TILES_PER_REQUEST = 25;

        // number of times to retry a tile after an error (including "error: TIMEOUT" now - as stock intel does)
        // TODO? different retry counters for TIMEOUT vs other errors..?
        this.MAX_TILE_RETRIES = 5;

        // refresh timers
        this.MOVE_REFRESH = 3; //time, after a map move (pan/zoom) before starting the refresh processing
        this.STARTUP_REFRESH = 3; //refresh time used on first load of IITC
        this.IDLE_RESUME_REFRESH = 5; //refresh time used after resuming from idle

        // after one of the above, there's an additional delay between preparing the refresh (clearing out of bounds,
        // processing cache, etc) and actually sending the first network requests
        this.DOWNLOAD_DELAY = 1; //delay after preparing the data download before tile requests are sent


        // a short delay between one request finishing and the queue being run for the next request.
        this.RUN_QUEUE_DELAY = 0;

        // delay before processing the queue after failed requests
        this.BAD_REQUEST_RUN_QUEUE_DELAY = 2; // longer delay before doing anything after errors (other than TIMEOUT)

        // delay before processing the queue after empty responses
        this.EMPTY_RESPONSE_RUN_QUEUE_DELAY = 5; // also long delay - empty responses are likely due to some server issues

        // delay before processing the queue after error==TIMEOUT requests. this is 'expected', so minimal extra delay over the regular RUN_QUEUE_DELAY
        this.TIMEOUT_REQUEST_RUN_QUEUE_DELAY = 0;


        // render queue
        // number of items to process in each render pass. there are pros and cons to smaller and larger values
        // (however, if using leaflet canvas rendering, it makes sense to push as much as possible through every time)

        this.RENDER_BATCH_SIZE = 1E9;

        // delay before repeating the render loop. this gives a better chance for user interaction
        // @ts-ignore
        this.RENDER_PAUSE = (typeof android === 'undefined') ? 0.1 : 0.2; //100ms desktop, 200ms mobile


        this.REFRESH_CLOSE = 300; // refresh time to use for close views z>12 when not idle and not moving
        this.REFRESH_FAR = 900; // refresh time for far views z <= 12
        this.FETCH_TO_REFRESH_FACTOR = 2; //minimum refresh time is based on the time to complete a data fetch, times this value
        this.setStatus('startup', undefined, -1);
        // ensure we have some initial map status


        // add a portalDetailLoaded hook, so we can use the extended details to update portals on the map
        //  const _this = this;

        addHook('portalDetailLoaded', (data) => {
            console.log("map data requester portalDetailLoaded hook", data)
            if (data.success) {
                this.render.createPortalEntity(data.ent, 'detailed');
            }
        });

     

        // setup idle resume function

        addResumeFunction(() => { this.idleResume(); });


        // and map move start/end callbacks
 
        store.map.on('movestart',  this.mapMoveStart, this);
        store.map.on('moveend',  this.mapMoveEnd, this);



        // then set a timeout to start the first refresh
        this.refreshOnTimeout(this.STARTUP_REFRESH);

        this.setStatus('refreshing', undefined, -1);


        this.cache && this.cache.startExpireInterval(15);



    }



    mapMoveStart() {

     

        this.setStatus('paused', null, null);
        this.clearClassTimeout();
        this.pauseRenderQueue(true);
    }

    mapMoveEnd() {

     

        let bounds = clampLatLngBounds(store.map.getBounds());
        let zoom = store.map.getZoom();
  

        if (this.fetchedDataParams) {
            // we have fetched (or are fetching) data...

            if (this.fetchedDataParams.mapZoom == store.map.getZoom() && this.fetchedDataParams.bounds.contains(bounds)) {
                // ... and the zoom level is the same and the current bounds is inside the fetched bounds
                // so, no need to fetch data. if there's time left, restore the original timeout

                let remainingTime = (this.timerExpectedTimeoutTime - new Date().getTime()) / 1000;


          
                if (remainingTime > this.MOVE_REFRESH) {

          
                    this.setStatus('done', 'Map moved, but no data updates needed', null);
                    this.refreshOnTimeout(remainingTime);
                    this.pauseRenderQueue(false);
                    return;
                }
            }
        }

        this.setStatus('refreshing', undefined, -1);
        this.refreshOnTimeout(this.MOVE_REFRESH);
    }

    idleResume() {
        // if we have no timer set and there are no active requests, refresh has gone idle and the timer needs restarting

        if (this.idle) {
 
            this.idle = false;
            this.setStatus('idle restart', undefined, -1);
            this.refreshOnTimeout(this.IDLE_RESUME_REFRESH);
        }
    }


    clearClassTimeout() {

        if (this.timer) {
      
            window.clearTimeout(this.timer);
            this.timer = undefined;
        }
    }

    refreshOnTimeout(seconds: number) {
        this.clearClassTimeout();


        // 'this' won't be right inside the callback, so save it
        // also, double setTimeout used to ensure the delay occurs after any browser-related rendering/updating/etc

        this.timer = setTimeout(() => {
            this.timer = undefined;
            this.refresh();
        }, seconds * 1000);

        this.timerExpectedTimeoutTime = new Date().getTime() + seconds * 1000;
    }


    setStatus(short, long, progress) {
        this.status = { short: short, long: long, progress: progress };
        renderUpdateStatus();
    }


    getStatus() {
        return this.status;
    };


    refresh() {

        // if we're idle, don't refresh

        if (isIdle()) {
            console.log('suspending map refresh - is idle');
            this.setStatus('idle', null, null);
            this.idle = true;
            return;
        }

        //time the refresh cycle
        this.refreshStartTime = new Date().getTime();

        // this.debugTiles.reset();
        this.resetRenderQueue();

        // a 'set' to keep track of hard failures for tiles
        this.tileErrorCount = {};

        // the 'set' of requested tile QKs
        // NOTE: javascript does not guarantee any order to properties of an object. however, in all major implementations
        // properties retain the order they are added in. IITC uses this to control the tile fetch order. if browsers change
        // then fetch order isn't optimal, but it won't break things.
        this.queuedTiles = {};


        let bounds = clampLatLngBounds(store.map.getBounds());

        let mapZoom = store.map.getZoom();

        let dataZoom = getDataZoomForMapZoom(mapZoom);

        let tileParams = getMapZoomTileParameters(dataZoom);



        //DEBUG: resize the bounds so we only retrieve some data
        //bounds = bounds.pad(-0.4);

        //let debugrect = L.rectangle(bounds,{color: 'red', fill: false, weight: 4, opacity: 0.8}).addTo(map);
        //setTimeout (function(){ map.removeLayer(debugrect); }, 10*1000);

        let x1 = lngToTile(bounds.getWest(), tileParams);

        let x2 = lngToTile(bounds.getEast(), tileParams);

        let y1 = latToTile(bounds.getNorth(), tileParams);

        let y2 = latToTile(bounds.getSouth(), tileParams);

        // calculate the full bounds for the data - including the part of the tiles off the screen edge

        let dataBounds = L.latLngBounds([

            [tileToLat(y2 + 1, tileParams), tileToLng(x1, tileParams)],

            [tileToLat(y1, tileParams), tileToLng(x2 + 1, tileParams)]
        ]);
        //let debugrect2 = L.rectangle(dataBounds,{color: 'magenta', fill: false, weight: 4, opacity: 0.8}).addTo(map);
        //setTimeout (function(){ map.removeLayer(debugrect2); }, 10*1000);

        // store the parameters used for fetching the data. used to prevent unneeded refreshes after move/zoom
        this.fetchedDataParams = { bounds: dataBounds, mapZoom: mapZoom, dataZoom: dataZoom };

        runHooks('mapDataRefreshStart', { bounds: bounds, mapZoom: mapZoom, dataZoom: dataZoom, minPortalLevel: tileParams.level, tileBounds: dataBounds });

        this.render.startRenderPass(tileParams.level, dataBounds);

        runHooks('mapDataEntityInject', { callback: this.render.processGameEntities.bind(this.render) });

        this.render.processGameEntities(store.artifact.getArtifactEntities(), 'summary');

        let logMessage = 'requesting data tiles at zoom ' + dataZoom;
        logMessage += ' (L' + tileParams.level + '+ portals';
        logMessage += ', ' + tileParams.tilesPerEdge + ' tiles per global edge), map zoom is ' + mapZoom;

        // console.log(logMessage);


        this.cachedTileCount = 0;
        this.requestedTileCount = 0;
        this.successTileCount = 0;
        this.failedTileCount = 0;
        this.staleTileCount = 0;

        let tilesToFetchDistance = {};

        // map center point - for fetching center tiles first

        let mapCenterPoint = store.map.project(store.map.getCenter(), mapZoom);

        // y goes from left to right
        for (let y = y1; y <= y2; y++) {
            // x goes from bottom to top(?)
            for (let x = x1; x <= x2; x++) {

                let tile_id = pointToTileId(tileParams, x, y);

                let latNorth = tileToLat(y, tileParams);

                let latSouth = tileToLat(y + 1, tileParams);

                let lngWest = tileToLng(x, tileParams);

                let lngEast = tileToLng(x + 1, tileParams);

              /*   this.debugTiles.create(tile_id, [
                    [latSouth, lngWest],
                    [latNorth, lngEast]
                ]); */

                //TODO: with recent backend changes there are now multiple zoom levels of data that is identical except perhaps for some
                // reduction of detail when zoomed out. to take good advantage of the cache, a check for cached data at a closer zoom
                // but otherwise the same parameters (min portal level, tiles per edge) will mean less downloads when zooming out
                // (however, the default code in getDataZoomForMapZoom currently reduces the need for this, as it forces the furthest 
                //  out zoom tiles for a detail level)
                if (this.cache && this.cache.isFresh(tile_id)) {
                    // data is fresh in the cache - just render it
                    this.pushRenderQueue(tile_id, this.cache.get(tile_id), 'cache-fresh');
                    this.cachedTileCount += 1;
                } else {

                    // no fresh data

                    // tile needed. calculate the distance from the centre of the screen, to optimise the load order

                    let latCenter = (latNorth + latSouth) / 2;
                    let lngCenter = (lngEast + lngWest) / 2;

                    let tileLatLng = L.latLng(latCenter, lngCenter);

                    let tilePoint = store.map.project(tileLatLng, mapZoom);

                    let delta = mapCenterPoint.subtract(tilePoint);
                    let distanceSquared = delta.x * delta.x + delta.y * delta.y;

                    tilesToFetchDistance[tile_id] = distanceSquared;
                    this.requestedTileCount += 1;
                }
            }
        }

        // re-order the tile list by distance from the centre of the screen. this should load more relevant data first
        let tilesToFetch = Object.keys(tilesToFetchDistance);
        tilesToFetch.sort(function (a, b) {
            return tilesToFetchDistance[a] - tilesToFetchDistance[b];
        });

        for (let i in tilesToFetch) {
            let qk = tilesToFetch[i];

            this.queuedTiles[qk] = qk;
        }

        // console.log("this.queuedTiles[qk] = qk;??", this.queuedTiles)


        this.setStatus('loading', undefined, -1);

        // technically a request hasn't actually finished - however, displayed portal data has been refreshed
        // so as far as plugins are concerned, it should be treated as a finished request
        runHooks('requestFinished', { success: true });

        // console.log('done request preparation (cleared out-of-bounds and invalid for zoom, and rendered cached data)');

        if (Object.keys(this.queuedTiles).length > 0) {
            // queued requests - don't start processing the download queue immediately - start it after a short delay
            this.delayProcessRequestQueue(this.DOWNLOAD_DELAY);
        } else {
            // all data was from the cache, nothing queued - run the queue 'immediately' so it handles the end request processing
            this.delayProcessRequestQueue(0);
        }
    }


    delayProcessRequestQueue(seconds) {
        if (this.timer === undefined) {
            let _this = this;
            this.timer = setTimeout(function () {
                _this.timer = setTimeout(function () {
                    _this.timer = undefined;
                    _this.processRequestQueue();
                }, seconds * 1000);
            }, 0);
        }
    }


    processRequestQueue() {

        // if nothing left in the queue, finish
        if (Object.keys(this.queuedTiles).length == 0) {
            // we leave the renderQueue code to handle ending the render pass now
            // (but we need to make sure it's not left without it's timer running!)
            if (!this.renderQueuePaused) {
                this.startQueueTimer(this.RENDER_PAUSE);
            }

            return;
        }


        // create a list of tiles that aren't requested over the network
        let pendingTiles = [];
        for (let id in this.queuedTiles) {
            if (!(id in this.requestedTiles)) {
                pendingTiles.push(id);
            }
        }

        //  console.log('- request state: '+Object.keys(this.requestedTiles).length+' tiles in '+this.activeRequestCount+' active requests, '+pendingTiles.length+' tiles queued');

        let requestBuckets = this.MAX_REQUESTS - this.activeRequestCount;
        if (pendingTiles.length > 0 && requestBuckets > 0) {

            let requestBucketSize = Math.min(this.NUM_TILES_PER_REQUEST, Math.max(5, Math.ceil(pendingTiles.length / requestBuckets)));
            for (let bucket = 0; bucket < requestBuckets; bucket++) {

                // if the tiles for this request have had several retries, use smaller requests
                // maybe some of the tiles caused all the others to error? no harm anyway, and it may help...
                let numTilesThisRequest = Math.min(requestBucketSize, pendingTiles.length);

                let id = pendingTiles[0];
                let retryTotal = (this.tileErrorCount[id] || 0);
                for (let i = 1; i < numTilesThisRequest; i++) {
                    id = pendingTiles[i];
                    retryTotal += (this.tileErrorCount[id] || 0);
                    if (retryTotal > this.MAX_TILE_RETRIES) {
                        numTilesThisRequest = i;
                        break;
                    }
                }

                let tiles = pendingTiles.splice(0, numTilesThisRequest);
                if (tiles.length > 0) {
                    this.sendTileRequest(tiles);
                }
            }

        }


        // update status
        let pendingTileCount = this.requestedTileCount - (this.successTileCount + this.failedTileCount + this.staleTileCount);
        let longText = 'Tiles: ' + this.cachedTileCount + ' cached, ' +
            this.successTileCount + ' loaded, ' +
            (this.staleTileCount ? this.staleTileCount + ' stale, ' : '') +
            (this.failedTileCount ? this.failedTileCount + ' failed, ' : '') +
            pendingTileCount + ' remaining';

        const progress = this.requestedTileCount > 0 ? (this.requestedTileCount - pendingTileCount) / this.requestedTileCount : undefined;
        this.setStatus('loading', longText, progress);
    }


    sendTileRequest(tiles) {
        // console.log("sendTileRequest", tiles)
        let tilesList = tiles.filter(id => {
            this.requestedTiles[id] = true

            return id in this.queuedTiles
        })

        this.activeRequestCount += 1;

        /* let savedThis = this; */

        postAjax('getEntities', { tileKeys: tilesList })
            .then(data => this.handleResponse(data, tiles, true))
            .catch(err => this.handleResponse(undefined, tiles, false));
    }

    requeueTile(id, error) {
        if (id in this.queuedTiles) {
            // tile is currently wanted...

            // first, see if the error can be ignored due to retry counts
            if (error) {
                this.tileErrorCount[id] = (this.tileErrorCount[id] || 0) + 1;
                if (this.tileErrorCount[id] <= this.MAX_TILE_RETRIES) {
                    // retry limit low enough - clear the error flag
                    error = false;
                }
            }

            if (error) {
                // if error is still true, retry limit hit. use stale data from cache if available
                let data = this.cache ? this.cache.get(id) : undefined;
                if (data) {
                    // we have cached data - use it, even though it's stale
                    this.pushRenderQueue(id, data, 'cache-stale');
                    this.staleTileCount += 1;
                } else {
                    // no cached data
                    // this.debugTiles.setState(id, 'error');
                    this.failedTileCount += 1;
                }
                // and delete from the pending requests...
                delete this.queuedTiles[id];

            } else {
                // if false, was a 'timeout' or we're retrying, so unlimited retries (as the stock site does)
                // this.debugTiles.setState(id, 'retrying');

                // FIXME? it's nice to move retried tiles to the end of the request queue. however, we don't actually have a
                // proper queue, just an object with guid as properties. Javascript standards don't guarantee the order of properties
                // within an object. however, all current browsers do keep property order, and new properties are added at the end.
                // therefore, delete and re-add the requeued tile and it will be added to the end of the queue
                delete this.queuedTiles[id];
                this.queuedTiles[id] = id;

            }
        } // else the tile wasn't currently wanted (an old non-cancelled request) - ignore
    }


    handleResponse(data, tiles, success) {

        // console.log("handleResponse", data, tiles, success)

        this.activeRequestCount -= 1;

        let successTiles = [];
        let errorTiles = [];
        let retryTiles = [];
        let timeoutTiles = [];
        let unaccountedTiles = tiles.slice(0); // Clone

        if (!success || !data || !data.result) {
            console.warn('Request.handleResponse: request failed - requeuing...' + (data && data.error ? ' error: ' + data.error : ''));

            //request failed - requeue all the tiles(?)

            if (data && data.error && data.error == 'RETRY') {
                // the server can sometimes ask us to retry a request. this is botguard related, I believe

                for (let i in tiles) {
                    let id = tiles[i];
                    retryTiles.push(id);
                    // this.debugTiles.setState(id, 'retrying');
                }
                runHooks('requestFinished', { success: false });

            } else {
                for (let i in tiles) {
                    let id = tiles[i];
                    errorTiles.push(id);
                    // this.debugTiles.setState(id, 'request-fail');
                }
                runHooks('requestFinished', { success: false });

            }
            unaccountedTiles = [];
        } else {

            // TODO: use result.minLevelOfDetail ??? stock site doesn't use it yet...

            let m = data.result.map;

            for (let id in m) {
                let val = m[id];
                unaccountedTiles.splice(unaccountedTiles.indexOf(id), 1);
                if ('error' in val) {
                    // server returned an error for this individual data tile

                    if (val.error == "TIMEOUT") {
                        // TIMEOUT errors for individual tiles are quite common. used to be unlimited retries, but not any more
                        timeoutTiles.push(id);
                    } else {
                        console.warn('map data tile ' + id + ' failed: error==' + val.error);
                        errorTiles.push(id);
                        // this.debugTiles.setState(id, 'tile-fail');
                    }
                } else {
                    // no error for this data tile - process it
                    successTiles.push(id);

                    // store the result in the cache
                    this.cache && this.cache.store(id, val);

                    // if this tile was in the render list, render it
                    // (requests aren't aborted when new requests are started, so it's entirely possible we don't want to render it!)
                    if (id in this.queuedTiles) {

                        this.pushRenderQueue(id, val, 'ok');

                        delete this.queuedTiles[id];
                        this.successTileCount += 1;

                    } // else we don't want this tile (from an old non-cancelled request) - ignore
                }

            }

            // TODO? check for any requested tiles in 'tiles' not being mentioned in the response - and handle as if it's a 'timeout'?

            runHooks('requestFinished', { success: true });
        }

        // set the queue delay based on any errors or timeouts
        // NOTE: retryTimes are retried at the regular delay - no longer wait as for error/timeout cases
        let nextQueueDelay = errorTiles.length > 0 ? this.BAD_REQUEST_RUN_QUEUE_DELAY :
            unaccountedTiles.length > 0 ? this.EMPTY_RESPONSE_RUN_QUEUE_DELAY :
                timeoutTiles.length > 0 ? this.TIMEOUT_REQUEST_RUN_QUEUE_DELAY :
                    this.RUN_QUEUE_DELAY;
        let statusMsg = 'getEntities status: ' + tiles.length + ' tiles: ';
        statusMsg += successTiles.length + ' successful';
        if (retryTiles.length) statusMsg += ', ' + retryTiles.length + ' retried';
        if (timeoutTiles.length) statusMsg += ', ' + timeoutTiles.length + ' timed out';
        if (errorTiles.length) statusMsg += ', ' + errorTiles.length + ' failed';
        if (unaccountedTiles.length) statusMsg += ', ' + unaccountedTiles.length + ' unaccounted';
        statusMsg += '. delay ' + nextQueueDelay + ' seconds';
        // console.log(statusMsg);


        // requeue any 'timeout' tiles immediately
        if (timeoutTiles.length > 0) {
            for (let i in timeoutTiles) {
                let id = timeoutTiles[i];
                delete this.requestedTiles[id];

                this.requeueTile(id, true);
            }
        }

        if (retryTiles.length > 0) {
            for (let i in retryTiles) {
                let id = retryTiles[i];
                delete this.requestedTiles[id];

                this.requeueTile(id, false); //tiles from a error==RETRY request are requeued without counting it as an error
            }
        }

        if (errorTiles.length > 0) {
            for (let i in errorTiles) {
                let id = errorTiles[i];
                delete this.requestedTiles[id];
                this.requeueTile(id, true);
            }
        }

        if (unaccountedTiles.length > 0) {
            for (let i in unaccountedTiles) {
                let id = unaccountedTiles[i];
                delete this.requestedTiles[id];
                this.requeueTile(id, true);
            }
        }

        for (let i in successTiles) {
            let id = successTiles[i];
            delete this.requestedTiles[id];
        }


        this.delayProcessRequestQueue(nextQueueDelay);
    }


    resetRenderQueue() {
        this.renderQueue = [];

        if (this.renderQueueTimer) {
            clearTimeout(this.renderQueueTimer);
            this.renderQueueTimer = undefined;
        }
        this.renderQueuePaused = false;
    }


    pushRenderQueue(id, data, status) {
        // this.debugTiles.setState(id, 'render-queue');
        this.renderQueue.push({
            id: id,
            // the data in the render queue is modified as we go, so we need to copy the values of the arrays. just storing the reference would modify the data in the cache!
            deleted: (data.deletedGameEntityGuids || []).slice(0),
            entities: (data.gameEntities || []).slice(0),
            status: status
        });

        if (!this.renderQueuePaused) {
            this.startQueueTimer(this.RENDER_PAUSE);
        }
    }

    startQueueTimer(delay) {
        if (this.renderQueueTimer === undefined) {
            let _this = this;
            this.renderQueueTimer = setTimeout(function () {
                _this.renderQueueTimer = setTimeout(function () {
                    _this.renderQueueTimer = undefined;
                    _this.processRenderQueue();
                }, (delay || 0) * 1000);
            }, 0);
        }
    }

    pauseRenderQueue(pause) {
        this.renderQueuePaused = pause;
        if (pause) {
            if (this.renderQueueTimer) {
                clearTimeout(this.renderQueueTimer);
                this.renderQueueTimer = undefined;
            }
        } else {
            if (this.renderQueue.length > 0) {
                this.startQueueTimer(this.RENDER_PAUSE);
            }
        }
    }

    processRenderQueue() {
        let drawEntityLimit = this.RENDER_BATCH_SIZE;


        //TODO: we don't take account of how many of the entities are actually new/removed - they
        // could already be drawn and not changed. will see how it works like this...
        while (drawEntityLimit > 0 && this.renderQueue.length > 0) {
            let current = this.renderQueue[0];

            if (current.deleted.length > 0) {
                let deleteThisPass = current.deleted.splice(0, drawEntityLimit);
                drawEntityLimit -= deleteThisPass.length;
                this.render.processDeletedGameEntityGuids(deleteThisPass);
            }

            if (drawEntityLimit > 0 && current.entities.length > 0) {
                let drawThisPass = current.entities.splice(0, drawEntityLimit);
                drawEntityLimit -= drawThisPass.length;
                this.render.processGameEntities(drawThisPass, 'extended');
            }

            if (current.deleted.length == 0 && current.entities.length == 0) {
                this.renderQueue.splice(0, 1);
                // this.debugTiles.setState(current.id, current.status);
            }


        }

        if (this.renderQueue.length > 0) {
            this.startQueueTimer(this.RENDER_PAUSE);
        } else if (Object.keys(this.queuedTiles).length == 0) {

            this.render.endRenderPass();

            let endTime = new Date().getTime();
            let duration = (endTime - this.refreshStartTime) / 1000;

            // console.log('finished requesting data! (took ' + duration + ' seconds to complete)');
            runHooks('mapDataRefreshEnd', {});

            let longStatus = 'Tiles: ' + this.cachedTileCount + ' cached, ' +
                this.successTileCount + ' loaded, ' +
                (this.staleTileCount ? this.staleTileCount + ' stale, ' : '') +
                (this.failedTileCount ? this.failedTileCount + ' failed, ' : '') +
                'in ' + duration + ' seconds';

            // refresh timer based on time to run this pass, with a minimum of REFRESH seconds

            let minRefresh = store.map.getZoom() > 12 ? this.REFRESH_CLOSE : this.REFRESH_FAR;
            let refreshTimer = Math.max(minRefresh, duration * this.FETCH_TO_REFRESH_FACTOR);
            this.refreshOnTimeout(refreshTimer);

            this.setStatus(this.failedTileCount ? 'errors' : this.staleTileCount ? 'out of date' : 'done', longStatus, null);

        }

    }
}

