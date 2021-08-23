// PORTAL DETAILS MAIN ///////////////////////////////////////////////
// main code block that renders the portal details in the sidebar and
// methods that highlight the portal in the map view.

import { store } from './store'
import { ACCESS_INDICATOR_COLOR, HACK_RANGE, RANGE_INDICATOR_COLOR, TEAM_NONE, TEAM_TO_CSS } from "./config";
import { teamStringToId } from "./entity_info";
import { runHooks } from "./hooks";
import { show } from "./panes";
import { isSmartphone } from "./smartphone";
import { capitalize, genFourColumnTable, makePermalink, showPortalPosLinks, zoomToAndShowPortal } from "./utils_misc";
import L from 'leaflet'
import { getPortalFieldsCount, getPortalLinks } from "./portal_data";
import { setMarkerStyle } from "./portal_marker";
import { getAttackApGainText, getEnergyText, getHackDetailsText, getMitigationText, getModDetails, getPortalHistoryDetails, getRangeText, getResonatorDetails } from "./portal_detail_display_tools";
import { fixPortalImageUrl, getMaxOutgoingLinks, getPortalAttackValues, getPortalLevel, getPortalRange, getPortalSummaryData, Portal } from "./portal_info";
import $ from 'jquery'
import { GeodesicCircleClass } from 'leaflet.geodesic';
import { Team } from './player';
/* const {geodesicCircle} = require('../external/L.Geodesic') */

export const resetScrollOnNewPortal = function () {
  if (store.selectedPortal !== store.lastVisible) {
    // another portal selected so scroll position become irrelevant to new portal details
    $("#sidebar").scrollTop(0); // NB: this works ONLY when #sidebar:visible
  }
};

