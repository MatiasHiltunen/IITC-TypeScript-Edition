import { E } from "../tools/dom_manipulation";

export const chatControls = [

    E({
        id: 'chatcontrols', attributes: { style: 'display:none;' }, children: [

            E({
                element: 'a',
                attributes: {
                    accesskey: "0",
                    title: '[0]'
                },
                children: [E({ element: "span", className: 'toggle' })]
            }),
            E({
                element: 'a',
                attributes: {
                    accesskey: "1",
                    title: '[1]'
                },
                text: 'all'
            }),
            E({
                element: 'a',
                attributes: {
                    accesskey: "2",
                    title: '[2]'
                },
                className: 'active',
                text: 'faction'
            }),
            E({
                element: 'a',
                attributes: {
                    accesskey: "3",
                    title: '[3]'
                },
                text: 'alerts'
            }),
        ]
    }),
    E({
        id: 'chat',
        attributes: { style: 'display:none' },
        children: [
            E({ id: 'chatfaction' }),
            E({ id: 'chatall' }),
            E({ id: 'chatalerts' })
        ]
    }),
]