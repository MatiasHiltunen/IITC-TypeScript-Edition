
// SEARCH /////////////////////////////////////////////////////////

/*
you can implement your own result provider by listing to the search hook:
addHook('search', function(query) {});

`query` is an object with the following members:
- `term` is the term for which the user has searched
- `confirmed` is a boolean indicating if the user has pressed enter after searching. You should not search online or
  do heavy processing unless the user has confirmed the search term
- `addResult(result)` can be called to add a result to the query.

`result` may have the following members (`title` is required, as well as one of `position` and `bounds`):
- `title`: the label for this result. Will be interpreted as HTML, so make sure to escape properly.
- `description`: secondary information for this result. Will be interpreted as HTML, so make sure to escape properly.
- `position`: a L.LatLng object describing the position of this result
- `bounds`: a L.LatLngBounds object describing the bounds of this result
- `layer`: a ILayer to be added to the map when the user selects this search result. Will be generated if not set.
  Set to `null` to prevent the result from being added to the map.
- `icon`: a URL to a icon to display in the result list. Should be 12x12.
- `onSelected(result, event)`: a handler to be called when the result is selected. May return `true` to prevent the map
  from being repositioned. You may reposition the map yourself or do other work.
- `onRemove(result)`: a handler to be called when the result is removed from the map (because another result has been
  selected or the search was cancelled by the user).
*/
import $ from "jquery"
import { store } from './store'
import { COLORS, DEFAULT_ZOOM, NOMINATIM, TEAM_NONE } from "./config";
import { addHook, runHooks } from "./hooks";
import { show } from "./panes";
import { renderPortalDetails } from "./portal_detail_display";
import { isSmartphone, useAndroidPanes } from "./smartphone";
import { selectPortalByLatLng, zoomToAndShowPortal } from "./utils_misc";
import L from 'leaflet'

export let search = {
  lastSearch: null,
  Query: null,
  doSearch: null,
  setup: null,
  timer: null
};

search.Query = function(term, confirmed) {
  this.term = term;
  this.confirmed = confirmed;
  this.init();
};
search.Query.prototype.init = function() {
  this.results = [];

  this.container = $('<div>').addClass('searchquery');

  this.header = $('<h3>')
    .text(this.confirmed
      ? this.term
      : ((this.term.length > 16
        ? this.term.substr(0,8) + '…' + this.term.substr(this.term.length-8,8)
        : this.term)
        + ' (Return to load more)'))
    .appendTo(this.container);

  this.list = $('<ul>')
    .appendTo(this.container)
    .append($('<li>').text(this.confirmed ? 'No local results, searching online...' : 'No local results.'));

  this.container.accordion({
    collapsible: true,
    heightStyle: 'content',
  });

  runHooks('search', this);
};
search.Query.prototype.show = function() {
  this.container.appendTo('#searchwrapper');
};
search.Query.prototype.hide = function() {
  this.container.remove();
  this.removeSelectedResult();
  this.removeHoverResult();
};
search.Query.prototype.addResult = function(result) {
  if(this.results.length == 0) {
    // remove 'No results'
    this.list.empty();
  }

  this.results.push(result);
  let item = $('<li>')
    .appendTo(this.list)
    .attr('tabindex', '0')
    .on('click dblclick', function(ev) {
      this.onResultSelected(result, ev);
    }.bind(this))
    .on('mouseover', function(ev) {
      this.onResultHoverStart(result, ev);
    }.bind(this))
    .on('mouseout', function(ev) {
      this.onResultHoverEnd(result, ev);
    }.bind(this))
    .keypress(function(ev:any) {
      if((ev.keyCode || ev.charCode || ev.which) == 32) {
        ev.preventDefault();
        ev.type = 'click';
        $(this).trigger(ev);
        return;
      }
      if((ev.keyCode || ev.charCode || ev.which) == 13) {
        ev.preventDefault();
        ev.type = 'dblclick';
        $(this).trigger(ev);
        return;
      }
    });

  let link = $('<a>')
    .append(result.title)
    .appendTo(item);

  if(result.icon) {
    link.css('background-image', 'url("'+result.icon+'")');
    item.css('list-style', 'none');
  }
  if(result.description) {
    item
      .append($('<br>'))
      .append($('<em>')
        .append(result.description));
  }
  
};

search.Query.prototype.resultLayer = function(result) {
  if(result.layer !== null && !result.layer) {
    result.layer = L.layerGroup();

    if(result.position) {
      L.marker(result.position, {
        icon: L.divIcon()/* .coloredSvg('red') */,
        title: result.title
      }).addTo(result.layer);
    }

    if(result.bounds) {
      L.rectangle(result.bounds, {
        /* title: result.title, */
        interactive: false,
        color: 'red',
        fill: false,
      }).addTo(result.layer);
    }
  }
return result.layer;

};

