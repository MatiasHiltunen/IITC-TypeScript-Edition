import { LatLng } from "leaflet";
import { Entities, EntityData, Field } from "../interfaces/enity";

export const parseEntitydata = (data: Entities[], entityData: EntityData) => {
    let fakedLink = new RegExp("^[0-9a-f]{32}\.b_[ab][bc]$"); //field GUIDs always end with ".b" - faked links append the edge identifier

    return data.reduce((a: EntityData, c: Entities) => {
        let map = c?.result?.map

        for (let k in map) {

            if (map[k].error != null) {
           
                a.error.push(k)
                return a
            }
            if (map[k].gameEntities == null) throw 'Game entities should not be null here.'
            for (let entity of map[k].gameEntities) {

                if (fakedLink.test(entity[0])) continue
                if (entity[2][0] === 'e') {
                    const link: [LatLng, LatLng] = [
                        new LatLng(entity[2][3] / 1E6, entity[2][4] / 1E6),
                        new LatLng(entity[2][6] / 1E6, entity[2][7] / 1E6),
                    ]

                    if (entity[2][1] === 'E') {
                        a.enl.links.push(link)
                    }
                    if (entity[2][1] === 'R') {
                        a.res.links.push(link)
                    }
                }

                if (entity[2][0] === 'r') {
                    const field: [LatLng, LatLng, LatLng] = [
                        new LatLng((entity as Field)[2][2][0][1] / 1E6, (entity as Field)[2][2][0][2] / 1E6),
                        new LatLng((entity as Field)[2][2][1][1] / 1E6, (entity as Field)[2][2][1][2] / 1E6),
                        new LatLng((entity as Field)[2][2][2][1] / 1E6, (entity as Field)[2][2][2][2] / 1E6)
                    ]
                    if (entity[2][1] === 'E') {
                        a.enl.fields.push(field)
                    }
                    if (entity[2][1] === 'R') {
                        a.res.fields.push(field)
                    }
                }
            }

        }
        return a

    }, entityData)
}