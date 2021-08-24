import { aboutIITC, androidPermalink, setPermaLink } from "../code/utils_misc"
import { E } from "../tools/newElement"

export const sidebarToggle = E({
    element: 'a',
    id: 'sidebartoggle',
    attributes: {
        accesskey: "i",
        title: "Toggle sidebar [i]"
    },
    children: [E({ element: 'span', className: ['toggle', 'close'] })]
})

const searchWrapper =  E({
    id: 'searchwrapper',
    children: [
        E({
            element: 'button',
            id:'buttongeolocation',
            attributes: {
                title: "Current location"
            },
            children: [
                E({
                    element: 'img',
                    attributes: {
                        src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyRpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMC1jMDYxIDY0LjE0MDk0OSwgMjAxMC8xMi8wNy0xMDo1NzowMSAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNS4xIE1hY2ludG9zaCIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDoxNjM1OTRFNUE0RTIxMUUxODNBMUZBQ0ZFQkJDNkRBQiIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDoxNjM1OTRFNkE0RTIxMUUxODNBMUZBQ0ZFQkJDNkRBQiI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOjE2MzU5NEUzQTRFMjExRTE4M0ExRkFDRkVCQkM2REFCIiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOjE2MzU5NEU0QTRFMjExRTE4M0ExRkFDRkVCQkM2REFCIi8+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8P3hwYWNrZXQgZW5kPSJyIj8+kxvtEgAAAWVJREFUeNqsVctRwzAUlDTccQlxB3RA0kHSQXLxNXEFgQrsHO1L6AA6cKgAd4BLEBXAU2YfszY2oMCb2Rlbelqv3s+2qiozYjPBVjAX3Az2WsFJcBB0WZb1Nt0IWSF4FexGyAzWdvAp6rpOpgjDxgucg3lBKViRzz3WPN6Db8OkjsgaUvQgSAW54IkI77CWwkcVN0PCPZFtAG+mzZPfmVRUhlAZK0mZIR6qbGPi7ChY4zl1yKZ+NTfxltNttg6loep8LJuUjad4zh3F7s1cbs8ayxDD9xEH+0uiL2ed+WdjwhWU2YjzVmJoUfCfhC2eb/8g7Fr73KHRDWopiWVC22kdnhymhrZfcYG6goQcAmGHhleV64lsjlUD+5cSz85RtbfUSscfrp+Qn87Ic2KuyGlBEyd8dYkO4IJfInkc70C2QMf0CD1I95hzCc1GtcfBe7hm/l1he5p3JYVh+AsoaV727EOAAQAWgF3ledLuQAAAAABJRU5ErkJggg==',
                        alt: "Current location"
                    }
                }),
                E({
                    element: 'input',
                    id: 'search',
                    attributes: {
                        placeholder: "Search location…",
                        type: "search",
                        accesskey: "f",
                        title: "Search for a place [f]"
                    }
                })
            ]
        })
    ]
})

export const sidebar = E({
    id: 'scrollwrapper',
    children: [
        E({
            id: 'sidebar',
            attributes: {
                style: 'display: block'
            },
            children: [
                E({ id: 'playerstat', text: 't' }),
                E({ id: 'gamestat', text: '&nbsp;loading global control stats' }),
                searchWrapper,
                E({ id: 'portaldetails' }),
                E({
                    element: 'input',
                    attributes: {
                        placeholder: "Redeem code…",
                        type: "text"
                    }
                }),
                E({
                    id: "toolbox",
                    children: [
                        E({
                            element: 'a',
                            text: 'Permalink',
                            eventListener: [{
                                event: 'mouseover',
                                action(_) {
                                    console.log("mouseover permalink, what is this", this)
                                    setPermaLink(this) // what is this here?
                                }
                            }, {
                                event: 'click',
                                action(_) {
                                    console.log("click permalink, what is this", this)
                                    setPermaLink(this) // what is this here?
                                    return androidPermalink() // What the fuck does this do?
                                }
                            }],
                            attributes: { title: "URL link to this map view" }
                        }),
                        E({
                            element: 'a',
                            text: 'About IITC',
                            eventListener: {
                                event: 'click',
                                action(_) {
                                    aboutIITC()
                                }
                            },
                            attributes: { style: "cursor: help" }
                        })
                    ]
                })

            ]
        })
    ]
})