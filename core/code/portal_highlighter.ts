// Portal Highlighter //////////////////////////////////////////////////////////
// these functions handle portal highlighters
import { store } from './store'
import { setMarkerStyle } from "./portal_marker";
import $ from "jquery"
// an object mapping highlighter names to the object containing callback functions
let _highlighters = null;

// the name of the current highlighter
let _current_highlighter = localStorage.portal_highlighter;

let _no_highlighter = 'No Highlights';


export const addPortalHighlighter = function(name, data) {
  if(_highlighters === null) {
    _highlighters = {};
  }

  // old-format highlighters just passed a callback function. this is the same as just a highlight method
  if (!data.highlight) {
    data = {highlight: data}
  }

  _highlighters[name] = data;
  // @ts-ignore
  if (typeof android !== 'undefined' && android && android.addPortalHighlighter)
  // @ts-ignore
    android.addPortalHighlighter(name);

  if(_current_highlighter === undefined) {
    _current_highlighter = name;
  }

  if (_current_highlighter == name) {
  // @ts-ignore
    if (typeof android !== 'undefined' && android && android.setActiveHighlighter)
  // @ts-ignore
      android.setActiveHighlighter(name);

    // call the setSelected callback 
    if (_highlighters[_current_highlighter].setSelected) {
      _highlighters[_current_highlighter].setSelected(true);
    }

  }
  updatePortalHighlighterControl();
}

// (re)creates the highlighter dropdown list
export const updatePortalHighlighterControl = function() {
  // @ts-ignore
  if (typeof android !== 'undefined' && android && android.addPortalHighlighter) {
    $('#portal_highlight_select').remove();
    return;
  }

  if(_highlighters !== null) {
    if($('#portal_highlight_select').length === 0) {
      $("body").append("<select id='portal_highlight_select'></select>");
      $("#portal_highlight_select").change(function(){ changePortalHighlights($(this).val());});
      $(".leaflet-top.leaflet-left").css('padding-top', '20px');
      $(".leaflet-control-scale-line").css('margin-top','25px');
    }
    $("#portal_highlight_select").html('');
    $("#portal_highlight_select").append($("<option>").attr('value',_no_highlighter).text(_no_highlighter));
    let h_names = Object.keys(_highlighters).sort();
    
    $.each(h_names, function(i, name) {  
      $("#portal_highlight_select").append($("<option>").attr('value',name).text(name));
    });

    $("#portal_highlight_select").val(_current_highlighter);
  }
}

export const changePortalHighlights = function(name) {

  // first call any previous highlighter select callback
  if (_current_highlighter && _highlighters[_current_highlighter] && _highlighters[_current_highlighter].setSelected) {
    _highlighters[_current_highlighter].setSelected(false);
  }

  _current_highlighter = name;
  // @ts-ignore
  if (typeof android !== 'undefined' && android && android.setActiveHighlighter)
  // @ts-ignore
    android.setActiveHighlighter(name);

  // now call the setSelected callback for the new highlighter
  if (_current_highlighter && _highlighters[_current_highlighter] && _highlighters[_current_highlighter].setSelected) {
    _highlighters[_current_highlighter].setSelected(true);
  }

  resetHighlightedPortals();
  localStorage.portal_highlighter = name;
}

export const highlightPortal = function(p) {
  
  if(_highlighters !== null && _highlighters[_current_highlighter] !== undefined) {
    _highlighters[_current_highlighter].highlight({portal: p});
  }
}

export const resetHighlightedPortals = function() {
  $.each(store.portals, function(guid, portal) {
    setMarkerStyle(portal, guid === store.selectedPortal);
  });
}
