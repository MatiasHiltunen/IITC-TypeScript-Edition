import { store } from './store'
import { dialog } from "./dialog";
import { requests } from "./request_handling";
import { readCookie } from "./utils_misc";


// TODO: Replace the callbacks with modern async programming
export const postAjax = async(action, data, /* successCallback?, errorCallback? */) => {
    
    let requestId:number = Math.floor((Math.random()*1E10));
    // console.log("POST: ", action, data, store.niantic_params.CURRENT_VERSION)
    
    if (store.latestFailedRequestTime && store.latestFailedRequestTime < Date.now() - 120 * 1000) {
        // no errors in the last two minutes - clear the error count
        requests.failedRequestCount = 0;
        store.latestFailedRequestTime = undefined;
    }
    
    // we set this flag when we want to block all requests due to having an out of date CURRENT_VERSION
    if (store.blockOutOfDateRequests) {
        requests.failedRequestCount++;
        store.latestFailedRequestTime = Date.now();
        
        /*   // call the error callback, if one exists
        if (errorCallback) {
            // NOTE: error called on a setTimeout - as it won't be expected to be synchronous
            // ensures no recursion issues if the error handler immediately resends the request
            setTimeout(function() { errorCallback(null, undefined, "window.blockOutOfDateRequests is set"); }, 10);
        } */
        return;
    }
    
    requests.add(requestId)
    data.v = store.niantic_params.CURRENT_VERSION;

    try {

        const response = await fetch('/r/' + action, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'X-CSRFToken': readCookie('csrftoken')
            },
            body: JSON.stringify(data)
        })
        
        if(response.status > 300){
            throw new Error("Request failed with statuscode: " + response.status);
        }

        let result = await response.json();
  
        result.action = action; // What purpose this is for?
        return result

    } catch (err) {
        
        console.warn("request failed with error: ", err)
        requests.failedRequestCount++;
        store.latestFailedRequestTime = Date.now();
      
    } finally {
        requests.remove(requestId)
    }
}


export const outOfDateUserPrompt = function() {
    // we block all requests while the dialog is open. 
    if (!store.blockOutOfDateRequests) {
        store.blockOutOfDateRequests = true;

        dialog({
            title: 'Reload IITC',
            html: '<p>IITC is using an outdated version code. This will happen when Niantic updates the standard intel site.</p>' +
                '<p>You need to reload the page to get the updated changes.</p>' +
                '<p>If you have just reloaded the page, then an old version of the standard site script is cached somewhere.' +
                'In this case, try clearing your cache, or waiting 15-30 minutes for the stale data to expire.</p>',
            buttons: {
                'RELOAD': function() {
                    // @ts-ignore
                    if (typeof android !== 'undefined' && android && android.reloadIITC) {
                    // @ts-ignore
                        android.reloadIITC();
                    } else {
                        window.location.reload();
                    }
                }
            },
            close: function(event, ui) {
                delete store.blockOutOfDateRequests;
            }

        });


    }

}