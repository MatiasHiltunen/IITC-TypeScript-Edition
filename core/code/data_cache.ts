// MAP DATA CACHE ///////////////////////////////////
// cache for map data tiles. 

import L from "leaflet";

export class DataCache {
    private REQUEST_CACHE_FRESH_AGE = 3 * 60; // if younger than this, use data in the cache rather than fetching from the server

    private REQUEST_CACHE_MAX_AGE = 5 * 60; // maximum cache age. entries are deleted from the cache after this time

    private REQUEST_CACHE_MAX_ITEMS: number
    private REQUEST_CACHE_MAX_CHARS: number
    private _cache: {};
    private _cacheCharSize: number
    private _interval: any;

    constructor() {
        //NOTE: characters are 16 bits (ECMAScript standard), so divide byte size by two for correct limit

        if (L.Browser.mobile) {
            // on mobile devices, smaller cache size
            this.REQUEST_CACHE_MAX_ITEMS = 300; // if more than this many entries, expire early
            this.REQUEST_CACHE_MAX_CHARS = 5000000 / 2; // or more than this total size
        } else {
            // but on desktop, allow more
            this.REQUEST_CACHE_MAX_ITEMS = 1000; // if more than this many entries, expire early
            this.REQUEST_CACHE_MAX_CHARS = 20000000 / 2; // or more than this total size
        }

        this._cache = {};
        this._cacheCharSize = 0;

        this._interval = undefined;
    }



    store(qk, data, freshTime) {
        // fixme? common behaviour for objects is that properties are kept in the order they're added
        // this is handy, as it allows easy retrieval of the oldest entries for expiring
        // however, this is not guaranteed by the standards, but all our supported browsers work this way

        this.remove(qk);

        let time = new Date().getTime();

        if (freshTime === undefined) freshTime = this.REQUEST_CACHE_FRESH_AGE * 1000;
        let expire = time + freshTime;

        let dataStr = JSON.stringify(data);

        this._cacheCharSize += dataStr.length;
        this._cache[qk] = { time: time, expire: expire, dataStr: dataStr };
    }

    remove(qk) {
        if (qk in this._cache) {
            this._cacheCharSize -= this._cache[qk].dataStr.length;
            delete this._cache[qk];
        }
    }


    get(qk) {
        return qk in this._cache ? JSON.parse(this._cache[qk].dataStr) : null
    }

    getTime(qk): number {
        return qk in this._cache ? this._cache[qk].time : 0;
    }

    isFresh(qk: string): boolean {

        return qk in this._cache && this._cache[qk].expire >= (new Date()).getTime();
    }

    startExpireInterval(period) {
        if (this._interval == null) {
            this._interval = setInterval(() => { this.runExpire(); }, period * 1000);
        }
    }

    stopExpireInterval() {
        if (this._interval != null) {
            clearInterval(this._interval);
            this._interval = null;
        }
    }

    runExpire() {
        let d = new Date();
        let t = d.getTime() - this.REQUEST_CACHE_MAX_AGE * 1000;

        let cacheSize = Object.keys(this._cache).length;

        for (let qk in this._cache) {

            // fixme? our MAX_SIZE test here assumes we're processing the oldest first. this relies
            // on looping over object properties in the order they were added. this is true in most browsers,
            // but is not a requirement of the standards
            if (cacheSize > this.REQUEST_CACHE_MAX_ITEMS || this._cacheCharSize > this.REQUEST_CACHE_MAX_CHARS || this._cache[qk].time < t) {
                this._cacheCharSize -= this._cache[qk].dataStr.length;
                delete this._cache[qk];
                cacheSize--;
            }
        }
    }


    /* debug() {
        //NOTE: ECMAScript strings use 16 bit chars (it's in the standard), so convert for bytes/Kb
        return 'Cache: ' + Object.keys(this._cache).length + ' items, ' + (this._cacheCharSize * 2).toLocaleString() + ' bytes (' + Math.ceil(this._cacheCharSize / 512).toLocaleString() + 'K)';
    } */
}