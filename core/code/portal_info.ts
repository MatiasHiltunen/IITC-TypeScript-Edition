// PORTAL DETAILS TOOLS //////////////////////////////////////////////
// hand any of these functions the details-hash of a portal, and they
// will return useful, but raw data.


import { BASE_HACK_COOLDOWN, BASE_HACK_COUNT, CAPTURE_PORTAL, COMPLETION_BONUS, DEFAULT_PORTAL_IMG, DEPLOY_RESONATOR, DESTROY_FIELD, DESTROY_LINK, DESTROY_RESONATOR, MAX_PORTAL_LEVEL, MAX_RESO_PER_PLAYER, RESO_NRG, UPGRADE_ANOTHERS_RESONATOR } from "./config";
import { store } from "./store";
import $ from "jquery"
import { Team } from "./player";
// returns a float. Displayed portal level is always rounded down from
// that value.
export const getPortalLevel = function (d): number {
  let lvl = 0;
  let hasReso = false;
  $.each(d.resonators, function (ind, reso) {
    if (!reso) return true;
    lvl += parseInt(reso.level);
    hasReso = true;
  });
  return hasReso ? Math.max(1, lvl / 8) : 0;
}

export const getTotalPortalEnergy = function (d) {
  let nrg = 0;
  $.each(d.resonators, function (ind, reso) {
    if (!reso) return true;
    let level = parseInt(reso.level);
    let max = RESO_NRG[level];
    nrg += max;
  });
  return nrg;
}

export const getPortalEnergy = function (d) {
  return getTotalPortalEnergy(d)
}

export const getCurrentPortalEnergy = function (d) {
  let nrg = 0;
  $.each(d.resonators, function (ind, reso) {
    if (!reso) return true;
    nrg += parseInt(reso.energy);
  });
  return nrg;
}

export const getPortalRange = function (d) {
  // formula by the great gals and guys at
  // http://decodeingress.me/2012/11/18/ingress-portal-levels-and-link-range/

  let lvl = 0;
  let resoMissing = false;
  // currently we get a short resonator array when some are missing
  if (d.resonators.length < 8) {
    resoMissing = true;
  }
  // but in the past we used to always get an array of 8, but will 'null' objects for some entries. maybe that will return?
  $.each(d.resonators, function (ind, reso) {
    if (!reso) {
      resoMissing = true;
      return;
    }
  });


  let base:number = 160 * Math.pow(getPortalLevel(d), 4)
  let boost:number = getLinkAmpRangeBoost(d)
  let range:number = boost * base
  let isLinkable:boolean = !resoMissing


  return {
    base,
    boost,
    range,
    isLinkable
  };
}

export const getLinkAmpRangeBoost = function (d) {
  // additional range boost calculation

  // link amps scale: first is full, second a quarter, the last two an eighth
  let scale = [1.0, 0.25, 0.125, 0.125];

  let boost = 0.0;  // initial boost is 0.0 (i.e. no boost over standard range)

  let linkAmps = getPortalModsByType(d, 'LINK_AMPLIFIER');

  linkAmps.forEach(function (mod, i) {
    // link amp stat LINK_RANGE_MULTIPLIER is 2000 for rare, and gives 2x boost to the range
    // and very-rare is 7000 and gives 7x the range
    let baseMultiplier = mod.stats.LINK_RANGE_MULTIPLIER / 1000;
    boost += baseMultiplier * scale[i];
  });

  return (linkAmps.length > 0) ? boost : 1.0;
}


export const getAttackApGain = function (d, fieldCount, linkCount) {
  if (!fieldCount) fieldCount = 0;

  let resoCount = 0;
  let maxResonators = MAX_RESO_PER_PLAYER.slice(0);
  let curResonators = [0, 0, 0, 0, 0, 0, 0, 0, 0];

  for (let n = store.PLAYER.verified_level + 1; n < 9; n++) {
    maxResonators[n] = 0;
  }
  $.each(d.resonators, function (ind, reso) {
    if (!reso)
      return true;
    resoCount += 1;
    let reslevel = parseInt(reso.level);

    if (reso.owner === store.PLAYER.nickname) {
      if (maxResonators[reslevel] > 0) {
        maxResonators[reslevel] -= 1;
      }
    } else {
      curResonators[reslevel] += 1;
    }
  });


  let resoAp = resoCount * DESTROY_RESONATOR;
  let linkAp = linkCount * DESTROY_LINK;
  let fieldAp = fieldCount * DESTROY_FIELD;
  let destroyAp = resoAp + linkAp + fieldAp;
  let captureAp = CAPTURE_PORTAL + 8 * DEPLOY_RESONATOR + COMPLETION_BONUS;
  let enemyAp = destroyAp + captureAp;
  let deployCount = 8 - resoCount;
  let completionAp = (deployCount > 0) ? COMPLETION_BONUS : 0;
  let upgradeCount = 0;
  let upgradeAvailable = maxResonators[8];
  for (let n = 7; n >= 0; n--) {
    upgradeCount += curResonators[n];
    if (upgradeAvailable < upgradeCount) {
      upgradeCount -= (upgradeCount - upgradeAvailable);
    }
    upgradeAvailable += maxResonators[n];
  }
  let friendlyAp = deployCount * DEPLOY_RESONATOR + upgradeCount * UPGRADE_ANOTHERS_RESONATOR + completionAp;
  return {
    friendlyAp: friendlyAp,
    deployCount: deployCount,
    upgradeCount: upgradeCount,
    enemyAp: enemyAp,
    destroyAp: destroyAp,
    resoAp: resoAp,
    captureAp: captureAp
  };
}

