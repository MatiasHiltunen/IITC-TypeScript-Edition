// IDLE HANDLING /////////////////////////////////////////////////////

import { MAX_IDLE_TIME, REFRESH } from "./config";
import $ from "jquery"

let idleTime = 0; // in seconds
let _idleTimeLimit = MAX_IDLE_TIME;
let _onResumeFunctions = [];
const IDLE_POLL_TIME = 10;

export const idlePoll = function () {
  let wasIdle = isIdle();
  idleTime += IDLE_POLL_TIME;

  // @ts-ignore
  let hidden = (document.hidden || document.webkitHidden || document.mozHidden || document.msHidden || false);
  if (hidden) {
    _idleTimeLimit = REFRESH; // set a small time limit before entering idle mode
  }
  if (!wasIdle && isIdle()) {
    /* log.log('idlePoll: entering idle mode'); */
  }
}

setInterval(idlePoll, IDLE_POLL_TIME * 1000);

export const idleReset = function () {
  // update immediately when the user comes back
  if (isIdle()) {
    console.log("leavin idle mode")

    idleTime = 0;
    $.each(_onResumeFunctions, function (ind, f) {
      console.log("leaving idle, running functions")
      f();
    });
  }
  idleTime = 0;
  _idleTimeLimit = MAX_IDLE_TIME;
/*   console.log(_idleTimeLimit) */
};

export const idleSet = function () {
  let wasIdle = isIdle();

  _idleTimeLimit = 0; // a zero time here will cause idle to start immediately

  if (!wasIdle && isIdle()) {
    console.log('idleSet: entering idle mode')
    /* log.log ('idleSet: entering idle mode'); */
  }
}


// only reset idle on mouse move where the coordinates are actually different.
// some browsers send the event when not moving!
let _lastMouseX = -1, _lastMouseY = -1;
const idleMouseMove = function (e) {
  let dX = _lastMouseX - e.clientX;
  let dY = _lastMouseY - e.clientY;
  let deltaSquared = dX * dX + dY * dY;
  // only treat movements over 3 pixels as enough to reset us
  if (deltaSquared > 3 * 3) {
    _lastMouseX = e.clientX;
    _lastMouseY = e.clientY;
    idleReset();
  }
}

export const setupIdle = function () {
  $('body').keypress(idleReset);
  $('body').mousemove(idleMouseMove);
}


export const isIdle = function () {
  return idleTime >= _idleTimeLimit;
}



// add your function here if you want to be notified when the user
// resumes from being idle
export const addResumeFunction = function (f) {
  _onResumeFunctions.push(f);
}
