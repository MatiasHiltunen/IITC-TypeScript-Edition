
import { latToTile, lngToTile } from "../code/map_data_calc_tools";
import { readCookie } from "../code/utils_misc";
import { Entities, ZoomTileParameters } from "../interfaces/enity";
import { NianticParams } from "./extract";

export enum FetchActions { getEntities = 'getEntities' }

export interface FetchEntities {
    tileKeys: string[]
    v: string,
}


export const fetchData = async (data:FetchEntities, action: FetchActions, token: string) => {

    
   
    try {

        const response = await fetch('/r/' + action.toString(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'X-CSRFToken': readCookie('csrftoken')
            },
            body: JSON.stringify(data)
        })

        if (response.status > 300) {
            throw new Error("Request failed with statuscode: " + response.status);
        }

        return await response.json();

    } catch (err) {

        console.warn("request failed with error: ", err)
  
    } 
}

export const makeRequests = async (tileParams: ZoomTileParameters, bounds: L.LatLngBounds, token: string, version: string, ): Promise<Entities[]>  =>  {

    let x1 = lngToTile(bounds.getWest(), tileParams);

    let x2 = lngToTile(bounds.getEast(), tileParams);

    let y1 = latToTile(bounds.getNorth(), tileParams);

    let y2 = latToTile(bounds.getSouth(), tileParams);


    let tileIds = []
    let results = []
    // y goes from left to right
    for (let y = y1; y <= y2; y++) {
        // x goes from bottom to top(?)
        for (let x = x1; x <= x2; x++) {
            tileIds.push(`${tileParams.zoom}_${x}_${y}_${tileParams.level}_8_100`)
            if (tileIds.length >= 24) {
                results.push(fetchData({
                    v: version,
                    tileKeys: tileIds
                },
                    FetchActions.getEntities,
                    token))
                tileIds = [];
            }
        }
    }
    if (tileIds.length > 0) {
        results.push(fetchData({
            v: version,
            tileKeys: tileIds
        },
            FetchActions.getEntities,
            token))

    }
    return Promise.all(results)
}