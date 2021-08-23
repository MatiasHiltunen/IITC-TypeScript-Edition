
// GAME STATUS ///////////////////////////////////////////////////////
// MindUnit display

import { REFRESH_GAME_SCORE } from "./config";
import { postAjax } from "./send_request";
import { digits } from "./utils_misc";
import $ from 'jquery'

export const updateGameScore = function () {

      postAjax('getGameScore', {}).then(data => {
        
        if (data && data.result) {
      
          let e = parseInt(data.result[0]); //enlightened score in result[0]
          let r = parseInt(data.result[1]); //resistance score in result[1]
          let s = r + e;
          let rp = r / s * 100, ep = e / s * 100;
          r = digits(r), e = digits(e);
          let rs = '<span class="res" style="width:' + rp + '%;">' + Math.round(rp) + '%&nbsp;</span>';
          let es = '<span class="enl" style="width:' + ep + '%;">&nbsp;' + Math.round(ep) + '%</span>';
          $('#gamestat').html(rs + es).one('click', function () { updateGameScore() });
          // help cursor via “#gamestat span”
          $('#gamestat').attr('title', 'Resistance:\t' + r + ' MindUnits\nEnlightened:\t' + e + ' MindUnits');
        } else if (data && data.error) {
          console.warn('game score failed to load: ' + data.error);
        } else {
          console.warn('game score failed to load - unknown reason');
        }

      }).catch(err => console.error(err))


  // TODO: idle handling - don't refresh when IITC is idle!
  window.setTimeout(() => { updateGameScore() }, REFRESH_GAME_SCORE * 1000);
}
