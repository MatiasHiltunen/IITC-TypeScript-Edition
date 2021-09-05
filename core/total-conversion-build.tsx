

import { boot } from "./code/boot";
import { Player } from "./code/player";
import { store } from "./code/store";

import { head, loginHead } from "./views/head";
import App from './views/app'
import * as React from 'react'
import * as ReactDOM from 'react-dom'

/* import { E } from "./tools/dom_manipulation"; */

declare global {
  var plugin: any;  // window.plugin is needed for monkeyscript
  var script_info: any; // window.script_info is probably needed for monkeyscript
  var plugin_info: {} // plugin_info comes from monkeyScript wrapper function and is not part of the global object
  var PLAYER: { nickname, available_invites, energy, xm_capacity, ap, team, min_ap_for_current_level, min_ap_for_next_level, verified_level }
  var android: any
}

// ensure plugin framework is there, even if iitc is not yet loaded
if (typeof window.plugin !== 'function') window.plugin = function () { };

window.script_info = plugin_info;

// REPLACE ORIGINAL SITE 
if (document.documentElement.getAttribute('itemscope') !== null) {
  throw new Error('Ingress Intel Website is down, not a userscript issue.');
}

// disable original JS
window.onload = () => { };
document.body.onload = () => { };

if (!window.PLAYER || !PLAYER.nickname) {
  // page doesn’t have a script tag with player information.
  if (document.getElementById('header_email')) {
    throw new Error("Logged in but page doesn't have player data");
  }
  // FIXME: handle nia takedown in progress

  // add login form stylesheet
  document.head.appendChild(loginHead);

  throw new Error("Couldn't retrieve player data. Are you logged in?");
}


store.PLAYER = new Player(window.PLAYER)

interface NianticParams {
  version: string
  zoomToLevel: number[],
  tilesPerEdge: number[]
}


const extractFromStock = ():NianticParams => {

  let data: NianticParams = {
    version: null,
    zoomToLevel: null,
    tilesPerEdge: null
  }
  // extract the former nemesis.dashboard.config.CURRENT_VERSION from the code
  let reVersion = new RegExp('"X-CSRFToken".*[a-z].v="([a-f0-9]{40})";');

  let minified = new RegExp('^[a-zA-Z$][a-zA-Z$0-9]?$');

  for (let topLevel in window) {
    if (minified.test(topLevel)) {
      // a minified object - check for minified prototype entries

      let topObject = window[topLevel];
      // @ts-ignore
      if (topObject && topObject.prototype) {

        // the object has a prototype - iterate through the properties of that
        // @ts-ignore
        for (let secLevel in topObject.prototype) {
          if (minified.test(secLevel)) {
            // looks like we've found an object of the format "XX.prototype.YY"...
            // @ts-ignore
            let item = topObject.prototype[secLevel];

            if (item && typeof (item) == "function") {
              // a function - test it against the relevant regular expressions
              let funcStr = item.toString();

              let match = reVersion.exec(funcStr);
              if (match) {
                // log.log('Found former CURRENT_VERSION in '+topLevel+'.prototype.'+secLevel);

                data.version = match[1];

                if(!data.version) throw 'Iitc is broken.'
              }
            }
          }
        }

      } 

      if (topObject && Array.isArray && Array.isArray(topObject)) {
        // find all non-zero length arrays containing just numbers
        if (topObject.length > 0) {
          let justInts = true;
          for (let i = 0; i < topObject.length; i++) {
            if (typeof (topObject[i]) !== 'number' || topObject[i] != parseInt(topObject[i])) {
              justInts = false;
              break;
            }
          }
          if (justInts) {

            // current lengths are: 17: ZOOM_TO_LEVEL, 14: TILES_PER_EDGE
            // however, slightly longer or shorter are a possibility in the future

            if (topObject.length >= 12 && topObject.length <= 18) {
              // a reasonable array length for tile parameters
              // need to find two types:
              // a. portal level limits. decreasing numbers, starting at 8
              // b. tiles per edge. increasing numbers. current max is 36000, 9000 was the previous value - 18000 is a likely possibility too

              if (topObject[0] == 8) {
                // check for tile levels
                let decreasing = true;
                for (let i = 1; i < topObject.length; i++) {
                  if (topObject[i - 1] < topObject[i]) {
                    decreasing = false;
                    break;
                  }
                }
                if (decreasing) {

                  data.zoomToLevel = topObject;
                }
              } // end if (topObject[0] == 8)

              // 2015-06-25 - changed to top value of 64000, then to 32000 - allow for them to restore it just in case
              if (topObject[topObject.length - 1] >= 9000 && topObject[topObject.length - 1] <= 64000) {
                let increasing = true;
                for (let i = 1; i < topObject.length; i++) {
                  if (topObject[i - 1] > topObject[i]) {
                    increasing = false;
                    break;
                  }
                }
                if (increasing) {

                  data.tilesPerEdge = topObject;
                }

              } //end if (topObject[topObject.length-1] == 9000) {

            }
          }
        }
      }


    }
  }
  return data;
}

console.log(extractFromStock())

document.head.innerHTML = ''
document.head.replaceWith(head)
document.body.innerHTML = '<div id="root"></div>'




ReactDOM.render(
  <App></App>,
  document.getElementById('root')
);
window.addEventListener('load', ()=>{
  /* boot() */

});



/*  */