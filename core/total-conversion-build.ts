

import { boot } from "./code/boot";
import { Player } from "./code/player";
import { RegionScoreboard } from "./code/region_scoreboard";
import { store } from "./code/store";

// Import css files with txt file extension, check the build script for more details
// ts-ignore is required here as the esbuild does the injection in the build time.
// @ts-ignore
import loginStyle from './style/login.txt';
// @ts-ignore
import cssStyles from './style/style.txt'


// REPLACE ORIGINAL SITE ///////////////////////////////////////////////////
if (document.documentElement.getAttribute('itemscope') !== null) {
  throw new Error('Ingress Intel Website is down, not a userscript issue.');
}
// @ts-ignore
window.iitcBuildDate = '2021-07-16-195801';

// disable vanilla JS
window.onload = function () { };
document.body.onload = function () { };

//originally code here parsed the <Script> tags from the page to find the one that defined the PLAYER object
//however, that's already been executed, so we can just access PLAYER - no messing around needed!



// @ts-ignore
if (!window.PLAYER || !PLAYER.nickname) {
  // page doesn’t have a script tag with player information.
  if (document.getElementById('header_email')) {
    // however, we are logged in.
    // it used to be regularly common to get temporary 'account not enabled' messages from the intel site.
    // however, this is no longer common. more common is users getting account suspended/banned - and this
    // currently shows the 'not enabled' message. so it's safer to not repeatedly reload in this case
    // //setTimeout('location.reload();', 3*1000);
    throw new Error("Logged in but page doesn't have player data");
  }
  // FIXME: handle nia takedown in progress

  // add login form stylesheet
  var style = document.createElement('style');
  style.type = 'text/css';
  style.appendChild(document.createTextNode(loginStyle));
  document.head.appendChild(style);

  throw new Error("Couldn't retrieve player data. Are you logged in?");
}

// @ts-ignore

// player information is now available in a hash like this:
// window.PLAYER = {"ap": "123", "energy": 123, "available_invites": 123, "nickname": "somenick", "team": "ENLIGHTENED||RESISTANCE"};
// Fix the comments above, player is now stored in the store.PLAYER
store.PLAYER = new Player(window.PLAYER)

// remove complete page. We only wanted the user-data and the page’s
// security context so we can access the API easily. Setup as much as
// possible without requiring scripts.
document.head.innerHTML = '' +
  '<title>Ingress Intel Map</title>' +
  '<style>' + cssStyles + '</style>'
  //note: smartphone.css injection moved into code/smartphone.js
  +
  '<link rel="stylesheet" type="text/css" href="//fonts.googleapis.com/css?family=Roboto:100,100italic,300,300italic,400,400italic,500,500italic,700,700italic&subset=latin,cyrillic-ext,greek-ext,greek,vietnamese,latin-ext,cyrillic"/>';

