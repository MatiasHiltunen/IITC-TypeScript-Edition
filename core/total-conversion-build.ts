

import { boot } from "./code/boot";
import { Player } from "./code/player";
import { RegionScoreboard } from "./code/region_scoreboard";
import { store } from "./code/store";

// ==UserScript==
// @author         Matias Hiltunen
// @name           IITC: Ingress intel map total conversion - TypeScript Edition
// @version        0.0.1
// @description    Total conversion for the ingress intel map.
// @run-at         document-end
// @id             total-conversion-build
// @namespace      https://github.com/IITC-CE/ingress-intel-total-conversion
// @updateURL      https://iitc.app/build/release/total-conversion-build.meta.js
// @downloadURL    https://iitc.app/build/release/total-conversion-build.user.js
// @match          https://intel.ingress.com/*
// @grant          none
// ==/UserScript==



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
  style.appendChild(document.createTextNode('\
    html, body {\
        background: #0b303e;\
    }\
    \
    #dashboard_container {\
        display: flex;\
        flex-direction: column;\
        min-width: 245px;\
        min-height: 365px;\
    }\
    \
    .button {\
        margin: 5px 10%;\
        padding: 0;\
    }\
    \
    #dashboard_container a {\
        display: block;\
        padding: 10px 15px;\
    }\
    '));
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
  '<style>' + '\
    /* general rules ******************************************************/\
    \
    /* for printing directly from the browser, hide all UI components\
     * NOTE: @media needs to be first?\
     */\
    @media print {\
      .leaflet-control-container { display: none !important; }\
      #chatcontrols, #chat, #chatinput { display: none !important; }\
      #sidebartoggle, #sidebar { display: block !important; }\
      #updatestatus { display: none !important; }\
      #portal_highlight_select { display: none !important; }\
    }\
    \
    .text-overflow-ellipsis {\
      display: inline-block;\
      overflow: hidden;\
      white-space: nowrap;\
      text-overflow: ellipsis;\
      vertical-align: text-bottom;\
      width: 100%;\
    }\
    \
    \
    html, body {\
      height: 100%;\
      width: 100%;\
      overflow: hidden; /* workaround for #373 */\
      background: #0e3d4e;\
    }\
    \
    #map {\
      overflow: visible;\
      height: 100%;\
      width: 100%;\
    }\
    \
    \
    body {\
      font-size: 14px;\
      font-family: Roboto, "Helvetica Neue", Helvetica, sans-serif;\
      margin: 0;\
    }\
    \
    /* Material Icons */\
    .material-icons {\
      width: 24px;\
      height: 24px;\
    }\
    \
    .icon-button {\
      cursor: pointer;\
    }\
    \
    i.tiny { font-size: 1rem; }\
    i.small { font-size: 2rem; }\
    i.medium { font-size: 4rem; }\
    i.large { font-size: 6rem; }\
    \
    #scrollwrapper {\
      overflow-x: hidden;\
      overflow-y: auto;\
      position: fixed;\
      right: -38px;\
      top: 0;\
      width: 340px;\
      bottom: 45px;\
      z-index: 3001;\
      pointer-events: none;\
    }\
    \
    #sidebar {\
      display: block;\
      background-color: rgba(8, 48, 78, 0.9);\
      border-left: 1px solid #20A8B1;\
      color: #888;\
      position: relative;\
      left: 0;\
      top: 0;\
      max-height: 100%;\
      overflow-y:scroll;\
      overflow-x:hidden;\
      pointer-events: auto;\
    }\
    \
    #sidebartoggle {\
      display: block;\
      padding: 20px 5px;\
      margin-top: -31px; /* -(toggle height / 2) */\
      line-height: 10px;\
      position: absolute;\
      top: 108px;\
      z-index: 3002;\
      background-color: rgba(8, 48, 78, 0.9);\
      color: #FFCE00;\
      border: 1px solid #20A8B1;\
      border-right: none;\
      border-radius: 5px 0 0 5px;\
      text-decoration: none;\
      right: -50px; /* overwritten later by the script with SIDEBAR_WIDTH */\
    }\
    \
    .enl {\
      color: #03fe03 !important;\
    }\
    \
    .res {\
      color: #00c5ff !important;\
    }\
    \
    .none {\
      color: #fff;\
    }\
    \
    .nickname {\
      cursor: pointer !important;\
    }\
    \
    a {\
      color: #ffce00;\
      cursor: pointer;\
      text-decoration: none;\
    }\
    \
    a:hover {\
      text-decoration: underline;\
    }\
    \
    .leaflet-control-layers-overlays label.disabled {\
      text-decoration: line-through;\
      cursor: help;\
    }\
    \
    /* base layer selection - first column */\
    .leaflet-control-layers-base {\
      float: left;\
      overflow-y: auto;\
      max-height: 600px;\
    }\
    \
    /* overlays layer selection - 2nd column */\
    .leaflet-control-layers-overlays {\
      float: left;\
      margin-left: 8px;\
      border-left: 1px solid #DDDDDD;\
      padding-left: 8px;\
      overflow-y: auto;\
      max-height: 600px;\
    }\
    \
    /* hide the usual separator */\
    .leaflet-control-layers-separator {\
      display: none;\
    }\
    \
    \
    /* shift controls when chat is expanded */\
    .leaflet-left .leaflet-control.chat-expand {\
      margin-left: 720px;\
    }\
    \
    .help {\
      cursor: help;\
    }\
    \
    .toggle {\
      display: block;\
      height: 0;\
      width: 0;\
    }\
    \
    /* field mu count */\
    .fieldmu {\
      color: #FFCE00;\
      font-size: 13px;\
      font-family: Roboto, "Helvetica Neue", Helvetica, sans-serif; /*override leaflet-container */\
      text-align: center;\
      text-shadow: 0 0 0.2em black, 0 0 0.2em black, 0 0 0.2em black;\
      pointer-events: none;\
    }\
    \
    \
    /* chat ***************************************************************/\
    \
    #chatcontrols {\
      color: #FFCE00;\
      background: rgba(8, 48, 78, 0.9);\
      position: absolute;\
      left: 0;\
      z-index: 3000;\
      height: 26px;\
      padding-left:1px;\
    }\
    \
    #chatcontrols.expand {\
      top: 0;\
      bottom: auto;\
    }\
    \
    #chatcontrols a {\
      margin-left: -1px;\
      display: inline-block;\
      width: 94px;\
      text-align: center;\
      height: 24px;\
      line-height: 24px;\
      border: 1px solid #20A8B1;\
      vertical-align: top;\
    }\
    \
    #chatcontrols a:first-child {\
      letter-spacing:-1px;\
      text-decoration: none !important;\
    }\
    \
    #chatcontrols a.active {\
      border-color: #FFCE00;\
      border-bottom-width:0px;\
      font-weight:bold;\
      background: rgb(8, 48, 78);\
    }\
    \
    #chatcontrols a.active + a {\
      border-left-color: #FFCE00\
    }\
    \
    \
    #chatcontrols .toggle {\
      border-left: 10px solid transparent;\
      border-right: 10px solid transparent;\
      border-bottom: 10px solid #FFCE00;\
      margin: 6px auto auto;\
    }\
    \
    #chatcontrols.expand .toggle {\
      border-top: 10px solid #FFCE00;\
      border-bottom: none;\
    }\
    \
    #chatcontrols .loading {\
      background-color: rgba(255,0,0,0.3);\
      -webkit-animation: chatloading 1.2s infinite linear;\
      -moz-animation: chatloading 1.2s infinite linear;\
      animation: chatloading 1.2s infinite linear;\
    }\
    \
    @-webkit-keyframes chatloading {\
        0% { background-color: rgba(255,0,0,0.4) }\
       50% { background-color: rgba(255,0,0,0.1) }\
      100% { background-color: rgba(255,0,0,0.4) }\
    }\
    \
    @-moz-keyframes chatloading {\
        0% { background-color: rgba(255,0,0,0.4) }\
       50% { background-color: rgba(255,0,0,0.1) }\
      100% { background-color: rgba(255,0,0,0.4) }\
    }\
    \
    @keyframes chatloading {\
        0% { background-color: rgba(255,0,0,0.4) }\
       50% { background-color: rgba(255,0,0,0.1) }\
      100% { background-color: rgba(255,0,0,0.4) }\
    }\
    \
    \
    \
    #chat {\
      position: absolute;\
      width: 708px;\
      bottom: 23px;\
      left: 0;\
      z-index: 3000;\
      background: rgba(8, 48, 78, 0.9);\
      line-height: 15px;\
      color: #eee;\
      border: 1px solid #20A8B1;\
      border-bottom: 0;\
      -webkit-box-sizing: border-box;\
      -moz-box-sizing: border-box;\
      box-sizing: border-box;\
    }\
    \
    em {\
      color: red;\
      font-style: normal;\
    }\
    \
    #chat.expand {\
      height:auto;\
      top: 25px;\
    }\
    \
    \
    #chat > div {\
      overflow-x:hidden;\
      overflow-y:scroll;\
      height: 100%;\
      -webkit-box-sizing: border-box;\
      -moz-box-sizing: border-box;\
      box-sizing: border-box;\
      padding: 2px;\
      position:relative;\
    }\
    \
    #chat table, #chatinput table {\
      width: 100%;\
      table-layout: fixed;\
      border-spacing: 0;\
      border-collapse: collapse;\
    }\
    \
    #chatinput table {\
      height: 100%;\
    }\
    \
    #chat td, #chatinput td {\
      font-size: 13px;\
      vertical-align: top;\
      padding-bottom: 3px;\
    }\
    \
    /* time */\
    #chat td:first-child, #chatinput td:first-child {\
      width: 44px;\
      overflow: hidden;\
      padding-left: 2px;\
      color: #bbb;\
      white-space: nowrap;\
    }\
    \
    #chat time {\
      cursor: help;\
    }\
    \
    /* nick */\
    #chat td:nth-child(2), #chatinput td:nth-child(2) {\
      width: 91px;\
      overflow: hidden;\
      padding-left: 2px;\
      white-space: nowrap;\
    }\
    \
    #chat td .system_narrowcast {\
      color: #f66 !important;\
    }\
    \
    mark {\
      background: transparent;\
    }\
    \
    .invisep {\
      display: inline-block;\
      width: 1px;\
      height: 1px;\
      overflow:hidden;\
      color: transparent;\
    }\
    \
    /* divider */\
    summary {\
      color: #bbb;\
      display: inline-block;\
      height: 16px;\
      overflow: hidden;\
      padding: 0 2px;\
      white-space: nowrap;\
      width: 100%;\
    }\
    \
    #chatinput {\
      position: absolute;\
      bottom: 0;\
      left: 0;\
      padding: 0 2px;\
      background: rgba(8, 48, 78, 0.9);\
      width: 708px;\
      height: 23px;\
      border: 1px solid #20A8B1;\
      z-index: 3001;\
      -webkit-box-sizing: border-box;\
      -moz-box-sizing: border-box;\
      box-sizing: border-box;\
    }\
    \
    #chatinput td {\
      padding-bottom: 1px;\
      vertical-align: middle;\
    }\
    \
    \
    #chatinput input {\
      background: transparent;\
      color: #EEEEEE;\
      width: 100%;\
      height: 100%;\
      padding:3px 4px 1px 4px;\
    }\
    \
    \
    \
    /* sidebar ************************************************************/\
    \
    #sidebar > * {\
      border-bottom: 1px solid #20A8B1;\
      -webkit-box-sizing: border-box;\
      -moz-box-sizing: border-box;\
      box-sizing: border-box;\
    }\
    \
    \
    \
    #sidebartoggle .toggle {\
      border-bottom: 10px solid transparent;\
      border-top: 10px solid transparent;\
    }\
    \
    #sidebartoggle .open {\
      border-right: 10px solid #FFCE00;\
    }\
    \
    #sidebartoggle .close {\
      border-left: 10px solid #FFCE00;\
    }\
    \
    /* player stats */\
    #playerstat {\
      height: 30px;\
    }\
    \
    h2 {\
      color: #ffce00;\
      font-size: 21px;\
      padding: 0 4px;\
      margin: 0;\
      cursor:help;\
      -webkit-box-sizing: border-box;\
      -moz-box-sizing: border-box;\
      box-sizing: border-box;\
      width: 100%;\
    }\
    \
    h2 #name {\
      font-weight: 300;\
      display: inline-block;\
      overflow: hidden;\
      text-overflow: ellipsis;\
      vertical-align: top;\
      white-space: nowrap;\
      width: 205px;\
      position: relative;\
    }\
    \
    h2 #stats {\
      float: right;\
      height: 100%;\
      overflow: hidden;\
    }\
    \
    #signout {\
      font-size: 12px;\
      font-weight: normal;\
      line-height: 29px;\
      padding: 0 4px;\
      position: absolute;\
      top: 0;\
      right: 0;\
      background-color: rgba(8, 48, 78, 0.5);\
      display: none; /* starts hidden */\
    }\
    #name:hover #signout {\
      display: block;\
    }\
    \
    h2 sup, h2 sub {\
      display: block;\
      font-size: 11px;\
      margin-bottom: -2px;\
    }\
    \
    \
    /* gamestats */\
    #gamestat {\
      height: 22px;\
    }\
    \
    #gamestat span {\
      display: block;\
      float: left;\
      font-weight: bold;\
      cursor:help;\
      height: 21px;\
      line-height: 22px;\
    }\
    \
    #gamestat .res {\
      background: #005684;\
      text-align: right;\
    }\
    \
    #gamestat .enl {\
      background: #017f01;\
    }\
    \
    \
    /* search input, and others */\
    input:not([type]), .input,\
    input[type="text"], input[type="password"],\
    input[type="number"], input[type="email"],\
    input[type="search"], input[type="url"] {\
      background-color: rgba(0, 0, 0, 0.3);\
      color: #ffce00;\
      height: 24px;\
      padding:0px 4px 0px 4px;\
      font-size: 12px;\
      border:0;\
      font-family:inherit;\
      -webkit-box-sizing: border-box;\
      -moz-box-sizing: border-box;\
      box-sizing: border-box;\
    }\
    \
    #searchwrapper {\
      position: relative;\
    }\
    #search {\
      width: 100%;\
      padding-right: 24px;\
    }\
    #buttongeolocation {\
      position: absolute;\
      right: 0;\
      top: 0;\
      margin: 0;\
      border: 0 none transparent;\
      padding: 0 2px 0 0;\
      height: 24px;\
      background-color: transparent;\
    }\
    #buttongeolocation:focus {\
      outline: 1px dotted #ffce00;\
    }\
    #buttongeolocation img {\
      display: block;\
    }\
    #searchwrapper h3 {\
      font-size: 1em;\
      height: auto;\
      cursor: pointer;\
    }\
    .searchquery {\
      max-height: 25em;\
      overflow-y: auto;\
    }\
    #searchwrapper .ui-accordion-header::before {\
      font-size: 18px;\
      margin-right: 2px;\
      font-weight: normal;\
      line-height: 1em;\
      content: "⊞";\
    }\
    #searchwrapper .ui-accordion-header-active::before {\
      content: "⊟";\
    }\
    #searchwrapper .ui-accordion-content {\
      margin: 0;\
      overflow: hidden;\
    }\
    #searchwrapper ul {\
      padding-left: 14px;\
    }\
    #searchwrapper li {\
      cursor: pointer;\
    }\
    #searchwrapper li a {\
      margin-left: -14px;\
      padding-left: 14px;\
      background-position: 1px center;\
      background-repeat: no-repeat;\
      background-size: 12px 12px;\
    }\
    #searchwrapper li:focus a, #searchwrapper li:hover a {\
      text-decoration: underline;\
    }\
    #searchwrapper li em {\
      color: #ccc;\
      font-size: 0.9em;\
    }\
    \
    ::-webkit-input-placeholder {\
      font-style: italic;\
    }\
    \
    :-moz-placeholder {\
      font-style: italic;\
    }\
    \
    ::-moz-placeholder {\
      font-style: italic;\
    }\
    \
    .leaflet-control-layers input {\
      height: auto;\
      padding: 0;\
    }\
    \
    \
    /* portal title and image */\
    h3.title {\
      padding-right: 17px; /* to not overlap with close button */\
      margin: 2px 0;\
      line-height: 24px;\
      overflow: hidden;\
      text-overflow: ellipsis;\
      white-space: nowrap;\
    }\
    \
    .imgpreview {\
      height: 190px;\
      background: no-repeat center center;\
      background-size: contain;\
      cursor: help;\
      overflow: hidden;\
      position: relative;\
    }\
    \
    .imgpreview img.hide {\
      display: none;\
    }\
    \
    .imgpreview .portalDetails {\
      display: none;\
    }\
    \
    #level {\
      font-size: 40px;\
      text-shadow: -1px -1px #000, 1px -1px #000, -1px 1px #000, 1px 1px #000, 0 0 5px #fff;\
      display: block;\
      margin-right: 15px;\
      text-align:right;\
      float: right;\
    }\
    \
    /* portal mods */\
    .mods {\
      margin: 3px auto 1px auto;\
      width: 296px;\
      height: 67px;\
      text-align: center;\
    }\
    \
    .mods span {\
      background-color: rgba(0, 0, 0, 0.3);\
      /* can’t use inline-block because Webkit\'s implementation is buggy and\
       * introduces additional margins in random cases. No clear necessary,\
       * as that’s solved by setting height on .mods. */\
      display: block;\
      float:left;\
      height: 63px;\
      margin: 0 2px;\
      overflow: hidden;\
      padding: 2px;\
      text-align: center;\
      width: 63px;\
      cursor:help;\
      border: 1px solid #666;\
    }\
    \
    .mods span:not([title]) {\
      cursor: auto;\
    }\
    \
    .res .mods span, .res .meter {\
      border: 1px solid #0076b6;\
    }\
    .enl .mods span, .enl .meter {\
      border: 1px solid #017f01;\
    }\
    \
    /* random details, resonator details */\
    #randdetails, #resodetails {\
      width: 100%;\
      -webkit-box-sizing: border-box;\
      -moz-box-sizing: border-box;\
      box-sizing: border-box;\
      padding: 0 4px;\
      table-layout: fixed;\
      border-spacing: 0m;\
      border-collapse: collapse;\
    }\
    \
    #randdetails td, #resodetails td {\
      overflow: hidden;\
      text-overflow: ellipsis;\
      vertical-align: top;\
      white-space: nowrap;\
      width: 50%;\
    }\
    \
    #randdetails th, #resodetails th {\
      font-weight: normal;\
      text-align: right;\
      width: 62px;\
      padding:0px;\
      padding-right:4px;\
      padding-left:4px;\
    }\
    \
    #randdetails th + th, #resodetails th + th {\
      text-align: left;\
      padding-right: 4px;\
      padding-left: 4px;\
    }\
    \
    #randdetails td:first-child, #resodetails td:first-child {\
      text-align: right;\
      padding-left: 2px;\
    }\
    \
    #randdetails td:last-child, #resodetails td:last-child {\
      text-align: left;\
      padding-right: 2px;\
    }\
    \
    \
    #randdetails {\
      margin-top: 4px;\
      margin-bottom: 5px;\
    }\
    \
    \
    #randdetails tt {\
      font-family: inherit;\
      cursor: help;\
    }\
    \
    #artifact_target, #artifact_fragments {\
      margin-top: 4px;\
      margin-bottom: 4px;\
    \
      margin-left: 8px;\
      margin-right: 8px;\
    }\
    \
    \
    /* resonators */\
    #resodetails {\
      margin-bottom: 0px;\
    }\
    \
    .meter {\
      background: #000;\
      cursor: help;\
      display: inline-block;\
      height: 18px;\
      padding: 1px;\
      width: 100%;\
      -webkit-box-sizing: border-box;\
      -moz-box-sizing: border-box;\
      box-sizing: border-box;\
      position: relative;\
      left: 0;\
      top: 0;\
    }\
    \
    .meter.north {\
      overflow: hidden;\
    }\
    .meter.north:before {\
      content: "";\
      background-color: red;\
      border: 1px solid #000000;\
      border-radius: 100%;\
      display: block;\
      height: 6px;\
      width: 6px;\
      left: 50%;\
      top: -3px;\
      margin-left: -4px;\
      position: absolute;\
    }\
    \
    .meter span {\
      display: block;\
      height: 14px;\
    }\
    \
    .meter-level {\
      position: absolute;\
      left: 0;\
      right: 0;\
      top: -2px;\
      text-shadow: 0.0em 0.0em 0.3em #808080;\
      text-align: center;\
      word-spacing: 4px; /* to leave some space for the north indicator */\
    }\
    \
    /* links below resos */\
    \
    .linkdetails {\
      margin-bottom: 0px;\
      text-align: center;\
    }\
    \
    .linkdetails aside {\
      display: inline-block;\
      white-space: nowrap;\
      margin-left: 5px;\
      margin-right: 5px;\
    }\
    \
    #toolbox {\
      text-align: left;    /* centre didn\'t look as nice here as it did above in .linkdetails */\
    }\
    \
    #toolbox > a {\
      margin-left: 5px;\
      margin-right: 5px;\
      white-space: nowrap;\
      display: inline-block;\
    }\
    \
    /* a common portal display takes this much space (prevents moving\
     * content when first selecting a portal) */\
    \
    #portaldetails {\
      min-height: 63px;\
      position: relative; /* so the below \'#portaldetails .close\' is relative to this */\
    }\
    \
    #portaldetails .close {\
      position: absolute;\
      top: -2px;\
      right: 2px;\
      cursor: pointer;\
      color: #FFCE00;\
      font-size: 16px;\
    }\
    \
    /* history details */\
    #historydetails {\
      text-align: center;\
      color: #ffce00;\
    }\
    \
    #historydetails .missing {\
    }\
    \
    #historydetails span {\
      color: #ff4a4a;\
    }\
    \
    #historydetails span.completed {\
      color: #03fe03;\
    }\
    \
    /* update status */\
    #updatestatus {\
      background-color: rgba(8, 48, 78, 0.9);\
      border-bottom: 0;\
      border-top: 1px solid #20A8B1;\
      border-left: 1px solid #20A8B1;\
      bottom: 0;\
      color: #ffce00;\
      font-size:13px;\
      padding: 4px;\
      position: fixed;\
      right: 0;\
      z-index: 3002;\
      -webkit-box-sizing: border-box;\
      -moz-box-sizing: border-box;\
      box-sizing: border-box;\
    }\
    \
    #updatestatus .map {\
      margin-left: 8px;\
    }\
    \
    #loadlevel {\
      background: #FFF;\
      color: #000000;\
      display: inline-block;\
      min-width: 1.8em;\
      border: 1px solid #20A8B1;\
      border-width: 0 1px;\
      margin: -4px 0;\
      padding: 4px 0.2em;\
    }\
    \
    /* Dialogs\
     */\
    .ui-tooltip, .ui-dialog {\
      position: absolute;\
      z-index: 9500;\
      background-color: rgba(8, 48, 78, 0.9);\
      border: 1px solid #20A8B1;\
      color: #eee;\
      font-size: 13px;\
      line-height: 15px;\
      padding: 2px 4px;\
    }\
    \
    .ui-tooltip {\
      max-width: 300px;\
    }\
    \
    .ui-widget-overlay {\
      height: 100%;\
      left: 0;\
      position: fixed;\
      top: 0;\
      width: 100%;\
      z-index: 10000;\
      background:  #444;\
      opacity: 0.6;\
    }\
    \
    .ui-modal {\
      z-index: 10001 !important;\
    }\
    \
    .ui-tooltip {\
      z-index: 10002 !important;\
    }\
    \
    .ui-tooltip, .ui-dialog a {\
      color: #FFCE00;\
    }\
    \
    .ui-dialog {\
      padding: 0;\
      border-radius: 2px;\
    }\
    \
    .ui-dialog-modal .ui-dialog-titlebar-close {\
      display: none;\
    }\
    \
    .ui-dialog-titlebar {\
      font-size: 13px;\
      line-height: 15px;\
      text-align: center;\
      padding: 4px;\
      background-color: rgba(8, 60, 78, 0.9);\
    }\
    \
    .ui-dialog-title {\
      font-weight: bold;\
      margin-left: 8px;\
      margin-right: 45px;\
      width: calc(100% - 45px);\
    }\
    \
    .ui-dialog-title-active {\
      color: #ffce00;\
    }\
    \
    .ui-dialog-title-inactive {\
      color: #ffffff;\
    }\
    \
    .ui-dialog-titlebar-button {\
      position: absolute;\
      display: table-cell;\
      vertical-align: middle;\
      text-align: center;\
      width: 17px;\
      height: 17px;\
      top: 3px;\
      cursor: pointer;\
      border: 1px solid rgb(32, 168, 177);\
      background-color: rgba(0, 0, 0, 0);\
      padding: 0;\
    }\
    \
    .ui-dialog-titlebar-button:active {\
      background-color: rgb(32, 168, 177);\
    }\
    \
    .ui-dialog-titlebar-button-close {\
      right: 4px;\
    }\
    \
    .ui-dialog-titlebar-button-collapse {\
      right: 25px;\
    }\
    \
    .ui-dialog-titlebar-button-collapse-expanded {\
      /* For future changes */\
    }\
    \
    .ui-dialog-titlebar-button-collapse-collapsed {\
      background-color: rgb(32, 168, 177);\
    }\
    \
    .ui-dialog-titlebar-button-collapse::after,\
    .ui-dialog-titlebar-button-close::after,\
    .ui-dialog-titlebar-button-close::before {\
      content: "";\
      position: absolute;\
      top: 3px;\
      left: 50%;\
      width: 11px;\
      margin-left: -6px;\
      height: 0;\
      border-top: 2px solid rgb(32, 168, 177);\
    }\
    .ui-dialog-titlebar-button-close::after {\
      transform: translateY(3.5px) rotate(45deg);\
      -webkit-transform: translateY(3.5px) rotate(45deg);\
    }\
    .ui-dialog-titlebar-button-close::before {\
      transform: translateY(3.5px) rotate(-45deg);\
      -webkit-transform: translateY(3.5px) rotate(-45deg);\
    }\
    .ui-dialog-titlebar-button.ui-state-active::after,\
    .ui-dialog-titlebar-button.ui-state-active::before,\
    .ui-dialog-titlebar-button.ui-dialog-titlebar-button-collapse-collapsed::after,\
    .ui-dialog-titlebar-button.ui-dialog-titlebar-button-collapse-collapsed::before,\
    .ui-dialog-titlebar-button:active::after,\
    .ui-dialog-titlebar-button:active::before {\
      border-top-color: rgba(8, 60, 78, 0.9);\
    }\
    \
    .ui-dialog-content {\
      padding: 12px;\
      overflow: auto;\
      position: relative;\
    \
      /* Limiting the height of dialog content on small screens */\
      /* 57px – height .ui-dialog-titlebar + .ui-dialog-buttonpane */\
      /* 24px – padding 12px * 2 */\
      /*  2px – border 1px * 2 */\
      max-height: calc(100vh - 57px - 24px - 2px) !important;\
    }\
    \
    .ui-dialog {\
      max-width: calc(100vw - 2px);\
    }\
    \
    @media (min-width: 700px) {\
      .ui-dialog {\
        max-width: 600px;\
      }\
    }\
    \
    .ui-dialog-content-hidden {\
      display: none !important;\
    }\
    \
    .ui-dialog-buttonpane {\
      padding: 6px;\
      border-top: 1px solid #20A8B1;\
    }\
    \
    .ui-dialog-buttonset {\
      text-align: right;\
    }\
    \
    .ui-dialog-buttonset button,\
    .ui-dialog-content button {\
      padding: 2px;\
      min-width: 40px;\
      color: #FFCE00;\
      border: 1px solid #FFCE00;\
      background-color: rgba(8, 48, 78, 0.9);\
    }\
    \
    .ui-dialog-buttonset button:hover {\
      text-decoration: underline;\
    }\
    \
    td {\
      padding: 0;\
      vertical-align: top;\
    }\
    \
    td + td {\
      padding-left: 4px;\
    }\
    \
    #qrcode > canvas {\
      border: 8px solid white;\
    }\
    \
    /* redeem results *****************************************************/\
    .redeemReward {\
      font-family: Inconsolata, Consolas, Menlo, "Courier New", monospace;\
      list-style-type: none;\
      padding: 0;\
      font-size: 14px;\
    }\
    .redeemReward .itemlevel {\
      font-weight: bold;\
      text-shadow: 0 0 1px #000; /* L8 is hard to read on blue background */\
    }\
    /*\
    .redeem-result-table {\
      font-size: 14px;\
      table-layout: fixed;\
    }\
    \
    .redeem-result tr > td:first-child {\
      width: 50px;\
      text-align: right;\
    }\
    \
    .redeem-result-html {\
      font-family: Inconsolata, Consolas, Menlo, "Courier New", monospace;\
    }\
    */\
    \
    .pl_nudge_date {\
      background-color: #724510;\
      border-left: 1px solid #ffd652;\
      border-bottom: 1px solid #ffd652;\
      border-top: 1px solid #ffd652;\
      color: #ffd652;\
      display: inline-block;\
      float: left;\
      height: 18px;\
      text-align: center;\
    }\
    \
    .pl_nudge_pointy_spacer {\
      background: no-repeat url(//commondatastorage.googleapis.com/ingress.com/img/nudge_pointy.png);\
      display: inline-block;\
      float: left;\
      height: 20px;\
      left: 47px;\
      width: 5px;\
    }\
    \
    .pl_nudge_player {\
      cursor: pointer;\
    }\
    \
    .pl_nudge_me {\
      color: #ffd652;\
    }\
    \
    .RESISTANCE {\
      color: #00c2ff;\
    }\
    \
    .ALIENS, .ENLIGHTENED {\
      color: #28f428;\
    }\
    \
    #portal_highlight_select {\
      position: absolute;\
      top:5px;\
      left:10px;\
      z-index: 2500;\
      font-size:11px;\
      background-color:#0E3C46;\
      color:#ffce00;\
    \
    }\
    \
    \
    \
    .portal_details th, .portal_details td {\
      vertical-align: top;\
      text-align: left;\
    }\
    \
    .portal_details th {\
      white-space: nowrap;\
      padding-right: 1em;\
    }\
    \
    .portal_details tr.padding-top th, .portal_details tr.padding-top td {\
      padding-top: 0.7em;\
    }\
    \
    #play_button {\
      display: none;\
    }\
    \
    \
    /** artifact dialog *****************/\
    table.artifact tr > * {\
      background: rgba(8, 48, 78, 0.9);\
    }\
    \
    table.artifact td.info {\
      min-width: 110px; /* min-width for info column, to ensure really long portal names don\'t crowd things out */\
    }\
    \
    table.artifact .portal {\
      min-width: 200px; /* min-width for portal names, to ensure really long lists of artifacts don\'t crowd names out */\
    }\
    \
    \
    /* leaflet popups - restyle to match the theme of IITC */\
    #map .leaflet-popup {\
      pointer-events: none;\
    }\
    \
    #map .leaflet-popup-content-wrapper {\
      border-radius: 0px;\
      -webkit-border-radius: 0px;\
      border: 1px solid #20A8B1;\
      background: #0e3d4e;\
      pointer-events: auto;\
    }\
    \
    #map .leaflet-popup-content {\
      color: #ffce00;\
      margin: 5px 8px;\
    }\
    \
    #map .leaflet-popup-close-button {\
      padding: 2px 1px 0 0;\
      font-size: 12px;\
      line-height: 8px;\
      width: 10px;\
      height: 10px;\
      pointer-events: auto;\
    }\
    \
    \
    #map .leaflet-popup-tip {\
      /* change the tip from an arrow to a simple line */\
      background: #20A8B1;\
      width: 1px;\
      height: 20px;\
      padding: 0;\
      margin: 0 0 0 20px;\
      -webkit-transform: none;\
      -moz-transform: none;\
      -ms-transform: none;\
      -o-transform: none;\
      transform: none;\
    }\
    \
    \
    /* misc */\
    .layer_off_warning {\
      color: #FFCE00;\
      margin: 8px;\
      text-align: center;\
    }\
    \
    /* region scores */\
    .cellscore .ui-accordion-header, .cellscore .ui-accordion-content {\
        border: 1px solid #20a8b1;\
        margin-top: -1px;\
        display: block;\
    }\
    .cellscore .ui-accordion-header {\
        color: #ffce00;\
        outline: none\
    }\
    .cellscore .ui-accordion-header:before {\
        font-size: 18px;\
        margin-right: 2px;\
        content: "⊞";\
    }\
    .cellscore .ui-accordion-header-active:before {\
        content: "⊟";\
    }\
    .cellscore table {\
        width: 90%;\
        max-width: 360px; /* prevent width change on scrollbar appearance (after animation) */\
    }\
    \
    /* prevent nonfunctional horizontal scrollbar in Chrome (perhaps jQuery issue) */\
    .cellscore .historychart > div {\
      overflow: auto;\
    }\
    \
    .cellscore .logscale {\
      vertical-align: middle;\
      margin-top: 0;\
    }\
    \
    @-moz-document url-prefix() {\
     .cellscore .logscale {\
        transform: scale(0.8);\
      }\
    \
      /* prevent nonfunctional vertical scrollbar in Firefox (perhaps jQuery issue) */\
      .cellscore > .historychart {\
        overflow-y: hidden !important;\
      }\
    }\
    \
    g.checkpoint:hover circle {\
      fill-opacity: 1;\
      stroke-width: 2px;\
    }\
    \
    .cellscore th, .cellscore td {\
        text-align: left;\
        padding-left: 5px;\
    }\
    .checkpoint_table {\
        border-collapse: collapse;\
    }\
    .checkpoint_table th, .checkpoint_table td {\
        text-align: right;\
    }\
    \
    .cellscore #overview {\
      width: 100%;\
    }\
    \
    .cellscore #overview td {\
      white-space: nowrap;\
      width: 1%;\
      text-align: right;\
    }\
    \
    .cellscore #overview th {\
      white-space: nowrap;\
      width: 1%;\
      text-align: left;\
      padding-left: 4px;\
    }\
    \
    .checkpointtooltip {\
      min-width: 180px;\
    }\
    \
    .checkpoint_timers table {\
      padding-top: 4px;\
      width: 100%;\
    }\
    \
    /* tabs */\
    .ui-tabs-nav {\
        display: block;\
        border-bottom: 1px solid #20a8b1;\
        border-top: 1px solid transparent;\
        margin: 3px 0 0;\
        padding: 0;\
    }\
    .ui-tabs-nav::after {\
        content: \'\';\
        clear: left;\
        display: block;\
        height: 0;\
        width: 0;\
    }\
    .ui-tabs-nav li {\
        list-style: none;\
        display: block;\
        float:left;\
        margin: 0 0 -1px;\
        border: 1px solid #20a8b1;\
    }\
    .ui-tabs-nav li.ui-tabs-active {\
        border-bottom-color: #0F2C3F;\
        background: #0F2C3F;\
        border-width: 2px 2px 1px;\
        font-weight: bold;\
        margin: -1px 1px;\
    }\
    .ui-tabs-nav a {\
        display: inline-block;\
        padding: 0.2em 0.7em;\
    }\
    .ui-tabs-nav .ui-icon {\
        display: inline-block;\
        font-size: 0;\
        height: 22px;\
        overflow: hidden;\
        position: relative;\
        vertical-align: top;\
        width: 16px;\
    }\
    .ui-tabs-nav .ui-icon-close::before {\
        content: "×";\
        font-size: 16px;\
        height: 16px;\
        position: absolute;\
        text-align: center;\
        top: 2px;\
        vertical-align: baseline;\
        width: 16px;\
        cursor: pointer;\
    }\
    \
    svg.icon-button {\
        fill: currentColor;\
    }\
    \
    .leaflet-marker-icon > svg {\
        height: inherit;\
        width: inherit;\
    }\
    ' + '</style>' +
  '<style>' + '\
    /* required styles */\
    \
    .leaflet-pane,\
    .leaflet-tile,\
    .leaflet-marker-icon,\
    .leaflet-marker-shadow,\
    .leaflet-tile-container,\
    .leaflet-pane > svg,\
    .leaflet-pane > canvas,\
    .leaflet-zoom-box,\
    .leaflet-image-layer,\
    .leaflet-layer {\
        position: absolute;\
        left: 0;\
        top: 0;\
        }\
    .leaflet-container {\
        overflow: hidden;\
        }\
    .leaflet-tile,\
    .leaflet-marker-icon,\
    .leaflet-marker-shadow {\
        -webkit-user-select: none;\
           -moz-user-select: none;\
                user-select: none;\
          -webkit-user-drag: none;\
        }\
    /* Prevents IE11 from highlighting tiles in blue */\
    .leaflet-tile::selection {\
        background: transparent;\
    }\
    /* Safari renders non-retina tile on retina better with this, but Chrome is worse */\
    .leaflet-safari .leaflet-tile {\
        image-rendering: -webkit-optimize-contrast;\
        }\
    /* hack that prevents hw layers "stretching" when loading new tiles */\
    .leaflet-safari .leaflet-tile-container {\
        width: 1600px;\
        height: 1600px;\
        -webkit-transform-origin: 0 0;\
        }\
    .leaflet-marker-icon,\
    .leaflet-marker-shadow {\
        display: block;\
        }\
    /* .leaflet-container svg: reset svg max-width decleration shipped in Joomla! (joomla.org) 3.x */\
    /* .leaflet-container img: map is broken in FF if you have max-width: 100% on tiles */\
    .leaflet-container .leaflet-overlay-pane svg,\
    .leaflet-container .leaflet-marker-pane img,\
    .leaflet-container .leaflet-shadow-pane img,\
    .leaflet-container .leaflet-tile-pane img,\
    .leaflet-container img.leaflet-image-layer,\
    .leaflet-container .leaflet-tile {\
        max-width: none !important;\
        max-height: none !important;\
        }\
    \
    .leaflet-container.leaflet-touch-zoom {\
        -ms-touch-action: pan-x pan-y;\
        touch-action: pan-x pan-y;\
        }\
    .leaflet-container.leaflet-touch-drag {\
        -ms-touch-action: pinch-zoom;\
        /* Fallback for FF which doesn\'t support pinch-zoom */\
        touch-action: none;\
        touch-action: pinch-zoom;\
    }\
    .leaflet-container.leaflet-touch-drag.leaflet-touch-zoom {\
        -ms-touch-action: none;\
        touch-action: none;\
    }\
    .leaflet-container {\
        -webkit-tap-highlight-color: transparent;\
    }\
    .leaflet-container a {\
        -webkit-tap-highlight-color: rgba(51, 181, 229, 0.4);\
    }\
    .leaflet-tile {\
        filter: inherit;\
        visibility: hidden;\
        }\
    .leaflet-tile-loaded {\
        visibility: inherit;\
        }\
    .leaflet-zoom-box {\
        width: 0;\
        height: 0;\
        -moz-box-sizing: border-box;\
             box-sizing: border-box;\
        z-index: 800;\
        }\
    /* workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=888319 */\
    .leaflet-overlay-pane svg {\
        -moz-user-select: none;\
        }\
    \
    .leaflet-pane         { z-index: 400; }\
    \
    .leaflet-tile-pane    { z-index: 200; }\
    .leaflet-overlay-pane { z-index: 400; }\
    .leaflet-shadow-pane  { z-index: 500; }\
    .leaflet-marker-pane  { z-index: 600; }\
    .leaflet-tooltip-pane   { z-index: 650; }\
    .leaflet-popup-pane   { z-index: 700; }\
    \
    .leaflet-map-pane canvas { z-index: 100; }\
    .leaflet-map-pane svg    { z-index: 200; }\
    \
    .leaflet-vml-shape {\
        width: 1px;\
        height: 1px;\
        }\
    .lvml {\
        behavior: url(#default#VML);\
        display: inline-block;\
        position: absolute;\
        }\
    \
    \
    /* control positioning */\
    \
    .leaflet-control {\
        position: relative;\
        z-index: 800;\
        pointer-events: visiblePainted; /* IE 9-10 doesn\'t have auto */\
        pointer-events: auto;\
        }\
    .leaflet-top,\
    .leaflet-bottom {\
        position: absolute;\
        z-index: 1000;\
        pointer-events: none;\
        }\
    .leaflet-top {\
        top: 0;\
        }\
    .leaflet-right {\
        right: 0;\
        }\
    .leaflet-bottom {\
        bottom: 0;\
        }\
    .leaflet-left {\
        left: 0;\
        }\
    .leaflet-control {\
        float: left;\
        clear: both;\
        }\
    .leaflet-right .leaflet-control {\
        float: right;\
        }\
    .leaflet-top .leaflet-control {\
        margin-top: 10px;\
        }\
    .leaflet-bottom .leaflet-control {\
        margin-bottom: 10px;\
        }\
    .leaflet-left .leaflet-control {\
        margin-left: 10px;\
        }\
    .leaflet-right .leaflet-control {\
        margin-right: 10px;\
        }\
    \
    \
    /* zoom and fade animations */\
    \
    .leaflet-fade-anim .leaflet-tile {\
        will-change: opacity;\
        }\
    .leaflet-fade-anim .leaflet-popup {\
        opacity: 0;\
        -webkit-transition: opacity 0.2s linear;\
           -moz-transition: opacity 0.2s linear;\
                transition: opacity 0.2s linear;\
        }\
    .leaflet-fade-anim .leaflet-map-pane .leaflet-popup {\
        opacity: 1;\
        }\
    .leaflet-zoom-animated {\
        -webkit-transform-origin: 0 0;\
            -ms-transform-origin: 0 0;\
                transform-origin: 0 0;\
        }\
    .leaflet-zoom-anim .leaflet-zoom-animated {\
        will-change: transform;\
        }\
    .leaflet-zoom-anim .leaflet-zoom-animated {\
        -webkit-transition: -webkit-transform 0.25s cubic-bezier(0,0,0.25,1);\
           -moz-transition:    -moz-transform 0.25s cubic-bezier(0,0,0.25,1);\
                transition:         transform 0.25s cubic-bezier(0,0,0.25,1);\
        }\
    .leaflet-zoom-anim .leaflet-tile,\
    .leaflet-pan-anim .leaflet-tile {\
        -webkit-transition: none;\
           -moz-transition: none;\
                transition: none;\
        }\
    \
    .leaflet-zoom-anim .leaflet-zoom-hide {\
        visibility: hidden;\
        }\
    \
    \
    /* cursors */\
    \
    .leaflet-interactive {\
        cursor: pointer;\
        }\
    .leaflet-grab {\
        cursor: -webkit-grab;\
        cursor:    -moz-grab;\
        cursor:         grab;\
        }\
    .leaflet-crosshair,\
    .leaflet-crosshair .leaflet-interactive {\
        cursor: crosshair;\
        }\
    .leaflet-popup-pane,\
    .leaflet-control {\
        cursor: auto;\
        }\
    .leaflet-dragging .leaflet-grab,\
    .leaflet-dragging .leaflet-grab .leaflet-interactive,\
    .leaflet-dragging .leaflet-marker-draggable {\
        cursor: move;\
        cursor: -webkit-grabbing;\
        cursor:    -moz-grabbing;\
        cursor:         grabbing;\
        }\
    \
    /* marker & overlays interactivity */\
    .leaflet-marker-icon,\
    .leaflet-marker-shadow,\
    .leaflet-image-layer,\
    .leaflet-pane > svg path,\
    .leaflet-tile-container {\
        pointer-events: none;\
        }\
    \
    .leaflet-marker-icon.leaflet-interactive,\
    .leaflet-image-layer.leaflet-interactive,\
    .leaflet-pane > svg path.leaflet-interactive,\
    svg.leaflet-image-layer.leaflet-interactive path {\
        pointer-events: visiblePainted; /* IE 9-10 doesn\'t have auto */\
        pointer-events: auto;\
        }\
    \
    /* visual tweaks */\
    \
    .leaflet-container {\
        background: #ddd;\
        outline: 0;\
        }\
    .leaflet-container a {\
        color: #0078A8;\
        }\
    .leaflet-container a.leaflet-active {\
        outline: 2px solid orange;\
        }\
    .leaflet-zoom-box {\
        border: 2px dotted #38f;\
        background: rgba(255,255,255,0.5);\
        }\
    \
    \
    /* general typography */\
    .leaflet-container {\
        font: 12px/1.5 "Helvetica Neue", Arial, Helvetica, sans-serif;\
        }\
    \
    \
    /* general toolbar styles */\
    \
    .leaflet-bar {\
        box-shadow: 0 1px 5px rgba(0,0,0,0.65);\
        border-radius: 4px;\
        }\
    .leaflet-bar a,\
    .leaflet-bar a:hover {\
        background-color: #fff;\
        border-bottom: 1px solid #ccc;\
        width: 26px;\
        height: 26px;\
        line-height: 26px;\
        display: block;\
        text-align: center;\
        text-decoration: none;\
        color: black;\
        }\
    .leaflet-bar a,\
    .leaflet-control-layers-toggle {\
        background-position: 50% 50%;\
        background-repeat: no-repeat;\
        display: block;\
        }\
    .leaflet-bar a:hover {\
        background-color: #f4f4f4;\
        }\
    .leaflet-bar a:first-child {\
        border-top-left-radius: 4px;\
        border-top-right-radius: 4px;\
        }\
    .leaflet-bar a:last-child {\
        border-bottom-left-radius: 4px;\
        border-bottom-right-radius: 4px;\
        border-bottom: none;\
        }\
    .leaflet-bar a.leaflet-disabled {\
        cursor: default;\
        background-color: #f4f4f4;\
        color: #bbb;\
        }\
    \
    .leaflet-touch .leaflet-bar a {\
        width: 30px;\
        height: 30px;\
        line-height: 30px;\
        }\
    .leaflet-touch .leaflet-bar a:first-child {\
        border-top-left-radius: 2px;\
        border-top-right-radius: 2px;\
        }\
    .leaflet-touch .leaflet-bar a:last-child {\
        border-bottom-left-radius: 2px;\
        border-bottom-right-radius: 2px;\
        }\
    \
    /* zoom control */\
    \
    .leaflet-control-zoom-in,\
    .leaflet-control-zoom-out {\
        font: bold 18px \'Lucida Console\', Monaco, monospace;\
        text-indent: 1px;\
        }\
    \
    .leaflet-touch .leaflet-control-zoom-in, .leaflet-touch .leaflet-control-zoom-out  {\
        font-size: 22px;\
        }\
    \
    \
    /* layers control */\
    \
    .leaflet-control-layers {\
        box-shadow: 0 1px 5px rgba(0,0,0,0.4);\
        background: #fff;\
        border-radius: 5px;\
        }\
    .leaflet-control-layers-toggle {\
        background-image: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABoAAAAaCAQAAAADQ4RFAAACf0lEQVR4AY1UM3gkARTePdvdoTxXKc+qTl3aU5U6b2Kbkz3Gtq3Zw6ziLGNPzrYx7946Tr6/ee/XeCQ4D3ykPtL5tHno4n0d/h3+xfuWHGLX81cn7r0iTNzjr7LrlxCqPtkbTQEHeqOrTy4Yyt3VCi/IOB0v7rVC7q45Q3Gr5K6jt+3Gl5nCoDD4MtO+j96Wu8atmhGqcNGHObuf8OM/x3AMx38+4Z2sPqzCxRFK2aF2e5Jol56XTLyggAMTL56XOMoS1W4pOyjUcGGQdZxU6qRh7B9Zp+PfpOFlqt0zyDZckPi1ttmIp03jX8gyJ8a/PG2yutpS/Vol7peZIbZcKBAEEheEIAgFbDkz5H6Zrkm2hVWGiXKiF4Ycw0RWKdtC16Q7qe3X4iOMxruonzegJzWaXFrU9utOSsLUmrc0YjeWYjCW4PDMADElpJSSQ0vQvA1Tm6/JlKnqFs1EGyZiFCqnRZTEJJJiKRYzVYzJck2Rm6P4iH+cmSY0YzimYa8l0EtTODFWhcMIMVqdsI2uiTvKmTisIDHJ3od5GILVhBCarCfVRmo4uTjkhrhzkiBV7SsaqS+TzrzM1qpGGUFt28pIySQHR6h7F6KSwGWm97ay+Z+ZqMcEjEWebE7wxCSQwpkhJqoZA5ivCdZDjJepuJ9IQjGGUmuXJdBFUygxVqVsxFsLMbDe8ZbDYVCGKxs+W080max1hFCarCfV+C1KATwcnvE9gRRuMP2prdbWGowm1KB1y+zwMMENkM755cJ2yPDtqhTI6ED1M/82yIDtC/4j4BijjeObflpO9I9MwXTCsSX8jWAFeHr05WoLTJ5G8IQVS/7vwR6ohirYM7f6HzYpogfS3R2OAAAAAElFTkSuQmCC);\
        width: 36px;\
        height: 36px;\
        }\
    .leaflet-retina .leaflet-control-layers-toggle {\
        background-image: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADQAAAA0CAQAAABvcdNgAAAEsklEQVR4AWL4TydIhpZK1kpWOlg0w3ZXP6D2soBtG42jeI6ZmQTHzAxiTbSJsYLjO9HhP+WOmcuhciVnmHVQcJnp7DFvScowZorad/+V/fVzMdMT2g9Cv9guXGv/7pYOrXh2U+RRR3dSd9JRx6bIFc/ekqHI29JC6pJ5ZEh1yWkhkbcFeSjxgx3L2m1cb1C7bceyxA+CNjT/Ifff+/kDk2u/w/33/IeCMOSaWZ4glosqT3DNnNZQ7Cs58/3Ce5HL78iZH/vKVIaYlqzfdLu8Vi7dnvUbEza5Idt36tquZFldl6N5Z/POLof0XLK61mZCmJSWjVF9tEjUluu74IUXvgttuVIHE7YxSkaYhJZam7yiM9Pv82JYfl9nptxZaxMJE4YSPty+vF0+Y2up9d3wwijfjZbabqm/3bZ9ecKHsiGmRflnn1MW4pjHf9oLufyn2z3y1D6n8g8TZhxyzipLNPnAUpsOiuWimg52psrTZYnOWYNDTMuWBWa0tJb4rgq1UvmutpaYEbZlwU3CLJm/ayYjHW5/h7xWLn9Hh1vepDkyf7dE7MtT5LR4e7yYpHrkhOUpEfssBLq2pPhAqoSWKUkk7EDqkmK6RrCEzqDjhNDWNE+XSMvkJRDWlZTmCW0l0PHQGRZY5t1L83kT0Y3l2SItk5JAWHl2dCOBm+fPu3fo5/3v61RMCO9Jx2EEYYhb0rmNQMX/vm7gqOEJLcXTGw3CAuRNeyaPWwjR8PRqKQ1PDA/dpv+on9Shox52WFnx0KY8onHayrJzm87i5h9xGw/tfkev0jGsQizqezUKjk12hBMKJ4kbCqGPVNXudyyrShovGw5CgxsRICxF6aRmSjlBnHRzg7Gx8fKqEubI2rahQYdR1YgDIRQO7JvQyD52hoIQx0mxa0ODtW2Iozn1le2iIRdzwWewedyZzewidueOGqlsn1MvcnQpuVwLGG3/IR1hIKxCjelIDZ8ldqWz25jWAsnldEnK0Zxro19TGVb2ffIZEsIO89EIEDvKMPrzmBOQcKQ+rroye6NgRRxqR4U8EAkz0CL6uSGOm6KQCdWjvjRiSP1BPalCRS5iQYiEIvxuBMJEWgzSoHADcVMuN7IuqqTeyUPq22qFimFtxDyBBJEwNyt6TM88blFHao/6tWWhuuOM4SAK4EI4QmFHA+SEyWlp4EQoJ13cYGzMu7yszEIBOm2rVmHUNqwAIQabISNMRstmdhNWcFLsSm+0tjJH1MdRxO5Nx0WDMhCtgD6OKgZeljJqJKc9po8juskR9XN0Y1lZ3mWjLR9JCO1jRDMd0fpYC2VnvjBSEFg7wBENc0R9HFlb0xvF1+TBEpF68d+DHR6IOWVv2BECtxo46hOFUBd/APU57WIoEwJhIi2CdpyZX0m93BZicktMj1AS9dClteUFAUNUIEygRZCtik5zSxI9MubTBH1GOiHsiLJ3OCoSZkILa9PxiN0EbvhsAo8tdAf9Seepd36lGWHmtNANTv5Jd0z4QYyeo/UEJqxKRpg5LZx6btLPsOaEmdMyxYdlc8LMaJnikDlhclqmPiQnTEpLUIZEwkRagjYkEibQErwhkTAKCLQEbUgkzJQWc/0PstHHcfEdQ+UAAAAASUVORK5CYII=);\
        background-size: 26px 26px;\
        }\
    .leaflet-touch .leaflet-control-layers-toggle {\
        width: 44px;\
        height: 44px;\
        }\
    .leaflet-control-layers .leaflet-control-layers-list,\
    .leaflet-control-layers-expanded .leaflet-control-layers-toggle {\
        display: none;\
        }\
    .leaflet-control-layers-expanded .leaflet-control-layers-list {\
        display: block;\
        position: relative;\
        }\
    .leaflet-control-layers-expanded {\
        padding: 6px 10px 6px 6px;\
        color: #333;\
        background: #fff;\
        }\
    .leaflet-control-layers-scrollbar {\
        overflow-y: scroll;\
        overflow-x: hidden;\
        padding-right: 5px;\
        }\
    .leaflet-control-layers-selector {\
        margin-top: 2px;\
        position: relative;\
        top: 1px;\
        }\
    .leaflet-control-layers label {\
        display: block;\
        }\
    .leaflet-control-layers-separator {\
        height: 0;\
        border-top: 1px solid #ddd;\
        margin: 5px -10px 5px -6px;\
        }\
    \
    /* Default icon URLs */\
    .leaflet-default-icon-path {\
        background-image: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAApCAYAAADAk4LOAAAFgUlEQVR4Aa1XA5BjWRTN2oW17d3YaZtr2962HUzbDNpjszW24mRt28p47v7zq/bXZtrp/lWnXr337j3nPCe85NcypgSFdugCpW5YoDAMRaIMqRi6aKq5E3YqDQO3qAwjVWrD8Ncq/RBpykd8oZUb/kaJutow8r1aP9II0WmLKLIsJyv1w/kqw9Ch2MYdB++12Onxee/QMwvf4/Dk/Lfp/i4nxTXtOoQ4pW5Aj7wpici1A9erdAN2OH64x8OSP9j3Ft3b7aWkTg/Fm91siTra0f9on5sQr9INejH6CUUUpavjFNq1B+Oadhxmnfa8RfEmN8VNAsQhPqF55xHkMzz3jSmChWU6f7/XZKNH+9+hBLOHYozuKQPxyMPUKkrX/K0uWnfFaJGS1QPRtZsOPtr3NsW0uyh6NNCOkU3Yz+bXbT3I8G3xE5EXLXtCXbbqwCO9zPQYPRTZ5vIDXD7U+w7rFDEoUUf7ibHIR4y6bLVPXrz8JVZEql13trxwue/uDivd3fkWRbS6/IA2bID4uk0UpF1N8qLlbBlXs4Ee7HLTfV1j54APvODnSfOWBqtKVvjgLKzF5YdEk5ewRkGlK0i33Eofffc7HT56jD7/6U+qH3Cx7SBLNntH5YIPvODnyfIXZYRVDPqgHtLs5ABHD3YzLuespb7t79FY34DjMwrVrcTuwlT55YMPvOBnRrJ4VXTdNnYug5ucHLBjEpt30701A3Ts+HEa73u6dT3FNWwflY86eMHPk+Yu+i6pzUpRrW7SNDg5JHR4KapmM5Wv2E8Tfcb1HoqqHMHU+uWDD7zg54mz5/2BSnizi9T1Dg4QQXLToGNCkb6tb1NU+QAlGr1++eADrzhn/u8Q2YZhQVlZ5+CAOtqfbhmaUCS1ezNFVm2imDbPmPng5wmz+gwh+oHDce0eUtQ6OGDIyR0uUhUsoO3vfDmmgOezH0mZN59x7MBi++WDL1g/eEiU3avlidO671bkLfwbw5XV2P8Pzo0ydy4t2/0eu33xYSOMOD8hTf4CrBtGMSoXfPLchX+J0ruSePw3LZeK0juPJbYzrhkH0io7B3k164hiGvawhOKMLkrQLyVpZg8rHFW7E2uHOL888IBPlNZ1FPzstSJM694fWr6RwpvcJK60+0HCILTBzZLFNdtAzJaohze60T8qBzyh5ZuOg5e7uwQppofEmf2++DYvmySqGBuKaicF1blQjhuHdvCIMvp8whTTfZzI7RldpwtSzL+F1+wkdZ2TBOW2gIF88PBTzD/gpeREAMEbxnJcaJHNHrpzji0gQCS6hdkEeYt9DF/2qPcEC8RM28Hwmr3sdNyht00byAut2k3gufWNtgtOEOFGUwcXWNDbdNbpgBGxEvKkOQsxivJx33iow0Vw5S6SVTrpVq11ysA2Rp7gTfPfktc6zhtXBBC+adRLshf6sG2RfHPZ5EAc4sVZ83yCN00Fk/4kggu40ZTvIEm5g24qtU4KjBrx/BTTH8ifVASAG7gKrnWxJDcU7x8X6Ecczhm3o6YicvsLXWfh3Ch1W0k8x0nXF+0fFxgt4phz8QvypiwCCFKMqXCnqXExjq10beH+UUA7+nG6mdG/Pu0f3LgFcGrl2s0kNNjpmoJ9o4B29CMO8dMT4Q5ox8uitF6fqsrJOr8qnwNbRzv6hSnG5wP+64C7h9lp30hKNtKdWjtdkbuPA19nJ7Tz3zR/ibgARbhb4AlhavcBebmTHcFl2fvYEnW0ox9xMxKBS8btJ+KiEbq9zA4RthQXDhPa0T9TEe69gWupwc6uBUphquXgf+/FrIjweHQS4/pduMe5ERUMHUd9xv8ZR98CxkS4F2n3EUrUZ10EYNw7BWm9x1GiPssi3GgiGRDKWRYZfXlON+dfNbM+GgIwYdwAAAAASUVORK5CYII=);\
        }\
    \
    \
    /* attribution and scale controls */\
    \
    .leaflet-container .leaflet-control-attribution {\
        background: #fff;\
        background: rgba(255, 255, 255, 0.7);\
        margin: 0;\
        }\
    .leaflet-control-attribution,\
    .leaflet-control-scale-line {\
        padding: 0 5px;\
        color: #333;\
        }\
    .leaflet-control-attribution a {\
        text-decoration: none;\
        }\
    .leaflet-control-attribution a:hover {\
        text-decoration: underline;\
        }\
    .leaflet-container .leaflet-control-attribution,\
    .leaflet-container .leaflet-control-scale {\
        font-size: 11px;\
        }\
    .leaflet-left .leaflet-control-scale {\
        margin-left: 5px;\
        }\
    .leaflet-bottom .leaflet-control-scale {\
        margin-bottom: 5px;\
        }\
    .leaflet-control-scale-line {\
        border: 2px solid #777;\
        border-top: none;\
        line-height: 1.1;\
        padding: 2px 5px 1px;\
        font-size: 11px;\
        white-space: nowrap;\
        overflow: hidden;\
        -moz-box-sizing: border-box;\
             box-sizing: border-box;\
    \
        background: #fff;\
        background: rgba(255, 255, 255, 0.5);\
        }\
    .leaflet-control-scale-line:not(:first-child) {\
        border-top: 2px solid #777;\
        border-bottom: none;\
        margin-top: -2px;\
        }\
    .leaflet-control-scale-line:not(:first-child):not(:last-child) {\
        border-bottom: 2px solid #777;\
        }\
    \
    .leaflet-touch .leaflet-control-attribution,\
    .leaflet-touch .leaflet-control-layers,\
    .leaflet-touch .leaflet-bar {\
        box-shadow: none;\
        }\
    .leaflet-touch .leaflet-control-layers,\
    .leaflet-touch .leaflet-bar {\
        border: 2px solid rgba(0,0,0,0.2);\
        background-clip: padding-box;\
        }\
    \
    \
    /* popup */\
    \
    .leaflet-popup {\
        position: absolute;\
        text-align: center;\
        margin-bottom: 20px;\
        }\
    .leaflet-popup-content-wrapper {\
        padding: 1px;\
        text-align: left;\
        border-radius: 12px;\
        }\
    .leaflet-popup-content {\
        margin: 13px 19px;\
        line-height: 1.4;\
        }\
    .leaflet-popup-content p {\
        margin: 18px 0;\
        }\
    .leaflet-popup-tip-container {\
        width: 40px;\
        height: 20px;\
        position: absolute;\
        left: 50%;\
        margin-left: -20px;\
        overflow: hidden;\
        pointer-events: none;\
        }\
    .leaflet-popup-tip {\
        width: 17px;\
        height: 17px;\
        padding: 1px;\
    \
        margin: -10px auto 0;\
    \
        -webkit-transform: rotate(45deg);\
           -moz-transform: rotate(45deg);\
            -ms-transform: rotate(45deg);\
                transform: rotate(45deg);\
        }\
    .leaflet-popup-content-wrapper,\
    .leaflet-popup-tip {\
        background: white;\
        color: #333;\
        box-shadow: 0 3px 14px rgba(0,0,0,0.4);\
        }\
    .leaflet-container a.leaflet-popup-close-button {\
        position: absolute;\
        top: 0;\
        right: 0;\
        padding: 4px 4px 0 0;\
        border: none;\
        text-align: center;\
        width: 18px;\
        height: 14px;\
        font: 16px/14px Tahoma, Verdana, sans-serif;\
        color: #c3c3c3;\
        text-decoration: none;\
        font-weight: bold;\
        background: transparent;\
        }\
    .leaflet-container a.leaflet-popup-close-button:hover {\
        color: #999;\
        }\
    .leaflet-popup-scrolled {\
        overflow: auto;\
        border-bottom: 1px solid #ddd;\
        border-top: 1px solid #ddd;\
        }\
    \
    .leaflet-oldie .leaflet-popup-content-wrapper {\
        -ms-zoom: 1;\
        }\
    .leaflet-oldie .leaflet-popup-tip {\
        width: 24px;\
        margin: 0 auto;\
    \
        -ms-filter: "progid:DXImageTransform.Microsoft.Matrix(M11=0.70710678, M12=0.70710678, M21=-0.70710678, M22=0.70710678)";\
        filter: progid:DXImageTransform.Microsoft.Matrix(M11=0.70710678, M12=0.70710678, M21=-0.70710678, M22=0.70710678);\
        }\
    .leaflet-oldie .leaflet-popup-tip-container {\
        margin-top: -1px;\
        }\
    \
    .leaflet-oldie .leaflet-control-zoom,\
    .leaflet-oldie .leaflet-control-layers,\
    .leaflet-oldie .leaflet-popup-content-wrapper,\
    .leaflet-oldie .leaflet-popup-tip {\
        border: 1px solid #999;\
        }\
    \
    \
    /* div icon */\
    \
    .leaflet-div-icon {\
        background: #fff;\
        border: 1px solid #666;\
        }\
    \
    \
    /* Tooltip */\
    /* Base styles for the element that has a tooltip */\
    .leaflet-tooltip {\
        position: absolute;\
        padding: 6px;\
        background-color: #fff;\
        border: 1px solid #fff;\
        border-radius: 3px;\
        color: #222;\
        white-space: nowrap;\
        -webkit-user-select: none;\
        -moz-user-select: none;\
        -ms-user-select: none;\
        user-select: none;\
        pointer-events: none;\
        box-shadow: 0 1px 3px rgba(0,0,0,0.4);\
        }\
    .leaflet-tooltip.leaflet-clickable {\
        cursor: pointer;\
        pointer-events: auto;\
        }\
    .leaflet-tooltip-top:before,\
    .leaflet-tooltip-bottom:before,\
    .leaflet-tooltip-left:before,\
    .leaflet-tooltip-right:before {\
        position: absolute;\
        pointer-events: none;\
        border: 6px solid transparent;\
        background: transparent;\
        content: "";\
        }\
    \
    /* Directions */\
    \
    .leaflet-tooltip-bottom {\
        margin-top: 6px;\
    }\
    .leaflet-tooltip-top {\
        margin-top: -6px;\
    }\
    .leaflet-tooltip-bottom:before,\
    .leaflet-tooltip-top:before {\
        left: 50%;\
        margin-left: -6px;\
        }\
    .leaflet-tooltip-top:before {\
        bottom: 0;\
        margin-bottom: -12px;\
        border-top-color: #fff;\
        }\
    .leaflet-tooltip-bottom:before {\
        top: 0;\
        margin-top: -12px;\
        margin-left: -6px;\
        border-bottom-color: #fff;\
        }\
    .leaflet-tooltip-left {\
        margin-left: -6px;\
    }\
    .leaflet-tooltip-right {\
        margin-left: 6px;\
    }\
    .leaflet-tooltip-left:before,\
    .leaflet-tooltip-right:before {\
        top: 50%;\
        margin-top: -6px;\
        }\
    .leaflet-tooltip-left:before {\
        right: 0;\
        margin-right: -12px;\
        border-left-color: #fff;\
        }\
    .leaflet-tooltip-right:before {\
        left: 0;\
        margin-left: -12px;\
        border-right-color: #fff;\
        }\
    ' + '</style>'
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




