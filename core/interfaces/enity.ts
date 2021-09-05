import { LatLng } from "leaflet";

export interface Entities {
    result?: {
        map?: {
            [dynamic: string]: {
                gameEntities?: [(Link | Field)],
                error?: string
            }

        }
    },
    action: string
}



export type Link = [
    string,
    number,
    [
        string,
        string,
        string,
        number,
        number,
        String,
        number,
        number
    ]
];

export type Field = [
    string,
    number,
    [
        string,
        string,
        [
            [string, number, number],
            [string, number, number],
            [string, number, number],
        ],
    ],
]

export interface EntityData {
    res: {
        portals: [],
        links: [LatLng, LatLng][],
        fields: [LatLng, LatLng, LatLng][],

    },
    enl: {
        portals: [],
        links: [LatLng, LatLng][],
        fields: [LatLng, LatLng, LatLng][],
    },
    none: {
        portals: []
    },
    error: string[]
}

export interface ZoomTileParameters {
    level: number,
    tilesPerEdge: number,
    minLinkLength: number,
    hasPortals: boolean,
    zoom: number
}
