// DEBUGGING TOOLS ///////////////////////////////////////////////////
// meant to be used from browser debugger tools and the like.


import { store } from './store'
import $ from 'jquery'
import L from 'leaflet';

export class Debug {
    log: Console;

    constructor() {
        this.log = new Console()
    }

    renderDetails = function() {
  
        this.log.log('portals: ' + Object.keys(store.portals).length);
     
        this.log.log('links:   ' + Object.keys(store.links).length);

        this.log.log('fields:  ' + Object.keys(store.fields).length);
    }

    printStackTrace = function() {
        let e = new Error('dummy');
        this.log.error(e.stack);
        return e.stack;
    }
}


class Console {
    constructor() {
        $('#debugconsole').text();
    }

    show = function() {
        $('#chat, #chatinput').show();
        this.create();
        $('#chatinput mark').css('cssText', 'color: #bbb !important').text('debug:');
        $('#chat > div').hide();
        $('#debugconsole').show();
        $('#chatcontrols .active').removeClass('active');
        $("#chatcontrols a:contains('debug')").addClass('active');
    }

    create = function() {
        if ($('#debugconsole').length) return;
        $('#chatcontrols').append('<a>debug</a>');
        $('#chatcontrols a:last').click(this.show);
        $('#chat').append('<div style="display: none" id="debugconsole"><table></table></div>');
    }

    renderLine = function(text, errorType) {
        this.create();
        let color = '#eee';
        switch (errorType) {
            case 'error':
                color = '#FF424D';
                break;
            case 'warning':
                color = '#FFDE42';
                break;
           
               
        }
        if (typeof text !== 'string' && typeof text !== 'number') {
            let cache = [];
            text = JSON.stringify(text, function(_, value) {
                if (typeof value === 'object' && value !== null) {
                    if (cache.indexOf(value) !== -1) {
                        // Circular reference found, discard key
                        return;
                    }
                    // Store value in our collection
                    cache.push(value);
                }
                return value;
            });
            cache = null;
        }
        let d = new Date();
        let ta = d.toLocaleTimeString(); // print line instead maybe?
        let tb = d.toLocaleString();
        let t = '<time title="' + tb + '" data-timestamp="' + d.getTime() + '">' + ta + '</time>';
        let s = 'style="color:' + color + '"';
        let l = '<tr><td>' + t + '</td><td><mark ' + s + '>' + errorType + '</mark></td><td>' + text + '</td></tr>';
        $('#debugconsole table').prepend(l);
    }

    log(text) {
        this.renderLine(text, 'notice');
    }

    warn(text) {
        this.renderLine(text, 'warning');
    }

    error(text) {
        this.renderLine(text, 'error');
    }

    overwriteNative() {
        this.create();

        let nativeConsole = window.console;

   
        store.console = {};

        function overwrite(which) {
            store.console[which] = function() {
                nativeConsole[which].apply(nativeConsole, arguments);
                console[which].apply(console, arguments);
            }
        }

        overwrite("log");
        overwrite("warn");
        overwrite("error");
    }

    overwriteNativeIfRequired = function() {
        if (!window.console || L.Browser.mobile)
            this.overwriteNative();
    }
}