//This function will return the potential level a player can upgrade it to
export const potentialPortalLevel = function (d) {
  let current_level = getPortalLevel(d);
  let potential_level = current_level;

  if (store.PLAYER.team === d.team) {
    let resonators_on_portal = d.resonators;
    let resonator_levels = new Array();
    // figure out how many of each of these resonators can be placed by the player
    let player_resontators = new Array();
    for (let i = 1; i <= MAX_PORTAL_LEVEL; i++) {

      player_resontators[i] = i > store.PLAYER.verified_level ? 0 : MAX_RESO_PER_PLAYER[i];
    }
    $.each(resonators_on_portal, function (ind, reso) {

      if (reso !== null && reso.owner === store.PLAYER.nickname) {
        player_resontators[reso.level]--;
      }
      resonator_levels.push(reso === null ? 0 : reso.level);
    });

    resonator_levels.sort(function (a, b) {
      return (a - b);
    });

    // Max out portal
    let install_index = 0;
    for (let i = MAX_PORTAL_LEVEL; i >= 1; i--) {
      for (let install = player_resontators[i]; install > 0; install--) {
        if (resonator_levels[install_index] < i) {
          resonator_levels[install_index] = i;
          install_index++;
        }
      }
    }
    //log.log(resonator_levels);
    potential_level = resonator_levels.reduce(function (a, b) { return a + b; }) / 8;
  }
  return (potential_level);
}


