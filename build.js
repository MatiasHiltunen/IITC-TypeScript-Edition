import fs from 'fs'
import { buildSync, serve } from 'esbuild'


const author = "Matias Hiltunen"
const version = "0.0.1"
const updateUrl = "http://127.0.0.1:8080/total-conversion-build.meta.js"
const downloadUrl = "http://127.0.0.1:8080/total-conversion-build.user.js"

const monkeyMeta = `// ==UserScript==
// @author         ${author}
// @name           IITC: Ingress intel map total conversion - TypeScript Edition
// @version        ${version}
// @description    Total conversion for the ingress intel map.
// @run-at         document-end
// @id             total-conversion-build-ts
// @namespace      https://github.com/MatiasHiltunen/IITC-TypeScript-Edition
// @updateURL      ${updateUrl}
// @downloadURL    ${downloadUrl}
// @match          https://intel.ingress.com/*
// @grant          none
// ==/UserScript==`

const monkeyHeader = `${monkeyMeta}
function wrapper(plugin_info) {
// ensure plugin framework is there, even if iitc is not yet loaded
if (typeof window.plugin !== 'function') window.plugin = function() {};
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


const outfile = 'total-conversion-build.js'
const userScriptPath = "total-conversion-build.user.js"
const userMetaPath = "total-conversion-build.meta.js"

const buildConfig = {
    entryPoints: ['./core/total-conversion-build.ts'],
    bundle: true,
    minify: true,
    sourcemap: false,
    target: 'es6',
    loader: { '.png': 'dataurl' },
    outdir: './build'
}

const buildMonkeyScript = () => {
    const transpiledTsFile = buildConfig.outdir + '/' + outfile

    let fileContent = monkeyHeader + fs.readFileSync(transpiledTsFile, 'utf-8') + monkeyBottom

    if (fs.readdirSync(buildConfig.outdir).includes(userScriptPath)) fs.rmSync(buildConfig.outdir + '/' + userScriptPath)
    fs.writeFileSync(buildConfig.outdir + '/' + userScriptPath, fileContent)

    if (fs.readdirSync(buildConfig.outdir).includes(userMetaPath)) fs.rmSync(buildConfig.outdir + '/' + userMetaPath)
    fs.writeFileSync(buildConfig.outdir + '/' + userMetaPath, monkeyMeta)
}

buildSync(buildConfig)
buildMonkeyScript()

serve({
    servedir: buildConfig.outdir,
    port: 8080,
    host: "localhost",
}, {}).then((server) => {

    let { host, port } = server;

    console.log(
        `Development server is running on http://${host}:${port}`
    );
});