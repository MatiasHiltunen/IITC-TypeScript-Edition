import { store } from './store'
import { COLORS, COLORS_LVL, OCTANTS, RESO_NRG, TEAM_ENL, TEAM_NONE, TEAM_RES, TEAM_TO_CSS } from "./config";
import { addHook } from "./hooks";
import { getURLParam, makePermalink } from "./utils_misc";
import { getCurrentPortalEnergy, getTotalPortalEnergy } from './portal_info';
import { getTeam } from './entity_info';
import { show } from './panes';
import $ from 'jquery'
import { resetScrollOnNewPortal } from './portal_detail_display';

export const isSmartphone = function () {
  // this check is also used in main.js. Note it should not detect
  // tablets because their display is large enough to use the desktop
  // version.

  // The stock intel site allows forcing mobile/full sites with a vp=m or vp=f
  // parameter - let's support the same. (stock only allows this for some
  // browsers - e.g. android phone/tablet. let's allow it for all, but
  // no promises it'll work right)
  let viewParam = getURLParam('vp');
  if (viewParam == 'm') return true;
  if (viewParam == 'f') return false;

  return navigator.userAgent.match(/Android.*Mobile/)
    || navigator.userAgent.match(/iPhone|iPad|iPod/i);
}

export const smartphone = {
  mapButton: $('<a>map</a>').on("click", () => {
    $('#map').css({ 'visibility': 'visible', 'opacity': '1' });
    $('#updatestatus').show();
    $('#chatcontrols a .active').removeClass('active');
    $("#chatcontrols a:contains('map')").addClass('active');
  }),
  sideButton: $('<a>info</a>').on("click", () => {
    $('#scrollwrapper').show();
  
    resetScrollOnNewPortal();
    $('.active').removeClass('active');
    $("#chatcontrols a:contains('info')").addClass('active');
  })

};

export const runOnSmartphonesBeforeBoot = function () {
  if (!isSmartphone()) return;
  /* log.warn('running smartphone pre boot stuff'); */

  // add smartphone stylesheet
  let style = document.createElement('style');
  style.type = 'text/css';
  style.appendChild(document.createTextNode('@include_string:smartphone.css@'));
  document.head.appendChild(style);

  // don’t need many of those ?????????????
  const setupStyles = function () {
    $('head').append('<style>' +
      ['#largepreview.enl img { border:2px solid ' + COLORS[TEAM_ENL] + '; } ',
      '#largepreview.res img { border:2px solid ' + COLORS[TEAM_RES] + '; } ',
      '#largepreview.none img { border:2px solid ' + COLORS[TEAM_NONE] + '; } '].join("\n")
      + '</style>');
  }




  $('#chatcontrols').append(smartphone.mapButton).append(smartphone.sideButton);

  addHook('portalDetailsUpdated', function (data) {
    let x = $('.imgpreview img').removeClass('hide');

    if (!x.length) {
      $('.fullimg').remove();
      return;
    }

    if ($('.fullimg').length) {
      $('.fullimg').replaceWith(x.addClass('fullimg'));
    } else {
      x.addClass('fullimg').appendTo('#sidebar');
    }
  });
}

