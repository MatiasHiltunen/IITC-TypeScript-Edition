// STATUS BAR ///////////////////////////////////////

// gives user feedback about pending operations. Draws current status
// to website. Updates info in layer chooser.
import { getDataZoomTileParameters } from './map_data_calc_tools';
import { requests, startRefreshTimeout } from './request_handling'
import { isSmartphone } from './smartphone';
import { store } from './store';
import $ from 'jquery'

let renderUpdateStatusTimer_ = undefined;

export const renderUpdateStatus = function () {
  let progress = 1;

  let tileParams = getDataZoomTileParameters();

  let t = '<span class="help portallevel" title="Indicates portal levels/link lengths displayed.  Zoom in to display more.">';

  if (tileParams.hasPortals) {
    // zoom level includes portals (and also all links/fields)
    t += '<span id="loadlevel">portals</span>';
  } else {
    if (!isSmartphone()) // space is valuable
      t += '<b>links</b>: ';

    if (tileParams.minLinkLength > 0)
      t += '<span id="loadlevel">&gt;' + (tileParams.minLinkLength > 1000 ? tileParams.minLinkLength / 1000 + 'km' : tileParams.minLinkLength + 'm') + '</span>';
    else
      t += '<span id="loadlevel">all links</span>';
  }

  t += '</span>';


  // map status display
  t += ' <span class="map"><b>map</b>: ';

  if (store.mapDataRequest) {

    let status = store.mapDataRequest.getStatus();

   /*  console.log("status_bar", status) */

    // status.short - short description of status
    // status.long - longer description, for tooltip (optional)
    // status.progress - fractional progress (from 0 to 1; -1 for indeterminate) of current state (optional)
    if (status.long)
      t += '<span class="help" title="' + status.long + '">' + status.short + '</span>';
    else
      t += '<span>' + status.short + '</span>';

    if (status.progress !== undefined) {
      if (status.progress !== -1) {
        t += ' ' + Math.floor(status.progress * 100) + '%';
      }
      progress = status.progress;
    }
  } else {
    // no mapDataRequest object - no status known
    t += '...unknown...';
  }

  t += '</span>';

  //request status
  if (requests.activeRequests.length > 0)
    t += ' ' + requests.activeRequests.length + ' requests';
  if (requests.failedRequestCount > 0)
    t += ' <span style="color:#f66">' + requests.failedRequestCount + ' failed</span>'


  //it's possible that updating the status bar excessively causes some performance issues. so rather than doing it
  //immediately, delay it to the next javascript event loop, cancelling any pending update
  // will also cause any browser-related rendering to occur first, before the status actually updates

  if (renderUpdateStatusTimer_) clearTimeout(renderUpdateStatusTimer_);

  renderUpdateStatusTimer_ = setTimeout(function () {
    renderUpdateStatusTimer_ = undefined;

    $('#innerstatus').html(t);
  

    if (progress == 1 && requests.activeRequests.length > 0) {
      // we don't know the exact progress, but we have requests (e.g. chat) running, so show it as indeterminate.
      progress = -1;
    }

    // @ts-ignore
    if (typeof android !== 'undefined' && android && android.setProgress) android.setProgress(progress);
  }, 0);

}
