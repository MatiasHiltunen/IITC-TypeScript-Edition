import { E } from "../tools/dom_manipulation"
import { chatInput } from "./chatInput"
import { chatControls } from "./chatControls"
import { sidebar, sidebarToggle } from "./sidebar"

export const body = E({
    element: 'body',
    children: [
        E({ id: 'map', text: 'Loading, please wait' }),
        ...chatControls,
        chatInput,
        sidebarToggle,
        sidebar,
        E({ id: 'updatestatus', children: [E({ id: 'innerstatus' })] }),
        E({ id: 'play_button' }),
        E({ id: 'header', children: [E({ id: 'nav' })] })
    ]
})