export const renderPortalDetails = (guid?: string) => {
  console.log("begin to render portal details")
/*   if(guid in store.portals) {
    selectPortal(guid);
  }
   */
  if ($('#sidebar').is(':visible')) {
    resetScrollOnNewPortal();
    store.lastVisible = guid;
  }

  console.log("begin to render portal details 2")

  if (guid && !store.portalDetail.isFresh(guid)) {
    console.log("REQUEST PORTAL DETAIL")
    store.portalDetail.request(guid);
  }

  console.log("begin to render portal details 3")

  // TODO? handle the case where we request data for a particular portal GUID, but it *isn't* in
  // window.portals....

  if (!(guid in store.portals)) {
    console.log("not in store.portals", guid)
    store.urlPortal = guid;
    $('#portaldetails').html('');
    if (isSmartphone()) {
      $('.fullimg').remove();
      $('#mobileinfo').html('<div style="text-align: center"><b>tap here for info screen</b></div>');
    }
    return;
  }

  console.log("begin to render portal details 4")

  let portal = store.portals[guid];
  let data: Portal = portal.options.data;
  let details = store.portalDetail.get(guid);
  let historyDetails = getPortalHistoryDetails(data);

  // details and data can get out of sync. if we have details, construct a matching 'data'
  if (details) {
    data = getPortalSummaryData(details);
  }

  console.log("begin to render portal details 5")


  let modDetails = details ? '<div class="mods">' + getModDetails(details) + '</div>' : '';
  let miscDetails = details ? getPortalMiscDetails(guid, details) : '';
  let resoDetails = details ? getResonatorDetails(details) : '';

  //TODO? other status details...
  let statusDetails = details ? '' : '<div id="portalStatus">Loading details...</div>';

  console.log("begin to render portal details 6")


  let img = fixPortalImageUrl(details ? details.image : data.image);
  let title = (details && details.title) || (data && data.title) || 'null';

  let lat = data.latE6 / 1E6;
  let lng = data.lngE6 / 1E6;

  let imgTitle = title + '\n\nClick to show full image.';


  // portal level. start with basic data - then extend with fractional info in tooltip if available
  let levelInt = data.team == Team.NONE ? 0 : data.level;
  let levelDetails: number
  let detailsString: string

  if (details) {
    levelDetails = getPortalLevel(details);
    if (levelDetails != 8) {
      if (levelDetails == Math.ceil(levelDetails))
        detailsString += "\n8";
      else
        detailsString += "\n" + (Math.ceil(levelDetails) - levelDetails) * 8;
      detailsString += " resonator level(s) needed for next portal level";
    } else {
      detailsString += "\nfully upgraded";
    }
  }
  detailsString = "Level " + levelDetails;


  let linkDetails = $('<div>', { class: 'linkdetails' });

/*   let posOnClick = showPortalPosLinks(lat, lng, title)// .bind(this, lat, lng, title); */

  // @ts-ignore
  if (typeof android !== 'undefined' && android && android.intentPosLink) {
    // android devices. one share link option - and the android app provides an interface to share the URL,
    // share as a geo: intent (navigation via google maps), etc

    let shareLink = $('<a>').text('Share portal').on("click", ()=> showPortalPosLinks(lat, lng, title));
    linkDetails.append($('<aside>').append($('<div>').append(shareLink)));

  } else {
    // non-android - a permalink for the portal
    let permaHtml = $('<a>').attr({
      href: makePermalink([lat, lng]),
      title: 'Create a URL link to this portal'
    }
    ).text('Portal link');
    linkDetails.append($('<aside>').append($('<div>').append(permaHtml)));

    // and a map link popup dialog
    let mapHtml = $('<a>').attr({
      title: 'Link to alternative maps (Google, etc)'
    }).text('Map links').click(()=> showPortalPosLinks(lat, lng, title));
    linkDetails.append($('<aside>').append($('<div>').append(mapHtml)));
  }

  $('#portaldetails')
    .html('') //to ensure it's clear
    .attr('class', TEAM_TO_CSS[teamStringToId(data.team)])
    .append(
      $('<h3>', { class: 'title' })
        .text(title)
        .prepend(
          $('<svg><use xlink:href="#ic_place_24px"/><title>Click to move to portal</title></svg>')
            .attr({
              class: 'material-icons icon-button',
              style: 'float: left'
            })
            .on("click", () => {
              zoomToAndShowPortal(guid, [data.latE6 / 1E6, data.lngE6 / 1E6]);
              if (isSmartphone()) { show('map') };
            })),

      $('<span>').attr({
        class: 'close',
        title: 'Close [w]',
        accesskey: 'w'
      }).text('X')
        .on("click", () => {
          console.log("Infinete loop here?")
          // renderPortalDetails();
          if (isSmartphone()) { show('map') };
        }),

      // help cursor via ".imgpreview img"
      $('<div>')
        .attr({
          class: 'imgpreview',
          title: imgTitle,
          style: 'background-image: url("' + img + '")'
        })
        .append(
          $('<span>', { id: 'level', title: levelDetails })
            .text(levelInt),
          $('<img>', { class: 'hide', src: img })
        ),

      modDetails,
      miscDetails,
      resoDetails,
      statusDetails,
      linkDetails,
      historyDetails
    );

  // only run the hooks when we have a portalDetails object - most plugins rely on the extended data
  // TODO? another hook to call always, for any plugins that can work with less data?
  if (details) {
    runHooks('portalDetailsUpdated', { guid: guid, portal: portal, portalDetails: details, portalData: data });
  }
}