export const smartphoneInfo = function (data: { selectedPortalGuid: any; title: string; level: any; team: string; health: any; }) {
  let guid = data.selectedPortalGuid;

  if (!store.portals[guid]) return;


  data = store.portals[store.selectedPortal].options.data;
  if (typeof data.title === 'undefined') return;


  let details = store.portalDetail.get(guid);

  let lvl = data.level;
  let t: string;
  if (data.team === "N" || data.team === "NEUTRAL")
    t = '<span class="portallevel">L0</span>';
  else
    t = '<span class="portallevel" style="background: ' + COLORS_LVL[lvl] + ';">L' + lvl + '</span>';

  let percentage = data.health;
  if (details) {

    let totalEnergy = getTotalPortalEnergy(details);

    if (getTotalPortalEnergy(details) > 0) {

      percentage = Math.floor(getCurrentPortalEnergy(details) / totalEnergy * 100);
    }
  }
  t += ' ' + percentage + '% ';
  t += data.title;

  if (details) {
    let l, v, max, perc;
    let eastAnticlockwiseToNorthClockwise = [2, 1, 0, 7, 6, 5, 4, 3];

    for (let ind = 0; ind < 8; ind++) {
      let slot, reso

      if (details.resonators.length == 8) {
        slot = eastAnticlockwiseToNorthClockwise[ind];
        reso = details.resonators[slot];
      } else {
        slot = null;
        reso = ind < details.resonators.length ? details.resonators[ind] : null;
      }


      let className = TEAM_TO_CSS[getTeam(details)];
      if (slot !== null && OCTANTS[slot] === 'N')
        className += ' north'
      if (reso) {
        l = parseInt(reso.level);
        v = parseInt(reso.energy);
        max = RESO_NRG[l];
        perc = v / max * 100;
      } else {
        l = 0;
        v = 0;
        max = 0;
        perc = 0;
      }

      t += '<div class="resonator ' + className + '" style="border-top-color: ' + COLORS_LVL[l] + ';left: ' + (100 * ind / 8.0) + '%;">';
      t += '<div class="filllevel" style="width:' + perc + '%;"></div>';
      t += '</div>'
    }
  }

  $('#mobileinfo').html(t);
}

export const runOnSmartphonesAfterBoot = function () {
  if (!isSmartphone()) return;
  /*   log.warn('running smartphone post boot stuff'); */


  show('map');

  // add a div/hook for updating mobile info
  $('#updatestatus').prepend('<div id="mobileinfo" onclick="show(\'info\')"></div>');

  addHook('portalSelected', smartphoneInfo);
  // init msg of status bar. hint for the user that a tap leads to the info screen
  $('#mobileinfo').html('<div style="text-align: center"><b>tap here for info screen</b></div>');

  // replace img full view handler
  $('#portaldetails')
    .off('click', '.imgpreview')
    .on('click', '.imgpreview', function (e) {
      if (e.currentTarget === e.target) { // do not fire on #level
        $('.ui-tooltip').remove();
        let newTop = $('.fullimg').position().top + $("#sidebar").scrollTop();
        $("#sidebar").animate({ scrollTop: newTop }, 200);
      }
    });

  // make buttons in action bar flexible
  let l = $('#chatcontrols a:visible');
  l.css('width', 100 / l.length + '%');

  // notify android that a select spinner is enabled.
  // this disables javascript injection on android side.
  // if android is not notified, the spinner closes on the next JS call
  // @ts-ignore
  if (typeof android !== 'undefined' && android && android.spinnerEnabled) {
    $("body").on("click", "select", function () {
      // @ts-ignore
      android.spinnerEnabled(true);
    });
  }
  // @ts-ignore
  if (typeof android !== 'undefined' && android && android.setPermalink) {

    store.map.on('moveend', setAndroidPermalink);

    addHook('portalSelected', setAndroidPermalink);
  }


  // for some reason, leaflet misses the WebView size being set at startup on IITC Mobile
  // create a short timer that checks for this issue

  setTimeout(function () { store.map.invalidateSize(); }, 0.2 * 1000);

}

export const setAndroidPermalink = function () {

  let p = store.selectedPortal && store.portals[store.selectedPortal];
  let href = $('<a>')
    .prop('href', makePermalink(p && p.getLatLng(), { includeMapView: true }))
    .prop('href'); // to get absolute URI
  // @ts-ignore
  android.setPermalink(href);
}

export const useAndroidPanes = function () {
  // isSmartphone is important to disable panes in desktop mode
  // @ts-ignore
  return (typeof android !== 'undefined' && android && android.addPane && isSmartphone());
}
/* // @ts-ignore
if (typeof android !== 'undefined') {


  window.requestFile = function (callback) { // deprecated

    L.FileListLoader.loadFiles()
      .on('load',function (e) {
        callback(e.file.name, e.reader.result);
      });
  };
}
 */