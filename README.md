Ingress intel map total conversion - TypeScript Edition (IITC-TS)
=================================================================

Goal of this project is to bring the IITC code to modern development environmet by using TypeScript and esbuild as bundler for the monkeyScripts(TamperMonkey, GreaseMonkey).

As a result many of the existing bugs, vulnerabilities, silly development decisions, performance issues... etc. from the past will be fixed.

IITC-TS will not be designed to support existing plugins, rather the plugins can be made to support IITC-TS.

#Project is at very early stages and userscript is no where near to usable yet.

As the project is at very early stages, no proper build/testing flow has been made.
If you want to build and try out the userScript anyway then follow the steps ahead:

Use this script at your own risk, your account may be banned by Niantic by using this.

Clone the project and run in the project folder:

Install dependencies
>npm install

Serve installable userscript on localhost:
>npm run serve

Build userscript files without serving
>npm run build