export const getPortalMiscDetails = function (guid, d) {

  let randDetails;

  if (d) {

    // collect some random data that’s not worth to put in an own method
    let linkInfo = getPortalLinks(guid);
    let maxOutgoing = getMaxOutgoingLinks(d);
    let linkCount = linkInfo.in.length + linkInfo.out.length;
    let links = { incoming: linkInfo.in.length, outgoing: linkInfo.out.length };

    let title = 'at most ' + maxOutgoing + ' outgoing links\n' +
      links.outgoing + ' links out\n' +
      links.incoming + ' links in\n' +
      '(' + (links.outgoing + links.incoming) + ' total)'
    let linksText = ['links', links.outgoing + ' out / ' + links.incoming + ' in', title];

    let player = d.owner
      ? '<span class="nickname">' + d.owner + '</span>'
      : '-';
    let playerText = ['owner', player];


    let fieldCount = getPortalFieldsCount(guid);

    let fieldsText = ['fields', fieldCount];

    let apGainText = getAttackApGainText(d, fieldCount, linkCount);

    let attackValues = getPortalAttackValues(d);


    // collect and html-ify random data

    let randDetailsData = [
      // these pieces of data are only relevant when the portal is captured
      // maybe check if portal is captured and remove?
      // But this makes the info panel look rather empty for unclaimed portals
      playerText, getRangeText(d),
      linksText, fieldsText,
      getMitigationText(d, linkCount), getEnergyText(d),
      // and these have some use, even for uncaptured portals
      apGainText, getHackDetailsText(d),
    ];

    if (attackValues.attack_frequency != 0)
      randDetailsData.push([
        '<span title="attack frequency" class="text-overflow-ellipsis">attack frequency</span>',
        '×' + attackValues.attack_frequency]);
    if (attackValues.hit_bonus != 0)
      randDetailsData.push(['hit bonus', attackValues.hit_bonus + '%']);
    if (attackValues.force_amplifier != 0)
      randDetailsData.push([
        '<span title="force amplifier" class="text-overflow-ellipsis">force amplifier</span>',
        '×' + attackValues.force_amplifier]);

    randDetails = '<table id="randdetails">' + genFourColumnTable(randDetailsData) + '</table>';


    // artifacts - tacked on after (but not as part of) the 'randdetails' table
    // instead of using the existing columns....

    if (d.artifactBrief && d.artifactBrief.target && Object.keys(d.artifactBrief.target).length > 0) {
      let targets = Object.keys(d.artifactBrief.target);
      //currently (2015-07-10) we no longer know the team each target portal is for - so we'll just show the artifact type(s) 
      randDetails += '<div id="artifact_target">Target portal: ' + targets.map(function (x) { return capitalize(x); }).join(', ') + '</div>';
    }

    // shards - taken directly from the portal details
    if (d.artifactDetail) {
      randDetails += '<div id="artifact_fragments">Shards: ' + d.artifactDetail.displayName + ' #' + d.artifactDetail.fragments.join(', ') + '</div>';
    }

  }

  return randDetails;
}


// draws link-range and hack-range circles around the portal with the
// given details. Clear them if parameter 'd' is null.
export const setPortalIndicators = function (p) {

  if (store.portalRangeIndicator) {
    store.map.removeLayer(store.portalRangeIndicator);
    store.portalRangeIndicator = null;
  }

  if (store.portalAccessIndicator) {
    store.map.removeLayer(store.portalAccessIndicator);
    store.portalAccessIndicator = null;
  }
  // if we have a portal...

  if (p) {
    let coord = p.getLatLng();

    // range is only known for sure if we have portal details
    // TODO? render a min range guess until details are loaded..?

    let d = store.portalDetail.get(p.options.guid);
    if (d) {
      let range = getPortalRange(d);
      store.portalRangeIndicator = (range.range > 0
        ? new GeodesicCircleClass(coord, {
          fill: false,
          color: RANGE_INDICATOR_COLOR,
          weight: 3,
          radius: range.range,
          dashArray: range.isLinkable ? undefined : "10,10",
          interactive: false
        })
        : L.circle(coord, range.range, { fill: false, stroke: false, interactive: false })

      ).addTo(store.map);
    }

    store.portalAccessIndicator = L.circle(coord, HACK_RANGE,
      { fill: false, color: ACCESS_INDICATOR_COLOR, weight: 2, interactive: false }

    ).addTo(store.map);
  }

}

// highlights portal with given GUID. Automatically clears highlights
// on old selection. Returns false if the selected portal changed.
// Returns true if it's still the same portal that just needs an
// update.
export const selectPortal = function (guid:string) {
  let update = store.selectedPortal === guid;
  let oldPortalGuid = store.selectedPortal;
  store.selectedPortal = guid;

  let oldPortal = store.portals[oldPortalGuid];
  let newPortal = store.portals[guid];

  // Restore style of unselected portal
  if (!update && oldPortal) setMarkerStyle(oldPortal, false);

  // Change style of selected portal
  if (newPortal) {
    setMarkerStyle(newPortal, true);


    if (store.map.hasLayer(newPortal)) {
      newPortal.bringToFront();
    }
  }

  setPortalIndicators(newPortal);

  runHooks('portalSelected', { selectedPortalGuid: guid, unselectedPortalGuid: oldPortalGuid });
  return update;
}