// remove body element entirely to remove event listeners
document.body = document.createElement('body');
document.body.innerHTML = '' +
  '<div id="map">Loading, please wait</div>' +
  '<div id="chatcontrols" style="display:none">' +
  '<a accesskey="0" title="[0]"><span class="toggle"></span></a>' +
  '<a accesskey="1" title="[1]">all</a>' +
  '<a accesskey="2" title="[2]" class="active">faction</a>' +
  '<a accesskey="3" title="[3]">alerts</a>' +
  '</div>' +
  '<div id="chat" style="display:none">' +
  '  <div id="chatfaction"></div>' +
  '  <div id="chatall"></div>' +
  '  <div id="chatalerts"></div>' +
  '</div>' +
  '<form id="chatinput" style="display:none"><table><tr>' +
  '  <td><time></time></td>' +
  '  <td><mark>tell faction:</mark></td>' +
  '  <td><input id="chattext" type="text" maxlength="256" accesskey="c" title="[c]" /></td>' +
  '</tr></table></form>' +
  '<a id="sidebartoggle" accesskey="i" title="Toggle sidebar [i]"><span class="toggle close"></span></a>' +
  '<div id="scrollwrapper">' // enable scrolling for small screens
  +
  '  <div id="sidebar" style="display: block">' +
  '    <div id="playerstat">t</div>' +
  '    <div id="gamestat">&nbsp;loading global control stats</div>' +
  '    <div id="searchwrapper">' +
  '      <button title="Current location" id="buttongeolocation"><img src="' + 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyRpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMC1jMDYxIDY0LjE0MDk0OSwgMjAxMC8xMi8wNy0xMDo1NzowMSAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNS4xIE1hY2ludG9zaCIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDoxNjM1OTRFNUE0RTIxMUUxODNBMUZBQ0ZFQkJDNkRBQiIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDoxNjM1OTRFNkE0RTIxMUUxODNBMUZBQ0ZFQkJDNkRBQiI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOjE2MzU5NEUzQTRFMjExRTE4M0ExRkFDRkVCQkM2REFCIiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOjE2MzU5NEU0QTRFMjExRTE4M0ExRkFDRkVCQkM2REFCIi8+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8P3hwYWNrZXQgZW5kPSJyIj8+kxvtEgAAAWVJREFUeNqsVctRwzAUlDTccQlxB3RA0kHSQXLxNXEFgQrsHO1L6AA6cKgAd4BLEBXAU2YfszY2oMCb2Rlbelqv3s+2qiozYjPBVjAX3Az2WsFJcBB0WZb1Nt0IWSF4FexGyAzWdvAp6rpOpgjDxgucg3lBKViRzz3WPN6Db8OkjsgaUvQgSAW54IkI77CWwkcVN0PCPZFtAG+mzZPfmVRUhlAZK0mZIR6qbGPi7ChY4zl1yKZ+NTfxltNttg6loep8LJuUjad4zh3F7s1cbs8ayxDD9xEH+0uiL2ed+WdjwhWU2YjzVmJoUfCfhC2eb/8g7Fr73KHRDWopiWVC22kdnhymhrZfcYG6goQcAmGHhleV64lsjlUD+5cSz85RtbfUSscfrp+Qn87Ic2KuyGlBEyd8dYkO4IJfInkc70C2QMf0CD1I95hzCc1GtcfBe7hm/l1he5p3JYVh+AsoaV727EOAAQAWgF3ledLuQAAAAABJRU5ErkJggg==' + '" alt="Current location"/></button>' +
  '      <input id="search" placeholder="Search location…" type="search" accesskey="f" title="Search for a place [f]"/>' +
  '    </div>' +
  '    <div id="portaldetails"></div>' +
  '    <input id="redeem" placeholder="Redeem code…" type="text"/>' +
  '    <div id="toolbox">' +
  '      <a onmouseover="setPermaLink(this)" onclick="setPermaLink(this);return androidPermalink()" title="URL link to this map view">Permalink</a>' +
  '      <a onclick="window.aboutIITC()" style="cursor: help">About IITC</a>' +
  '    </div>' +
  '  </div>' +
  '</div>' +
  '<div id="updatestatus"><div id="innerstatus"></div></div>'
  // avoid error by stock JS
  +
  '<div id="play_button"></div>' +
  '<div id="header"><div id="nav"></div></div>';

// STORAGE ///////////////////////////////////////////////////////////
// global variables used for storage. Most likely READ ONLY. Proper
// way would be to encapsulate them in an anonymous function and write
// getters/setters, but if you are careful enough, this works.




// plugin framework. Plugins may load earlier than iitc, so don’t
// overwrite data
// @ts-ignore
if (typeof window.plugin !== 'function') window.plugin = function () { };


/* if (document.readyState === 'complete') { // IITCm
  setTimeout(boot);
} else {
  window.addEventListener('load', function () {
      setTimeout(boot);
  });
}
 */
window.addEventListener('load', (event) => {


  boot()
  // fixed Addons
  const rboard = new RegionScoreboard()
  
  rboard.setup()
});




