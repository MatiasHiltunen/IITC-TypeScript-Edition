// REDEEMING ///////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////

import { setupPlayerStat } from "./boot";
import { COLORS_LVL } from "./config";
import { dialog } from "./dialog";
import { Player } from "./player";
import { postAjax } from "./send_request";
import { store } from "./store";
import { escapeHtmlSpecialChars } from "./utils_misc";
import $ from 'jquery'

let REDEEM_SHORT_NAMES = {
  'portal shield':'S',
  'force amp':'FA',
  'link amp':'LA',
  'heatsink':'H',
  'multihack':'M',
  'turret':'T',
  'unusual object':'U',
  'resonator':'R',
  'xmp burster':'X',
  'power cube':'C',
  'media':'M',
  'ultra strike':'US',
}

/* These are HTTP status codes returned by the redemption API.
 * TODO: Move to another file? Use more generally across IITC?
 */
let REDEEM_STATUSES = {
  429: 'You have been rate-limited by the server. Wait a bit and try again.',
  500: 'Internal server error'
};

export const handleRedeemResponse = function(data) {
  var passcode = data

  if(data.error) {
    // log.error('Error redeeming passcode "'+passcode+'": ' + data.error)
    dialog({
      title: 'Error: ' + passcode,
      html: '<strong>' + data.error + '</strong>'
    });
    return;
  }
  if(!data.rewards) {
    // log.error('Error redeeming passcode "'+passcode+'": ', data)
    dialog({
      title: 'Error: ' + passcode,
      html: '<strong>An unexpected error occured</strong>'
    });
    return;
  }

  if(data.playerData) {
    // Probably fails, test.
    store.PLAYER = new Player(data.playerData);
    setupPlayerStat();
  }

  var format = "long";
  try {
    format = localStorage["iitc-passcode-format"];
  } catch(e) {}

  var formatHandlers = {
    "short": formatPasscodeShort,
    "long": formatPasscodeLong
  }
  if(!formatHandlers[format])
    format = "long";

  var html = formatHandlers[format](data.rewards);

  var buttons = {};
  Object.keys(formatHandlers).forEach(function(label) {
    if(label == format) return;

    buttons[label.toUpperCase()] = function() {
      (<any>$(this)).dialog("close");
      localStorage["iitc-passcode-format"] = label;
      handleRedeemResponse(data);
    }
  });

  // Display it
  dialog({
    title: 'Passcode: ' + passcode,
    html: html,
    buttons: buttons
  });
};

export const formatPasscodeLong = function(data) {
  var html = '<p><strong>Passcode confirmed. Acquired items:</strong></p><ul class="redeemReward">';

  if(data.other) {
    data.other.forEach(function(item) {
      html += '<li>' + escapeHtmlSpecialChars(item) + '</li>';
    });
  }

  if(0 < data.xm)
    html += '<li>' + escapeHtmlSpecialChars(data.xm) + ' XM</li>';
  if(0 < data.ap)
    html += '<li>' + escapeHtmlSpecialChars(data.ap) + ' AP</li>';

  if(data.inventory) {
    data.inventory.forEach(function(type) {
      type.awards.forEach(function(item) {
        html += '<li>' + item.count + 'x ';

        var l = item.level;
        if(0 < l) {
          l = parseInt(l);
          html += '<span class="itemlevel" style="color:' + COLORS_LVL[l] + '">L' + l + '</span> ';
        }

        html += escapeHtmlSpecialChars(type.name) + '</li>';
      });
    });
  }

  html += '</ul>'
  return html;
}

export const formatPasscodeShort = function(data) {

  let awards = []

  if(data.other) {
     awards = data.other.map(escapeHtmlSpecialChars);
  } 

  if(0 < data.xm)
    awards.push(escapeHtmlSpecialChars(data.xm) + ' XM');
  if(0 < data.ap)
    awards.push(escapeHtmlSpecialChars(data.ap) + ' AP');

  if(data.inventory) {
    data.inventory.forEach(function(type) {
      type.awards.forEach(function(item) {
        var str = "";
        if(item.count > 1)
          str += item.count + "&nbsp;";

        if(REDEEM_SHORT_NAMES[type.name.toLowerCase()]) {
          var shortName = REDEEM_SHORT_NAMES[type.name.toLowerCase()];

          var l = item.level;
          if(0 < l) {
            l = parseInt(l);
            str += '<span class="itemlevel" style="color:' + COLORS_LVL[l] + '">' + shortName + l + '</span>';
          } else {
            str += shortName;
          }
        } else { // no short name known
          var l = item.level;
          if(0 < l) {
            l = parseInt(l);
            str += '<span class="itemlevel" style="color:' + COLORS_LVL[l] + '">L' + l + '</span> ';
          }
          str += type.name;
        }

        awards.push(str);
      });
    });
  }

  return '<p class="redeemReward">' + awards.join(', ') + '</p>'
}

export const setupRedeem = function() {
  $("#redeem").keypress(function(e) {
    if((e.keyCode ? e.keyCode : e.which) !== 13) return;

    let passcode = $(this).val() as string;
    passcode = passcode.replace(/[^\x20-\x7E]+/g, ''); //removes non-printable characters
    if(!passcode) return;

    postAjax('redeemReward', {passcode:passcode}).then(handleRedeemResponse).catch( function(response) {
      let extra = '';
      if(response.status) {
        extra = (REDEEM_STATUSES[response.status] || 'The server indicated an error.') + ' (HTTP ' + response.status + ')';
      } else {
        extra = 'No status code was returned.';
      }
      dialog({
        title: 'Request failed: ' + passcode,
        html: '<strong>The HTTP request failed.</strong> ' + extra
      });
    });

    
  });
};
