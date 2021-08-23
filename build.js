const fs = require('fs')

const monkeyHeader = `// ==UserScript==
// @author         Matias Hiltunen
// @name           IITC: Ingress intel map total conversion - TypeScript Edition
// @version        0.0.1
// @description    Total conversion for the ingress intel map.
// @run-at         document-end
// @id             total-conversion-build
// @namespace      https://github.com/IITC-CE/ingress-intel-total-conversion
// @updateURL      https://iitc.app/build/release/total-conversion-build.meta.js
// @downloadURL    https://iitc.app/build/release/total-conversion-build.user.js
// @match          https://intel.ingress.com/*
// @grant          none
// ==/UserScript==

function wrapper(plugin_info) {
// ensure plugin framework is there, even if iitc is not yet loaded

if (typeof window.plugin !== 'function') window.plugin = function() {};

//PLUGIN AUTHORS: writing a plugin outside of the IITC build environment? if so, delete these lines!!
//(leaving them in place might break the 'About IITC' page or break update checks)
plugin_info.buildName = 'release';
plugin_info.dateTimeVersion = '2021-07-16-195801';
plugin_info.pluginId = 'total-conversion-build';
//END PLUGIN AUTHORS NOTE

window.script_info = plugin_info;
`

const monkeyBottom = `
} // wrapper end
// inject code into site context
var script = document.createElement('script');
var info = {};
if (typeof GM_info !== 'undefined' && GM_info && GM_info.script) info.script = { version: GM_info.script.version, name: GM_info.script.name, description: GM_info.script.description };
script.appendChild(document.createTextNode('(' + wrapper + ')(' + JSON.stringify(info) + ');'));
(document.body || document.head || document.documentElement).appendChild(script);`

require('esbuild').build({
        entryPoints: [
            // './core/code/boot.ts',
            './core/total-conversion-build.ts'
        ],
        bundle: true,
        minify: true,
        sourcemap: false,
        target: 'es6',
        loader: { '.png': 'dataurl' },
        // outfile: './core/code/boot.js',
        outfile: './core/total-conversion-build.js'
    }).then((_) => {
        let fileContent = monkeyHeader + fs.readFileSync('./core/total-conversion-build.js', 'utf-8') + monkeyBottom

        fs.writeFileSync('./core/total-conversion-build.js', fileContent)
    })
    .catch(() => process.exit(1))