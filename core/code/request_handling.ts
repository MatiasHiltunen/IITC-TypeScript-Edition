// REQUEST HANDLING //////////////////////////////////////////////////
// note: only meant for portal/links/fields request, everything else
// does not count towards “loading”

import { store } from './store'
import { MINIMUM_OVERRIDE_REFRESH, REFRESH, ZOOM_LEVEL_ADJ } from "./config";
import { isIdle } from "./idle";
import { renderUpdateStatus } from "./status_bar";
import $ from "jquery"

/* window.activeRequests = []; */
// window.failedRequestCount = 0;
/* window.statusTotalMapTiles = 0;
window.statusCachedMapTiles = 0;
window.statusSuccessMapTiles = 0;
window.statusStaleMapTiles = 0;
window.statusErrorMapTiles = 0;
 */

export const requests = {
    _quickRefreshPending: false,
    activeRequests: [],
    _lastRefreshTime: 0,
    failedRequestCount: 0,
    statusTotalMapTiles: 0,
    statusCachedMapTiles: 0,
    statusSuccessMapTiles: 0,
    statusStaleMapTiles: 0,
    statusErrorMapTiles: 0,

    add(requestId:number) {
        
        // console.log("this.active in add active requests", this.activeRequests)
        this.activeRequests.push(requestId);
        renderUpdateStatus();
    },

    remove(requestId:number) {
        this.activeRequests = this.activeRequests.filter(id => id !== requestId)
        renderUpdateStatus();
    },

    abort() {
        // console.log("abort requests", this.activeRequests)
        /* $.each(this.activeRequests, function (ind, actReq) {
            if (actReq) actReq.abort();
        });
 */
        this.activeRequests = [];
        this.failedRequestCount = 0;
        
        store.chat.abort()

        renderUpdateStatus();
    },
    _onRefreshFunctions:[],
    _callOnRefreshFunctions() {
        // console.log('running refresh at ' + new Date().toLocaleTimeString());
        // 
        startRefreshTimeout();

          if(isIdle()) {
        //    log.log('user has been idle for ' + idleTime + ' seconds, or window hidden. Skipping refresh.');
  
            renderUpdateStatus();
            return;
          }

        //  log.log('refreshing');

        console.log("refreshing")

        //store the timestamp of this refresh
        this._lastRefreshTime = new Date().getTime();

       
        $.each(this._onRefreshFunctions, (ind, f) => {
            f();
        });
    },


    // add method here to be notified of auto-refreshes
    addRefreshFunction(f) {
        this._onRefreshFunctions.push(f);
    },

    isLastRequest(action) {

        return this.activeRequests.length === 1
        /* let result = true;
        $.each(this.activeRequests, function (ind, req) {
            if (req.action === action) {
                result = false;
                return false;
            }
        });
        return result; */
    }
}



// sets the timer for the next auto refresh. Ensures only one timeout
// is queued. May be given 'override' in milliseconds if time should
// not be guessed automatically. Especially useful if a little delay
// is required, for example when zooming.
export const startRefreshTimeout = function (override?) {
    // may be required to remove 'paused during interaction' message in
    // status bar
    renderUpdateStatus();
  
    if (store.refreshTimeout) clearTimeout(store.refreshTimeout);
    if (override == -1) return; //don't set a new timeout

    let t = 0;
    if (override) {
        requests._quickRefreshPending = true;
        t = override;
        //ensure override can't cause too fast a refresh if repeatedly used (e.g. lots of scrolling/zooming)
  
        store.timeSinceLastRefresh = new Date().getTime() - requests._lastRefreshTime;
    
        if (store.timeSinceLastRefresh < 0) store.timeSinceLastRefresh = 0; //in case of clock adjustments
     
        if (store.timeSinceLastRefresh < MINIMUM_OVERRIDE_REFRESH * 1000)
        
            t = (MINIMUM_OVERRIDE_REFRESH * 1000 - store.timeSinceLastRefresh);
    } else {
        requests._quickRefreshPending = false;
        t = REFRESH * 1000;
   
        let adj = ZOOM_LEVEL_ADJ * (18 - store.map.getZoom());
        if (adj > 0) t += adj * 1000;
    }
    //let next = new Date(new Date().getTime() + t).toLocaleTimeString();
    //  log.log('planned refresh in ' + (t/1000) + ' seconds, at ' + next);
  
    store.refreshTimeout = setTimeout(requests._callOnRefreshFunctions, t);
    renderUpdateStatus();
}

