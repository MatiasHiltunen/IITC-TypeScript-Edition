// ARTIFACT ///////////////////////////////////////////////////////

import L from "leaflet";
import { TEAM_NONE, TEAM_RES, TEAM_TO_CSS } from "./config";
import { dialog } from "./dialog";
import { runHooks } from "./hooks";
import { addResumeFunction, isIdle } from "./idle";
import { addLayerGroup, capitalize, escapeHtmlSpecialChars } from "./utils_misc";
import { decodeArray } from "./entity_decode";
import { postAjax } from "./send_request";
import $ from "jquery"


// added as part of the ingress #13magnus in november 2013, artifacts
// are additional game elements overlayed on the intel map
// currently there are only jarvis-related entities
// - shards: move between portals (along links) each hour. more than one can be at a portal
// - targets: specific portals - one per team
// the artifact data includes details for the specific portals, so can be useful
// 2014-02-06: intel site updates hint at new 'amar artifacts', likely following the same system as above


export class Artifact {
  REFRESH_JITTER: number;
  REFRESH_SUCCESS: number;
  REFRESH_FAILURE: number;
  idle: boolean;
  portalInfo = {};
  artifactTypes = {};
  entities = [];
  _layer: L.LayerGroup<any>;



  constructor() {
    this.REFRESH_JITTER = 2 * 60;  // 2 minute random period so not all users refresh at once
    this.REFRESH_SUCCESS = 60 * 60;  // 60 minutes on success
    this.REFRESH_FAILURE = 2 * 60;  // 2 minute retry on failure

    this.idle = false;
    this.clearData();

  
    addResumeFunction(this.idleResume);

    // move the initial data request onto a very short timer. prevents thrown exceptions causing IITC boot failures
    setTimeout(this.requestData, 1);

    this._layer = new L.LayerGroup();
    addLayerGroup('Artifacts', this._layer, true);

    $('<a>')
      .html('Artifacts')
      .attr({
        id: 'artifacts-toolbox-link',
        title: 'Show artifact portal list'
      })
      .on("click", this.showArtifactList)
      .appendTo('#toolbox');
  }

  requestData() {
  
    if (isIdle()) {
      this.idle = true;
    } else {
  
      postAjax('getArtifactPortals', {}).then(this.handleSuccess).catch(this.handleFailure) 
    }
  }

  idleResume() {
    if (this.idle) {
      this.idle = false;
      this.requestData();
    }
  }

  handleSuccess(data) {
    this.processData(data);

    // start the next refresh at a multiple of REFRESH_SUCCESS seconds, plus a random REFRESH_JITTER amount to prevent excessive server hits at one time
    let now = Date.now();
    let nextTime = Math.ceil(now / (this.REFRESH_SUCCESS * 1000)) * (this.REFRESH_SUCCESS * 1000) + Math.floor(Math.random() * this.REFRESH_JITTER * 1000);

    // console.log(nextTime)
    setTimeout(this.requestData, nextTime - now);
  }

  handleFailure(error) {
    // no useful data on failure - do nothing
    // console.log("failure", error)
    // TODO: Why is this here?
    setTimeout(this.requestData, this.REFRESH_FAILURE * 1000);
  }


  processData(data) {

    if (data.error || !data.result) {
      // console.warn('Failed to find result in getArtifactPortals response');
      return;
    }

    let oldArtifacts = this.entities;
    this.clearData();

    this.processResult(data.result);
  
    runHooks('artifactsUpdated', { old: oldArtifacts, 'new': this.entities });

    // redraw the artifact layer
    this.updateLayer();

  }


  clearData = function () {
    this.portalInfo = {};
    this.artifactTypes = {};

    this.entities = [];
  }


  processResult = function (portals) {
    // portals is an object, keyed from the portal GUID, containing the portal entity array

    for (let guid in portals) {
      let ent = portals[guid];
  
      let data = decodeArray.portal(ent, 'summary');

      if (!data.artifactBrief) {
        // 2/12/2017 - Shard removed from a portal leaves it in artifact results but has no artifactBrief
        continue;
      }

      // we no longer know the faction for the target portals, and we don't know which fragment numbers are at the portals
      // all we know, from the portal summary data, for each type of artifact, is that each artifact portal is
      // - a target portal or not - no idea for which faction
      // - has one (or more) fragments, or not

      if (!this.portalInfo[guid]) this.portalInfo[guid] = {};

      // store the decoded data - needed for lat/lng for layer markers
      this.portalInfo[guid]._data = data;

      for (let type in data.artifactBrief.target) {
        if (!this.artifactTypes[type]) this.artifactTypes[type] = {};

        if (!this.portalInfo[guid][type]) this.portalInfo[guid][type] = {};

        this.portalInfo[guid][type].target = TEAM_NONE;  // as we no longer know the team...
      }

      for (let type in data.artifactBrief.fragment) {
        if (!this.artifactTypes[type]) this.artifactTypes[type] = {};

        if (!this.portalInfo[guid][type]) this.portalInfo[guid][type] = {};

        this.portalInfo[guid][type].fragments = true; //as we no longer have a list of the fragments there
      }


      // let's pre-generate the entities needed to render the map - array of [guid, timestamp, ent_array]
      this.entities.push([guid, data.timestamp, ent]);

    }

  }

  getArtifactTypes = function () {
    return Object.keys(this.artifactTypes);
  }

  isArtifact = function (type) {
    return type in this.artifactTypes;
  }

  // used to render portals that would otherwise be below the visible level
  getArtifactEntities = function () {
    return this.entities;
  }

