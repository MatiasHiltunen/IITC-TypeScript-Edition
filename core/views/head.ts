import { E } from "../tools/newElement";

// Import css files with txt file extension, check the build script for more details
// ts-ignore is required here as the esbuild does the injection in the build time.

// @ts-ignore
import cssStyles from '../style/style.txt'
// @ts-ignore
import leafletStyles from '../style/leaflet.txt'
// @ts-ignore
import loginStyle from '../style/login.txt';

export const head = E({
    element: 'head', children: [
        E({ element: 'title', text: 'Ingress Intel Map - TS' }),
        E({ element: 'style', text: cssStyles }),
        E({ element: 'style', text: leafletStyles }),
        E({
            element: 'link', attributes: {
                rel: "stylesheet",
                type: "text/css",
                href: "//fonts.googleapis.com/css?family=Roboto:100,100italic,300,300italic,400,400italic,500,500italic,700,700italic&subset=latin,cyrillic-ext,greek-ext,greek,vietnamese,latin-ext,cyrillic"
            }
        })
    ]
})

export const loginHead = E({
    element: 'style',
    text: loginStyle,
    attributes: {type: 'text/css'}
  })