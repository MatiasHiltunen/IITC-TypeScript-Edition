
export interface NianticParams {
    version: string
    zoomToLevel: number[]
    tilesPerEdge: number[]
    zoomLinkToLength: number[]
    token?: string
  }
  
  
 export const extractFromStock = ():NianticParams => {
  
    let data: NianticParams = {
      version: null,
      zoomToLevel: null,
      tilesPerEdge: null,
      zoomLinkToLength: [200000, 200000, 200000, 200000, 200000, 60000, 60000, 10000, 5000, 2500, 2500, 800, 300, 0, 0]
    }
    // extract the former nemesis.dashboard.config.CURRENT_VERSION from the code
    let reVersion = new RegExp('"X-CSRFToken".*[a-z].v="([a-f0-9]{40})";');
  
    let minified = new RegExp('^[a-zA-Z$][a-zA-Z$0-9]?$');
  
    for (let topLevel in window) {
      if (minified.test(topLevel)) {
        // a minified object - check for minified prototype entries
  
        let topObject = window[topLevel];
        // @ts-ignore
        if (topObject && topObject.prototype) {
  
          // the object has a prototype - iterate through the properties of that
          // @ts-ignore
          for (let secLevel in topObject.prototype) {
            if (minified.test(secLevel)) {
              // looks like we've found an object of the format "XX.prototype.YY"...
              // @ts-ignore
              let item = topObject.prototype[secLevel];
  
              if (item && typeof (item) == "function") {
                // a function - test it against the relevant regular expressions
                let funcStr = item.toString();
  
                let match = reVersion.exec(funcStr);
                if (match) {
                  // log.log('Found former CURRENT_VERSION in '+topLevel+'.prototype.'+secLevel);
  
                  data.version = match[1];
  
                  if(!data.version) throw 'Iitc is broken.'
                }
              }
            }
          }
  
        } 
  
        if (topObject && Array.isArray && Array.isArray(topObject)) {
          // find all non-zero length arrays containing just numbers
          if (topObject.length > 0) {
            let justInts = true;
            for (let i = 0; i < topObject.length; i++) {
              if (typeof (topObject[i]) !== 'number' || topObject[i] != parseInt(topObject[i])) {
                justInts = false;
                break;
              }
            }
            if (justInts) {
  
              // current lengths are: 17: ZOOM_TO_LEVEL, 14: TILES_PER_EDGE
              // however, slightly longer or shorter are a possibility in the future
  
              if (topObject.length >= 12 && topObject.length <= 18) {
                // a reasonable array length for tile parameters
                // need to find two types:
                // a. portal level limits. decreasing numbers, starting at 8
                // b. tiles per edge. increasing numbers. current max is 36000, 9000 was the previous value - 18000 is a likely possibility too
  
                if (topObject[0] == 8) {
                  // check for tile levels
                  let decreasing = true;
                  for (let i = 1; i < topObject.length; i++) {
                    if (topObject[i - 1] < topObject[i]) {
                      decreasing = false;
                      break;
                    }
                  }
                  if (decreasing) {
  
                    data.zoomToLevel = topObject;
                  }
                } // end if (topObject[0] == 8)
  
                // 2015-06-25 - changed to top value of 64000, then to 32000 - allow for them to restore it just in case
                if (topObject[topObject.length - 1] >= 9000 && topObject[topObject.length - 1] <= 64000) {
                  let increasing = true;
                  for (let i = 1; i < topObject.length; i++) {
                    if (topObject[i - 1] > topObject[i]) {
                      increasing = false;
                      break;
                    }
                  }
                  if (increasing) {
  
                    data.tilesPerEdge = topObject;
                  }
  
                } //end if (topObject[topObject.length-1] == 9000) {
  
              }
            }
          }
        }
  
  
      }
    }
    return data;
  }
  
