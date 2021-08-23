// PORTAL DETAILS DISPLAY ////////////////////////////////////////////
// hand any of these functions the details-hash of a portal, and they
// will return pretty, displayable HTML or parts thereof.

import { COLORS_LVL, COLORS_MOD, OCTANTS, OCTANTS_ARROW, RESO_NRG } from "./config";
import { teamStringToId } from "./entity_info";
import { capitalize, digits, formatInterval, genFourColumnTable, prettyEnergy } from "./utils_misc";
import { getAttackApGain, getCurrentPortalEnergy, getPortalHackDetails, getPortalMitigationDetails, getPortalRange, getTotalPortalEnergy } from "./portal_info";
import { store } from "./store";
import $ from "jquery"
import L from "leaflet";

export const getPortalHistoryDetails = function (d) {
  if (!d.history) {
    return '<div id="historydetails" class="missing">History missing</div>';
  }
  let classParts = {};
  ['visited', 'captured', 'scoutControlled'].forEach(function (k) {
    classParts[k] = d.history[k] ? 'class="completed"' : "";
  });

  return L.Util.template('<div id="historydetails">History: '
  + '<span id="visited" {visited}>visited</span> | '
  + '<span id="captured" {captured}>captured</span> | '
  + '<span id="scout-controlled" {scoutControlled}>scout controlled</span>'
  + '</div>', classParts);
}

// returns displayable text+link about portal range
export const getRangeText = function(d) {
  let range = getPortalRange(d);

  let title = 'Base range:\t' + digits(Math.floor(range.base))+'m'
    + '\nLink amp boost:\t×'+range.boost
    + '\nRange:\t'+digits(Math.floor(range.range))+'m';

  if(!range.isLinkable) title += '\nPortal is missing resonators,\nno new links can be made';

  return ['range',
      '<a onclick="window.rangeLinkClick()"'
    + (range.isLinkable ? '' : ' style="text-decoration:line-through;"')
    + '>'
    + (range.range > 1000
      ? Math.floor(range.range/1000) + ' km'
      : Math.floor(range.range)      + ' m')
    + '</a>',
    title];
}


// given portal details, returns html code to display mod details.
export const getModDetails = function(d) {
  let mods = [];
  let modsTitle = [];
  let modsColor = [];
  $.each(d.mods, function(ind, mod) {
    let modName = '';
    let modTooltip = '';
    let modColor = '#000';

    if (mod) {
      // all mods seem to follow the same pattern for the data structure
      // but let's try and make this robust enough to handle possible future differences

      modName = mod.name || '(unknown mod)';

      if (mod.rarity) {
        modName = capitalize(mod.rarity).replace(/_/g,' ') + ' ' + modName;
      }

      modTooltip = modName + '\n';
      if (mod.owner) {
        modTooltip += 'Installed by: '+ mod.owner + '\n';
      }

      if (mod.stats) {
        modTooltip += 'Stats:';
        for (let key in mod.stats) {
          if (!mod.stats.hasOwnProperty(key)) continue;
          let val = mod.stats[key];

          // if (key === 'REMOVAL_STICKINESS' && val == 0) continue;  // stat on all mods recently - unknown meaning, not displayed in stock client

          // special formatting for known mod stats, where the display of the raw value is less useful
          if      (key === 'HACK_SPEED')            val = (val/10000)+'%'; // 500000 = 50%
          else if (key === 'HIT_BONUS')             val = (val/10000)+'%'; // 300000 = 30%
          else if (key === 'ATTACK_FREQUENCY')      val = (val/1000) +'x'; // 2000 = 2x
          else if (key === 'FORCE_AMPLIFIER')       val = (val/1000) +'x'; // 2000 = 2x
          else if (key === 'LINK_RANGE_MULTIPLIER') val = (val/1000) +'x'; // 2000 = 2x
          else if (key === 'LINK_DEFENSE_BOOST')    val = (val/1000) +'x'; // 1500 = 1.5x
          else if (key === 'REMOVAL_STICKINESS' && val > 100) val = (val/10000)+'%'; // an educated guess
          // else display unmodified. correct for shield mitigation and multihack - unknown for future/other mods

          modTooltip += '\n+' +  val + ' ' + key.toUpperCase().replace(/_/g,' ');
        }
      }

      if (mod.rarity) {
        modColor = COLORS_MOD[mod.rarity];
      } else {
        modColor = '#fff';
      }
    }

    mods.push(modName);
    modsTitle.push(modTooltip);
    modsColor.push(modColor);
  });


  let t = '';
  for (let i=0; i<mods.length; i++) {
    t += '<span'+(modsTitle[i].length ? ' title="'+modsTitle[i]+'"' : '')+' style="color:'+modsColor[i]+'">'+mods[i]+'</span>'
  }
  // and add blank entries if we have less than 4 mods (as the server no longer returns all mod slots, but just the filled ones)
  for (let i=mods.length; i<4; i++) {
    t += '<span style="color:#000"></span>'
  }

  return t;
}

export const getEnergyText = function(d) {
  let currentNrg = getCurrentPortalEnergy(d);
  let totalNrg = getTotalPortalEnergy(d);
  let title = currentNrg + ' / ' + totalNrg;
  let fill = prettyEnergy(currentNrg) + ' / ' + prettyEnergy(totalNrg)
  return ['energy', fill, title];
}