search.Query.prototype.onResultSelected = function(result, ev) {
  this.removeHoverResult();
  this.removeSelectedResult();
  this.selectedResult = result;

  if(result.onSelected) {
    if(result.onSelected(result, ev)) return;
  }

  if(ev.type == 'dblclick') {
    if(result.position) {

      store.map.setView(result.position, DEFAULT_ZOOM);
    } else if(result.bounds) {

      store.map.fitBounds(result.bounds, {maxZoom: DEFAULT_ZOOM});
    }
  } else { // ev.type != 'dblclick'
    if(result.bounds) {
  
      store.map.fitBounds(result.bounds, {maxZoom: DEFAULT_ZOOM});
    } else if(result.position) {
 
      store.map.setView(result.position);
    }
  }

  result.layer = this.resultLayer(result);

  if(result.layer)

    store.map.addLayer(result.layer);

  if(isSmartphone()) show('map');
}

search.Query.prototype.removeSelectedResult = function() {
  if(this.selectedResult) {

    if(this.selectedResult.layer) store.map.removeLayer(this.selectedResult.layer);
    if(this.selectedResult.onRemove) this.selectedResult.onRemove(this.selectedResult);
  }
}

search.Query.prototype.onResultHoverStart = function(result, ev) {
  this.removeHoverResult();
  this.hoverResult = result;

  if(result === this.selectedResult) return;

  result.layer = this.resultLayer(result);


  if(result.layer) store.map.addLayer(result.layer);
};

search.Query.prototype.removeHoverResult = function() {
  if(this.hoverResult !== this.selectedResult) {
    if(this.hoverResult) {
   
      if(this.hoverResult.layer) { store.map.removeLayer(this.hoverResult.layer); }
    }
  }
  this.hoverResult = null;
};

search.Query.prototype.onResultHoverEnd = function(result, ev) {
  this.removeHoverResult();
};

search.doSearch = function(term, confirmed) {
  term = term.trim();

  // minimum 3 characters for automatic search
  if(term.length < 3 && !confirmed) return;

  // don't clear last confirmed search
  if(search.lastSearch
  && search.lastSearch.confirmed
  && !confirmed)
    return;

  // don't make the same query again
  if(search.lastSearch
  && search.lastSearch.confirmed == confirmed
  && search.lastSearch.term == term)
    return;

  if(search.lastSearch) search.lastSearch.hide();
  search.lastSearch = null;

  // clear results
  if(term == '') return;

  if(useAndroidPanes()) show('info');

  $('.ui-tooltip').remove();

  search.lastSearch = new search.Query(term, confirmed);
  search.lastSearch.show();
};

search.setup = function() {
  $('#search')
    .on("keypress", (e) => {
      if((e.keyCode ? e.keyCode : e.which) != 13) return;
      e.preventDefault();

      let term = $(this).val();

      clearTimeout(search.timer);
      search.doSearch(term, true);
    })
    .on('keyup keypress change paste', function(e) {
      clearTimeout(search.timer);
      search.timer = setTimeout(function() {
        let term = $(this).val();
        search.doSearch(term, false);
      }.bind(this), 500);
    });
  $('#buttongeolocation').on("click",function(){

    store.map.locate({setView : true, maxZoom: 13});
  });
};


// search for portals
addHook('search', function(query) {
  let term = query.term.toLowerCase();
  let teams = ['NEU','RES','ENL'];

  // Probably better? 
/* 
  for(let arr of Object.entries(store.portals)) {
    
    let [guid, portal]: [guid:string, portal:any] = arr

    let data = portal.options.data;
    if(!data.title) return;

    if(data.title.toLowerCase().indexOf(term) !== -1) {
      let team = portal.options.team;
      let color = team==TEAM_NONE ? '#CCC' : COLORS[team];
      query.addResult({
        title: data.title,
        description: teams[team] + ', L' + data.level + ', ' + data.health + '%, ' + data.resCount + ' Resonators',
        position: portal.getLatLng(),
        icon: 'data:image/svg+xml;base64,'+btoa('@include_string:images/icon-portal.svg@'.replace(/%COLOR%/g, color)),
        onSelected: function(result, event) {
          if(event.type == 'dblclick') {
            zoomToAndShowPortal(guid, portal.getLatLng());
          } else if(store.portals[guid]) {
           
            if(!store.map.getBounds().contains(result.position)) store.map.setView(result.position);
            renderPortalDetails(guid);
          } else {
            const {lat, lng} = portal.getLatLng()
            selectPortalByLatLng(lat, lng);
          }
          return true; // prevent default behavior
        },
      });
    }
  } */

  $.each(store.portals, function(guid, portal:any) {
    let data = portal.options.data;
    if(!data.title) return;

    if(data.title.toLowerCase().indexOf(term) !== -1) {
      let team = portal.options.team;
      let color = team==TEAM_NONE ? '#CCC' : COLORS[team];
      query.addResult({
        title: data.title,
        description: teams[team] + ', L' + data.level + ', ' + data.health + '%, ' + data.resCount + ' Resonators',
        position: portal.getLatLng(),
        icon: 'data:image/svg+xml;base64,'+btoa('@include_string:images/icon-portal.svg@'.replace(/%COLOR%/g, color)),
        onSelected: function(result, event) {
          if(event.type == 'dblclick') {
            zoomToAndShowPortal(guid, portal.getLatLng());
          } else if(store.portals[guid]) {
          
            if(!store.map.getBounds().contains(result.position)) store.map.setView(result.position);
            renderPortalDetails(guid);
          } else {
            const {lat, lng} = portal.getLatLng()
            selectPortalByLatLng(lat, lng);
          }
          return true; // prevent default behavior
        },
      });
    }
  });
});


