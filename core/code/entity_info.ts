

// ENTITY DETAILS TOOLS //////////////////////////////////////////////
// hand any of these functions the details-hash of an entity (i.e.
// portal, link, field) and they will return useful data.

import { TEAM_ENL, TEAM_NONE, TEAM_RES } from "./config";


// given the entity detail data, returns the team the entity belongs
// to. Uses TEAM_* enum values.
export const getTeam = function(details) {
  return teamStringToId(details.team);
}

export const teamStringToId = function(teamStr) {
  var team = TEAM_NONE;
  if(teamStr === 'ENLIGHTENED') team = TEAM_ENL;
  if(teamStr === 'RESISTANCE') team = TEAM_RES;
  if(teamStr === 'E') team = TEAM_ENL;
  if(teamStr === 'R') team = TEAM_RES;
  return team;
}


