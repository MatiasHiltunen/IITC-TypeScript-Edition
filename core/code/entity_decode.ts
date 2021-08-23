// decode the on-network array entity format into an object format closer to that used before
// makes much more sense as an object, means that existing code didn't need to change, and it's what the
// stock intel site does internally too (the array format is only on the network)
/* import $ from "jquery"
 */
import $ from 'jquery'

export class decodeArray {
  static CORE_PORTAL_DATA_LENGTH = 4;
  static SUMMARY_PORTAL_DATA_LENGTH = 14;
  static DETAILED_PORTAL_DATA_LENGTH = decodeArray.SUMMARY_PORTAL_DATA_LENGTH + 4;
  static EXTENDED_PORTAL_DATA_LENGTH = decodeArray.DETAILED_PORTAL_DATA_LENGTH + 1;
  
  static dataLen = {
    core: [decodeArray.CORE_PORTAL_DATA_LENGTH],
    summary: [decodeArray.SUMMARY_PORTAL_DATA_LENGTH],
    detailed: [decodeArray.EXTENDED_PORTAL_DATA_LENGTH, decodeArray.DETAILED_PORTAL_DATA_LENGTH],
    extended: [decodeArray.EXTENDED_PORTAL_DATA_LENGTH, decodeArray.SUMMARY_PORTAL_DATA_LENGTH],
    anyknown: [decodeArray.CORE_PORTAL_DATA_LENGTH, decodeArray.SUMMARY_PORTAL_DATA_LENGTH, decodeArray.DETAILED_PORTAL_DATA_LENGTH, decodeArray.EXTENDED_PORTAL_DATA_LENGTH]
  };

  static parseMod(arr) {
    if (!arr) { return null; }
    return {
      owner: arr[0],
      name: arr[1],
      rarity: arr[2],
      stats: arr[3],
    };
  }
  static parseResonator(arr) {
    if (!arr) { return null; }
    return {
      owner: arr[0],
      level: arr[1],
      energy: arr[2],
    };
  }
  static parseArtifactBrief(arr) {
    if (!arr) { return null; }

    // array index 0 is for fragments at the portal. index 1 is for target portals
    // each of those is two dimensional - not sure why. part of this is to allow for multiple types of artifacts,
    // with their own targets, active at once - but one level for the array is enough for that

    // making a guess - first level is for different artifact types, second index would allow for
    // extra data for that artifact type

    const decodeArtifactArray = (arr) => {
      let result = {};
      for (let i = 0; i < arr.length; i++) {
        // we'll use the type as the key - and store any additional array values as the value
        // that will be an empty array for now, so only object keys are useful data
        result[arr[i][0]] = arr[i].slice(1);
      }
      return result;
    }

    return {
      fragment: decodeArtifactArray(arr[0]),
      target: decodeArtifactArray(arr[1]),
    };
  }

  static parseArtifactDetail(arr) {
    if (!arr) { return null; }
    // empty artifact data is pointless - ignore it
    if (arr.length === 3 && arr[0] === '' && arr[1] === '' && arr[2].length === 0) {
      return null;
    }
    return {
      type: arr[0],
      displayName: arr[1],
      fragments: arr[2],
    };
  }

  static parseHistoryDetail(bitarray) {
    return {
      _raw: bitarray,
      visited: !!(bitarray & 1),
      captured: !!(bitarray & 2),
      scoutControlled: !!(bitarray & 4),
    };
  }


  //there's also a 'placeholder' portal - generated from the data in links/fields. only has team/lat/lng

 

  static corePortalData(a) {
    return {
      // a[0] == type (always 'p')
      team: a[1],
      latE6: a[2],
      lngE6: a[3]
    }
  }



  static summaryPortalData(a) {
    return {
      level: a[4],
      health: a[5],
      resCount: a[6],
      image: a[7],
      title: a[8],
      ornaments: a[9],
      mission: a[10],
      mission50plus: a[11],
      artifactBrief: this.parseArtifactBrief(a[12]),
      timestamp: a[13]
    };
  }

  static detailsPortalData(a) {
    return {
      mods: a[this.SUMMARY_PORTAL_DATA_LENGTH + 0].map(this.parseMod),
      resonators: a[this.SUMMARY_PORTAL_DATA_LENGTH + 1].map(this.parseResonator),
      owner: a[this.SUMMARY_PORTAL_DATA_LENGTH + 2],
      artifactDetail: this.parseArtifactDetail(a[this.SUMMARY_PORTAL_DATA_LENGTH + 3])
    }
  }

  static extendedPortalData(a) {
    return {
      history: this.parseHistoryDetail(a[this.DETAILED_PORTAL_DATA_LENGTH] || 0),
    }
  }


  static portal = function (a, details) {
    if (!a) {
      console.warn('Argument not specified');
      return;
    }

    if (a[0] !== 'p') {
      throw new Error('decodeArray.portal: not a portal');
    }

    details = details || 'anyknown';
    
    let expected = decodeArray.dataLen[details];
    if (expected.indexOf(a.length) === -1) {
      console.warn('Unexpected portal data length: ' + a.length + ' (' + details + ')');
      debugger;
    }

    let data = this.corePortalData(a);

    if (a.length >= this.SUMMARY_PORTAL_DATA_LENGTH) {
      data = { ...data, ...this.summaryPortalData(a) }
    }

    if (a.length >= this.DETAILED_PORTAL_DATA_LENGTH) {
      if (a[this.SUMMARY_PORTAL_DATA_LENGTH]) {
        data = { ...data, ...this.detailsPortalData(a) }
      } else if (details === 'detailed') {
        console.warn('Portal details missing');
        debugger;
      }
    }

    if (a.length >= this.EXTENDED_PORTAL_DATA_LENGTH || details === 'extended' || details === 'detailed') {
      $.extend(data, this.extendedPortalData(a));
  
    
      if (data.history && data.history.captured && !data.history.visited) {

        console.warn('Inconsistent history data found in portal "' + data.title + '"');
      }
    }

    return data;
  };

  static portalSummary = function (a) { // deprecated!!
    return decodeArray.portal(a, 'summary');
  };

  static portalDetail = function (a) { // deprecated!!
    return decodeArray.portal(a, 'detailed');
  };

}