// search for locations
// TODO: recognize 50°31'03.8"N 7°59'05.3"E and similar formats
addHook('search', function(query) {
  let locations = query.term.match(/[+-]?\d+\.\d+,[+-]?\d+\.\d+/g);
  let added = {};
  if(!locations) return;
  locations.forEach(function(location) {
    let pair = location.split(',').map(function(s) { return parseFloat(s).toFixed(6); });
    let ll = pair.join(",");
    let latlng = L.latLng(pair.map(function(s) { return parseFloat(s); }));
    if(added[ll]) return;
    added[ll] = true;

    query.addResult({
      title: ll,
      description: 'geo coordinates',
      position: latlng,
      onSelected: function(result, event) {
        for(let guid in store.portals) {
          let p = store.portals[guid].getLatLng();
          if((p.lat.toFixed(6)+","+p.lng.toFixed(6)) == ll) {
            renderPortalDetails(guid);
            return;
          }
        }

        store.urlPortalLL = [result.position.lat, result.position.lng];
      },
    });
  });
});


// search on OpenStreetMap
addHook('search', function(query) {
  if(!query.confirmed) return;

  // Viewbox search orders results so they're closer to the viewbox

  let mapBounds = store.map.getBounds();
  let viewbox = '&viewbox=' + mapBounds.getSouthWest().lng + ',' + mapBounds.getSouthWest().lat + ',' + mapBounds.getNorthEast().lng + ',' + mapBounds.getNorthEast().lat;

  let resultCount = 0;
  let resultMap = {};
  function onQueryResult(isViewboxResult, data) {
    resultCount += data.length;
    if(isViewboxResult) {
      // Search for things outside the viewbox
      $.getJSON(NOMINATIM + encodeURIComponent(query.term) + viewbox, onQueryResult.bind(null, false));
      if(resultCount === 0) { return; }
    } else {
      if(resultCount === 0) {
        query.addResult({
          title: 'No results on OpenStreetMap',
          icon: '//www.openstreetmap.org/favicon.ico',
          onSelected: function() {return true;},
        });
        return;
      }
    }

    data.forEach(function(item) {
      if(resultMap[item.place_id]) { return; } // duplicate
      resultMap[item.place_id] = true;
      
      let result = {
        title: item.display_name,
        description: 'Type: ' + item.type,
        position: L.latLng(parseFloat(item.lat), parseFloat(item.lon)),
        icon: item.icon,
        layer: null,
        bounds: null
      };

     /*  if(item.geojson) {
        result.layer = L.geoJson(item.geojson, {
          interactive: false,
          color: 'red',
          opacity: 0.7,
          weight: 2,
          fill: false,
          pointToLayer: function(featureData,latLng) {
            return L.marker(latLng, {
              icon:L.divIcon().coloredSvg('red'),
              title: item.display_name
            });
          }
        });
      } */

      let b = item.boundingbox;
      if(b) {
        let southWest = new L.LatLng(b[0], b[2]),
            northEast = new L.LatLng(b[1], b[3]);
        result.bounds = new L.LatLngBounds(southWest, northEast);
      }

      query.addResult(result);
    });
  }
  
  // Bounded search allows amenity-only searches (e.g. "amenity=toilet") via special phrases
  // http://wiki.openstreetmap.org/wiki/Nominatim/Special_Phrases/EN
  let bounded = '&bounded=1';
  
  $.getJSON(NOMINATIM + encodeURIComponent(query.term) + viewbox + bounded, onQueryResult.bind(null, true));
});

