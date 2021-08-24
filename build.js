import { buildMonkeyScript, outDir, userScriptPath } from './monkeyBuild.js'
import { build, serve, buildSync } from 'esbuild'
import { readdirSync, rmSync } from 'fs'

const isServe = process.argv.includes("serve");
const buildConfig = {
    entryPoints: ['./core/total-conversion-build.ts'],
    bundle: true,
    minify: true,
    sourcemap: false,
    target: 'es6',
    loader: { '.png': 'dataurl' },
    outdir: outDir,
}

const stylesPath = "./core/style/"


// Dirty workaround to make esbuild to add css as string to a build instead of bundling it to its own file
// In the future css files could be served to iitc from the static hosting and this can be removed
readdirSync(stylesPath)
    .filter(a => a.includes("css"))
    .forEach(cssFile => {
        buildSync({
            entryPoints: [stylesPath + cssFile],
            bundle: true,
            outfile: stylesPath + cssFile.replace('css', 'txt'),
            write: true,
            minify: true
        })
    })

build(buildConfig).then(() => {
    buildMonkeyScript()
}).catch(err => {
    console.log(err)
}).finally(() => {

    // Clean the temporary css txt files from the folder
    readdirSync(stylesPath)
        .filter(a => a.includes("txt"))
        .forEach(cssTextFile => rmSync(stylesPath + cssTextFile))

    if (isServe) {
        serve({
            servedir: outDir,
            port: 8080,
            host: "localhost",
        }, {}).then((server) => {

            let { host, port } = server;

            console.log(
                `install IITC userscript: http://${host}:${port}/${userScriptPath}`
            );
        });
    }
})