export const fixPortalImageUrl = function (url) {
  if (url) {
    if (window.location.protocol === 'https:') {
      url = url.replace(/^http:\/\//, '//');
    }
    return url;
  } else {
    return DEFAULT_PORTAL_IMG;
  }

}


export const getPortalModsByType = function (d, type) {
  let mods = [];

  const typeToStat = {
    RES_SHIELD: 'MITIGATION',
    FORCE_AMP: 'FORCE_AMPLIFIER',
    TURRET: 'HIT_BONUS',  // and/or ATTACK_FREQUENCY??
    HEATSINK: 'HACK_SPEED',
    MULTIHACK: 'BURNOUT_INSULATION',
    LINK_AMPLIFIER: 'LINK_RANGE_MULTIPLIER',
    ULTRA_LINK_AMP: 'OUTGOING_LINKS_BONUS', // and/or LINK_DEFENSE_BOOST??
  };

  let stat = typeToStat[type];

  $.each(d.mods || [], function (i, mod) {
    if (mod && mod.stats.hasOwnProperty(stat)) mods.push(mod);
  });


  // sorting mods by the stat keeps code simpler, when calculating combined mod effects
  mods.sort(function (a, b) {
    return b.stats[stat] - a.stats[stat];
  });

  return mods;
}



export const getPortalShieldMitigation = function (d) {
  let shields = getPortalModsByType(d, 'RES_SHIELD');

  let mitigation = 0;
  $.each(shields, function (i, s) {
    mitigation += parseInt(s.stats.MITIGATION);
  });

  return mitigation;
}

export const getPortalLinkDefenseBoost = function (d) {
  let ultraLinkAmps = getPortalModsByType(d, 'ULTRA_LINK_AMP');

  let linkDefenseBoost = 1;

  $.each(ultraLinkAmps, function (index, ultraLinkAmp) {
    linkDefenseBoost *= parseInt(ultraLinkAmp.stats.LINK_DEFENSE_BOOST) / 1000;
  });

  return Math.round(10 * linkDefenseBoost) / 10;
}

export const getPortalLinksMitigation = function (linkCount) {
  let mitigation = Math.round(400 / 9 * Math.atan(linkCount / Math.E));
  return mitigation;
}

export const getPortalMitigationDetails = function (d, linkCount) {
  let linkDefenseBoost = getPortalLinkDefenseBoost(d);

  let mitigation = {
    shields: getPortalShieldMitigation(d),
    links: getPortalLinksMitigation(linkCount) * linkDefenseBoost,
    linkDefenseBoost: linkDefenseBoost,
    total: null,
    excess: null
  };

  // mitigation is limited to 95% (as confirmed by Brandon Badger on G+)
  mitigation.total = Math.min(95, mitigation.shields + mitigation.links);

  let excess = (mitigation.shields + mitigation.links) - mitigation.total;
  mitigation.excess = Math.round(10 * excess) / 10;

  return mitigation;
}

export const getMaxOutgoingLinks = function (d) {
  let linkAmps = getPortalModsByType(d, 'ULTRA_LINK_AMP');

  let links = 8;

  linkAmps.forEach(function (mod, i) {
    links += parseInt(mod.stats.OUTGOING_LINKS_BONUS);
  });

  return links;
};

export const getPortalHackDetails = function (d) {

  let heatsinks = getPortalModsByType(d, 'HEATSINK');
  let multihacks = getPortalModsByType(d, 'MULTIHACK');

  // first mod of type is fully effective, the others are only 50% effective
  let effectivenessReduction = [1, 0.5, 0.5, 0.5];

  let cooldownTime = BASE_HACK_COOLDOWN;

  $.each(heatsinks, function (index, mod) {
    let hackSpeed = parseInt(mod.stats.HACK_SPEED) / 1000000;
    cooldownTime = Math.round(cooldownTime * (1 - hackSpeed * effectivenessReduction[index]));
  });

  let hackCount = BASE_HACK_COUNT; // default hacks

  $.each(multihacks, function (index, mod) {
    let extraHacks = parseInt(mod.stats.BURNOUT_INSULATION);
    hackCount = hackCount + (extraHacks * effectivenessReduction[index]);
  });

  return { cooldown: cooldownTime, hacks: hackCount, burnout: cooldownTime * (hackCount - 1) };
}

export interface Portal {
  level: number,
  title: string,
  image: string,
  resCount: number,
  health: number,
  team: Team,
  type: string
  latE6: number,
  lngE6: number,
}

// given a detailed portal structure, return summary portal data, as seen in the map tile data
export const getPortalSummaryData = function (d): Portal {

  // NOTE: the summary data reports unclaimed portals as level 1 - not zero as elsewhere in IITC
  let level = parseInt(getPortalLevel(d).toString());
  if (level == 0) level = 1; //niantic returns neutral portals as level 1, not 0 as used throughout IITC elsewhere

  let resCount = 0;
  if (d.resonators) {
    for (let x in d.resonators) {
      if (d.resonators[x]) resCount++;
    }
  }
  let maxEnergy = getTotalPortalEnergy(d);
  let curEnergy = getCurrentPortalEnergy(d);
  let health = maxEnergy > 0 ? ~~(curEnergy / maxEnergy * 100) : 0;

  return {
    level: level,
    title: d.title,
    image: d.image,
    resCount: resCount,
    latE6: d.latE6,
    health: health,
    team: d.team,
    lngE6: d.lngE6,
    type: 'portal'
  };
}

export const getPortalAttackValues = function (d) {
  let forceamps = getPortalModsByType(d, 'FORCE_AMP');
  let turrets = getPortalModsByType(d, 'TURRET');

  // at the time of writing, only rare force amps and turrets have been seen in the wild, so there's a little guesswork
  // at how the stats work and combine
  // algorithm has been compied from getLinkAmpRangeBoost
  // FIXME: only extract stats and put the calculation in a method to be used for link range, force amplifier and attack
  // frequency
  // note: scanner shows rounded values (adding a second FA shows: 2.5x+0.2x=2.8x, which should be 2.5x+0.25x=2.75x)

  // amplifier scale: first is full, second a quarter, the last two an eighth
  let scale = [1.0, 0.25, 0.125, 0.125];

  let attackValues = {
    hit_bonus: 0,
    force_amplifier: 0,
    attack_frequency: 0,
  };

  forceamps.forEach(function (mod, i) {
    // force amp stat FORCE_AMPLIFIER is 2000 for rare, and gives 2x boost to the range
    let baseMultiplier = mod.stats.FORCE_AMPLIFIER / 1000;
    attackValues.force_amplifier += baseMultiplier * scale[i];
  });

  turrets.forEach(function (mod, i) {
    // turret stat ATTACK_FREQUENCY is 2000 for rare, and gives 2x boost to the range
    let baseMultiplier = mod.stats.ATTACK_FREQUENCY / 1000;
    attackValues.attack_frequency += baseMultiplier * scale[i];

    attackValues.hit_bonus += mod.stats.HIT_BONUS / 10000;
  });

  return attackValues;
}


