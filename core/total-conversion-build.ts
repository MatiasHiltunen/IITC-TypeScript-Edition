

import { boot } from "./code/boot";
import { Player } from "./code/player";
import { store } from "./code/store";
import { body } from "./views/body";
import { head, loginHead } from "./views/head";


// ensure plugin framework is there, even if iitc is not yet loaded
// @ts-ignore
if (typeof window.plugin !== 'function') window.plugin = function() {};
// @ts-ignore
window.script_info = plugin_info;

// REPLACE ORIGINAL SITE 
if (document.documentElement.getAttribute('itemscope') !== null) {
  throw new Error('Ingress Intel Website is down, not a userscript issue.');
}

// disable original JS
window.onload = () => { };
document.body.onload = () => { };

// @ts-ignore
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

//@ts-ignore
store.PLAYER = new Player(window.PLAYER)

document.head.innerHTML = ''
document.head.append(head)
document.body = body

window.addEventListener('load', boot);