  getInterestingPortals = function () {
    return Object.keys(this.portalInfo);
  }

  // quick test for portal being relevant to artifacts - of any type
  isInterestingPortal = function (guid) {
    return guid in this.portalInfo;
  }

  // get the artifact data for a specified artifact id (e.g. 'jarvis'), if it exists - otherwise returns something 'false'y
  getPortalData = function (guid, artifactId) {
    return this.portalInfo[guid] && this.portalInfo[guid][artifactId];
  }

  updateLayer = function () {
    this._layer.clearLayers();

    $.each(this.portalInfo, function (_, data) {
   
      let latlng = L.latLng([data._data.latE6 / 1E6, data._data.lngE6 / 1E6]);

      $.each(data, function (updateType: string) {

        // we'll construct the URL form the updateType - stock seems to do that now

        let iconUrl;
        let iconSize
        let opacity
        let icon
        let marker
        if (data[updateType].target !== undefined) {
          // target portal
          iconUrl = '//commondatastorage.googleapis.com/ingress.com/img/map_icons/marker_images/' + updateType + '_shard_target.png'
          iconSize = 100 / 2;
          opacity = 1.0;
         
          icon = L.icon({
            iconUrl: iconUrl,
            iconSize: [iconSize, iconSize],
            iconAnchor: [iconSize / 2, iconSize / 2]
          });
      
          marker = L.marker(latlng, { icon: icon, interactive: false, keyboard: false, opacity: opacity });

          this._layer.addLayer(marker);

        } else if (data[updateType].fragments) {
          // fragment(s) at portal

          iconUrl = '//commondatastorage.googleapis.com/ingress.com/img/map_icons/marker_images/' + updateType + '_shard.png'
          iconSize = 60 / 2;
          opacity = 0.6;
      
          icon = L.icon({
            iconUrl: iconUrl,
            iconSize: [iconSize, iconSize],
            iconAnchor: [iconSize / 2, iconSize / 2],
          });
 
          marker = L.marker(latlng, { icon: icon, interactive: false, keyboard: false, opacity: opacity });

          this._layer.addLayer(marker);

        }

      });  //end $.each(data, function(type,detail)

    }); //end $.each(artifact.portalInfo, function(guid,data)

  }


  showArtifactList = function () {
    let html = '';

    if (Object.keys(this.artifactTypes).length == 0) {
      html += '<i>No artifacts at this time</i>';
    }

    let first = true;
    $.each(this.artifactTypes, function (type: string) {
      // no nice way to convert the Niantic internal name into the correct display name
      // (we do get the description string once a portal with that shard type is selected - could cache that somewhere?)
      let name = capitalize(type) + ' shards';

      if (!first) html += '<hr>';
      first = false;
      html += '<div><b>' + name + '</b></div>';

      html += '<table class="artifact artifact-' + type + '">';
      html += '<tr><th>Portal</th><th>Details</th></tr>';

      let tableRows = [];

      $.each(this.portalInfo, function (guid: string, data) {
        if (type in data) {
          // this portal has data for this artifact type - add it to the table

          let onclick = 'zoomToAndShowPortal(\'' + guid + '\',[' + data._data.latE6 / 1E6 + ',' + data._data.lngE6 / 1E6 + '])';
          let row = '<tr><td class="portal"><a onclick="' + onclick + '">' + escapeHtmlSpecialChars(data._data.title) + '</a></td>';

          row += '<td class="info">';

          if (data[type].target !== undefined) {
            if (data[type].target == TEAM_NONE) {
              row += '<span class="target">Target Portal</span> ';
            } else {
              row += '<span class="target ' + TEAM_TO_CSS[data[type].target] + '">' + (data[type].target == TEAM_RES ? 'Resistance' : 'Enlightened') + ' target</span> ';
            }
          }

          if (data[type].fragments) {
            if (data[type].target !== undefined) {
              row += '<br>';
            }
            let fragmentName = 'shard';
            //          row += '<span class="fragments'+(data[type].target?' '+TEAM_TO_CSS[data[type].target]:'')+'">'+fragmentName+': #'+data[type].fragments.join(', #')+'</span> ';
            row += '<span class="fragments' + (data[type].target ? ' ' + TEAM_TO_CSS[data[type].target] : '') + '">' + fragmentName + ': yes</span> ';
          }

          row += '</td></tr>';

          // sort by target portals first, then by portal GUID
          let sortVal = (data[type].target !== undefined ? 'A' : 'Z') + guid;

          tableRows.push([sortVal, row]);
        }
      });

      // check for no rows, and add a note to the table instead
      if (tableRows.length == 0) {
        html += '<tr><td colspan="2"><i>No portals at this time</i></td></tr>';
      }

      // sort the rows
      tableRows.sort(function (a, b) {
        if (a[0] == b[0]) return 0;
        else if (a[0] < b[0]) return -1;
        else return 1;
      });

      // and add them to the table
      html += tableRows.map(function (a) { return a[1]; }).join('');


      html += '</table>';
    });

    // In Summer 2015, Niantic changed the data format for artifact portals. We no longer know:
    // - Which team each target portal is for - only that it is a target
    // - Which shards are at each portal, just that it has one or more shards
    // You can select a portal and the detailed data contains the list of shard numbers, but there's still no
    // more information on targets

    dialog({
      title: 'Artifacts',
      id: 'iitc-artifacts',
      html: html,
      width: 400,
      position: { my: 'right center', at: 'center-60 center', of: window, collision: 'fit' }
    });

  }
}