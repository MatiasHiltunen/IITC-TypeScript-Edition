import { E } from "../tools/newElement";

export const chatInput = E({
    id: 'chatinput',
    element: 'form',
    attributes: {
        style: "display:none"
    },
    children: [
        E({
            element: 'table',
            children: [
                E({ element: 'td', children: [E({ element: 'time' })] }),
                E({ element: 'td', children: [E({ element: 'mark', text: 'tell faction:' })] }),
                E({
                    element: 'td',
                    children: [
                        E({
                            element: 'input',
                            id: 'chattext',
                            attributes: {
                                type: 'text',
                                maxlength: '256',
                                accesskey: 'c',
                                title: '[c]'
                            }
                        })
                    ]
                }),

            ]
        })
    ]
})