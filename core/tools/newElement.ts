interface ElementProperties {
    className?: string | string[],
    text?: string,
    id?: string,
    children?: HTMLElement[],
    element?: string,
    attributes?: object,
    value?: string,
    eventListener?: Listener | Listener[]
}

interface Listener {
    event: string,
    action(e:Event): void
}

export const E = ({ className, text, id, children, element = 'DIV', attributes, value, eventListener }: ElementProperties): HTMLElement => {
    let el: HTMLElement = document.createElement(element)
    if (className) className instanceof Array ? className.forEach(c => el.classList.add(c)) : el.classList.add(className)
    if (text) el.innerText = text
    if (id) el.id = id
    if (children) el.append(...children)
    if (attributes) for (let k in attributes) el.setAttribute(k, attributes[k])
    if (value) (el as HTMLInputElement).value = value;
    if (eventListener) eventListener instanceof Array ? eventListener.forEach(e => el.addEventListener(e.event, e.action)) : el.addEventListener(eventListener.event, eventListener.action)
    return el
}