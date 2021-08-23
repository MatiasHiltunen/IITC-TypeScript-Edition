// created to start cleaning up "window" interaction
//

import { Debug } from "./debugging";
import { runHooks } from "./hooks";
import { smartphone } from "./smartphone";
import { store } from "./store";
import $ from 'jquery'

let currentPane = '';

export const show = function(id) {
    if (currentPane == id) return;
    currentPane = id;
    hideall();


    runHooks("paneChanged", id);

    switch (id) {
        case 'all':
        case 'faction':
        case 'alerts':
          
            store.chat.show(id);
            break;
        case 'debug':
            (new Debug()).log.show()
            break;
        case 'map':
            smartphone.mapButton.click();
            $('#portal_highlight_select').show();
            $('#farm_level_select').show();
            break;
        case 'info':
            smartphone.sideButton.click();
            break;
    }

    // @ts-ignore
    if (typeof android !== 'undefined' && android && android.switchToPane) {
    // @ts-ignore
        android.switchToPane(id);
    }
}

export const hideall = function() {
    $('#chatcontrols, #chat, #chatinput, #sidebartoggle, #scrollwrapper, #updatestatus, #portal_highlight_select').hide();
    $('#farm_level_select').hide();
    $('#map').css({ 'visibility': 'hidden', 'opacity': '0' });
    $('.ui-tooltip').remove();
}