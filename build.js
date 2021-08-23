import { rmSync, readFileSync, readdirSync, writeFileSync } from 'fs'
import { buildSync, serve } from 'esbuild'

const outfile = 'total-conversion-build.js'
const userScriptPath = "total-conversion-build.user.js"
const userMetaPath = "total-conversion-build.meta.js"
const author = "Matias Hiltunen"
const version = "0.0.1"
const updateUrl = "http://127.0.0.1:8080/" + userMetaPath
const downloadUrl = "http://127.0.0.1:8080/" + userScriptPath

const isServe = process.argv.includes("serve");

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

    const fileContent = monkeyHeader + readFileSync(transpiledTsFile, 'utf-8') + monkeyBottom

    if (readdirSync(buildConfig.outdir).includes(userScriptPath)) rmSync(buildConfig.outdir + '/' + userScriptPath)
    writeFileSync(buildConfig.outdir + '/' + userScriptPath, fileContent)

    if (readdirSync(buildConfig.outdir).includes(userMetaPath)) rmSync(buildConfig.outdir + '/' + userMetaPath)
    writeFileSync(buildConfig.outdir + '/' + userMetaPath, monkeyMeta)
}

buildSync(buildConfig)
buildMonkeyScript()

if (isServe) {
    serve({
        servedir: buildConfig.outdir,
        port: 8080,
        host: "localhost",
    }, {}).then((server) => {

        let { host, port } = server;

        console.log(
            `install IITC userscript: http://${host}:${port}/${userScriptPath}`
        );
    });
}