export const getResonatorDetails = function(d) {
  let resoDetails = [];
  // octant=slot: 0=E, 1=NE, 2=N, 3=NW, 4=W, 5=SW, 6=S, SE=7
  // resos in the display should be ordered like this:
  //   N    NE         Since the view is displayed in rows, they
  //  NW    E          need to be ordered like this: N NE NW E W SE SW S
  //   W    SE         i.e. 2 1 3 0 4 7 5 6
  //  SW    S
  // note: as of 2014-05-23 update, this is not true for portals with empty slots!

  let processResonatorSlot = function(reso,slot) {
    let lvl=0, nrg=0, owner=null;

    if (reso) {
      lvl = parseInt(reso.level);
      nrg = parseInt(reso.energy);
      owner = reso.owner;
    }

    resoDetails.push(renderResonatorDetails(slot, lvl, nrg, owner));
  };


  // if all 8 resonators are deployed, we know which is in which slot

  if (d.resonators.length == 8) {
    // fully deployed - we can make assumptions about deployment slots
    $.each([2, 1, 3, 0, 4, 7, 5, 6], function(ind, slot) {
      processResonatorSlot(d.resonators[slot],slot);
    });
  } else {
    // partially deployed portal - we can no longer find out which resonator is in which slot
    for(let ind=0; ind<8; ind++) {
      processResonatorSlot(ind < d.resonators.length ? d.resonators[ind] : null, null);
    }

  }

  return '<table id="resodetails">' + genFourColumnTable(resoDetails) + '</table>';

}

// helper function that renders the HTML for a given resonator. Does
// not work with raw details-hash. Needs digested infos instead:
// slot: which slot this resonator occupies. Starts with 0 (east) and
// rotates clockwise. So, last one is 7 (southeast).
export const renderResonatorDetails = function(slot, level, nrg, nick) {
  let className 
  if(OCTANTS[slot] === 'N')
     className = 'meter north';
  else
     className = 'meter';

  let max = RESO_NRG[level];
  let fillGrade = level > 0 ? nrg/max*100 : 0;

  let inf = (level > 0 ? 'energy:\t' + nrg   + ' / ' + max + ' (' + Math.round(fillGrade) + '%)\n'
                        +'level:\t'  + level + '\n'
                        +'owner:\t'  + nick  + '\n'
                       : '')
          + (slot !== null ? 'octant:\t' + OCTANTS[slot] + ' ' + OCTANTS_ARROW[slot]:'');

  let style = fillGrade ? 'width:'+fillGrade+'%; background:' + COLORS_LVL[level]+';':'';

  let color = (level < 3 ? "#9900FF" : "#FFFFFF");

  let lbar = level > 0 ? '<span class="meter-level" style="color: ' + color + ';"> L ' + level + ' </span>' : '';

  let fill  = '<span style="'+ style+'"></span>';

  let meter = '<span class="' + className + '" title="'+inf+'">' + fill + lbar + '</span>';

  nick = nick ? '<span class="nickname">'+nick+'</span>' : null;
  return [meter, nick || ''];
}

// calculate AP gain from destroying portal and then capturing it by deploying resonators
export const getAttackApGainText = function(d,fieldCount,linkCount) {
  let breakdown = getAttackApGain(d,fieldCount,linkCount);
  let totalGain = breakdown.enemyAp;

  let t = '';

  if (teamStringToId(store.PLAYER.team.toString()) == teamStringToId(d.team)) {
    totalGain = breakdown.friendlyAp;
    t += 'Friendly AP:\t' + breakdown.friendlyAp + '\n';
    t += '  Deploy ' + breakdown.deployCount + ', ';
    t += 'Upgrade ' + breakdown.upgradeCount + '\n';
    t += '\n';
  }
  t += 'Enemy AP:\t' + breakdown.enemyAp + '\n';
  t += '  Destroy AP:\t' + breakdown.destroyAp + '\n';
  t += '  Capture AP:\t' + breakdown.captureAp + '\n';

  return ['AP Gain', digits(totalGain), t];
}


export const getHackDetailsText = function(d) {
  let hackDetails = getPortalHackDetails(d);

  let shortHackInfo = hackDetails.hacks+' @ '+formatInterval(hackDetails.cooldown);

  let title = 'Hacks available every 4 hours\n'
            + 'Hack count:\t'+hackDetails.hacks+'\n'
            + 'Cooldown time:\t'+ formatInterval(hackDetails.cooldown)+'\n'
            + 'Burnout time:\t'+ formatInterval(hackDetails.burnout);

  return ['hacks', shortHackInfo, title];
}


export const getMitigationText = function(d,linkCount) {
  let mitigationDetails = getPortalMitigationDetails(d,linkCount);

  let mitigationShort = mitigationDetails.total;
  if (mitigationDetails.excess) mitigationShort += ' (+'+mitigationDetails.excess+')';

  let title = 'Total shielding:\t'+(mitigationDetails.shields+mitigationDetails.links)+'\n'
            + '- active:\t'+mitigationDetails.total+'\n'
            + '- excess:\t'+mitigationDetails.excess+'\n'
            + 'From\n'
            + '- shields:\t'+mitigationDetails.shields+'\n'
            + '- links:\t'+mitigationDetails.links+' ('+mitigationDetails.linkDefenseBoost+'x)';

  return ['shielding', mitigationShort, title];
}
