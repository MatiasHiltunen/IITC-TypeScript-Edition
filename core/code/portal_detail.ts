/// PORTAL DETAIL //////////////////////////////////////
// code to retrieve the new portal detail data from the servers

import { store } from './store'
import { DataCache } from "./data_cache";
import { decodeArray } from "./entity_decode";
import { runHooks } from "./hooks";
import { postAjax } from './send_request';
import { renderPortalDetails } from './portal_detail_display';
import $ from "jquery"

// NOTE: the API for portal detailed information is NOT FINAL
// this is a temporary measure to get things working again after a major change to the intel map
// API. expect things to change here

export class PortalDetail {

  cache: DataCache;
  requestQueue = {};

  constructor() {
    this.cache = new DataCache();

    this.cache.startExpireInterval(20);
  }

  get(guid) {
    return this.cache.get(guid);
  }

  isFresh(guid) {
    return this.cache.isFresh(guid);
  }


  handleResponse(guid: string, success: boolean, data?) {
    if (!data || data.error || !data.result) {
      success = false;
    }

    if (success) {

      const dict = decodeArray.portal(data.result, 'detailed');

      console.log("detailed portal data: ", dict)
      // entity format, as used in map data
      const ent = [guid, dict.timestamp, data.result];

      this.cache.store(guid, dict, null);

      // TODO: FIXME..? better way of handling sidebar refreshing...

      if (guid == store.selectedPortal) {

        renderPortalDetails(guid);
      }

      /* deferred.resolve(dict); */
      runHooks('portalDetailLoaded', { guid: guid, success: success, details: dict, ent });

    } else {
      if (data && data.error == "RETRY") {
        // server asked us to try again
        // this.doRequest(guid);
      } else {
        /* deferred.reject(); */
        runHooks('portalDetailLoaded', { guid: guid, success: success });
      }
    }

  }

  doRequest(guid) {

    postAjax("getPortalDetails", { guid }).then(res => {

      console.log("portaldetails", res)

      if(res.result) {
        let results = new PortalDetails(res.result)
        console.log("results: ", results)
      }
      this.handleResponse(guid, true, res);
    }).catch(err => {
      console.log(err)
      this.handleResponse(guid, false);
    }).finally(() => {
      delete this.requestQueue[guid]
    })
  }

  request(guid) {
    if (!this.requestQueue[guid]) {

      this.doRequest(guid);
    }

  }
}

class PortalDetails {
  rawResults: RawPortalResults

  constructor(result: RawPortalResults) {

    this.rawResults = result
  }
}

interface RawPortalResults {
  result: [
    string, // "p" as portal
    string, // "E" "N" "R" faction
    number, // lat
    number, // lng
    number, // 5?
    number, // 10 ?
    number, // 8?
    string, // url
    string, // name,
    string[], // ["sc5_p"]?
    boolean,
    boolean,
    any, // null
    number, // maybe ts?
    [],
    [],
    string, // owner
    [string, string, []]
  ]
}

/*

empty:
{"result":["p","R",66482804,25714755,7,84,8,"http://lh3.googleusercontent.com/K52IcutTuTCabSG_M3C6UsWw15kyEP1C2onC0XwCRw-A5MhjqZanABaGonovRQHhfSG-Q_SVOQlmvcNZ1KAjxBn-uA","Pajaojanpuiston Leikkipuisto",[],false,false,null,1629706215831,[["Rans4cker","Force Amp","RARE",{"FORCE_AMPLIFIER":"2000","REMOVAL_STICKINESS":"0"}],["Rans4cker","Turret","RARE",{"HIT_BONUS":"200000","ATTACK_FREQUENCY":"1500","REMOVAL_STICKINESS":"200000"}],null,null],[["pecu67",7,4250],["pecu67",8,5100],["Rans4cker",8,4941],["Rans4cker",7,4250],["Rans4cker",7,4250],["Rans4cker",6,3400],["Rans4cker",6,3400],["pecu67",7,4250]],"Rans4cker",["","",[]]]}

{"result":["p","N",66480594,25722603,1,0,0,"http://lh3.googleusercontent.com/75-Z8u0a3vlIqhkyZHuNdCXjliMPCbt1ao3ei-_VgmeZgpwI2rCIi9ffOCHnuqiE0rRG64K-0qEtCFRIv_d3Sd3Lfg","Lapin AMK Gazebo",[],false,false,null,1629646009606,[null,null,null,null],[],"",["","",[]]]}

{"result":["p","E",66379605,26643888,5,70,8,"http://lh3.googleusercontent.com/4UbXxO_rw0fJcoml4xn7F75UxoBIfuGEPnYFx7nYGnsrUoRm-MeYgnSZcItjb4gESHBJg5MnLhoz_3dgn7pINMM5T41j","Puurosen laavu",["sc5_p"],false,false,null,1629627423704,[["MastrOfDisastr","Heat Sink","RARE",{"HACK_SPEED":"500000","REMOVAL_STICKINESS":"0"}],null,null,null],[["MastrOfDisastr",7,3500],["MastrOfDisastr",7,3500],["MastrOfDisastr",6,2800],["MastrOfDisastr",5,2100],["MastrOfDisastr",8,4200],["MastrOfDisastr",1,700],["MastrOfDisastr",5,2100],["MastrOfDisastr",6,2800]],"MastrOfDisastr",["","",[]]]}
{
  "result":[
    "p",
    "E",
    66469301,
    25786514,
    5,
    10,
    8,
    "http://lh3.googleusercontent.com/3msxwGYvWyE9p-YXcyQe0AAhisPIMlsGQUd0SbLHptSIskVZ9Khh-HRMZhqxxkepzyK6lW7ZV-2dXNlhbx09U_bcoCQ",
    "Saverikkopuiston Leikkipaikka",
    ["sc5_p"],
    false,
    false,
    null,
    1629640381399,
    [
      ["MastrOfDisastr","Portal Shield","COMMON",{"REMOVAL_STICKINESS":"0","MITIGATION":"30"}],["MastrOfDisastr","Portal Shield","COMMON",{"REMOVAL_STICKINESS":"0","MITIGATION":"30"}],null,null
    ],
    [
      ["MastrOfDisastr",6,400],
      ["MastrOfDisastr",8,600],
      ["MastrOfDisastr",7,500],
      ["MastrOfDisastr",6,400],
      ["MastrOfDisastr",5,300],
      ["MastrOfDisastr",5,300],
      ["MastrOfDisastr",1,100],
      ["MastrOfDisastr",4,250]
    ],
    "MastrOfDisastr",
    ["","",[]]
    ]
  }


*/