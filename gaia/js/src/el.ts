export const el = (name: string, attrs: { [_: string]: string }, ...children: (Node | string)[]) => {
  const element = set_el_attributes(document.createElement(name), attrs)
  for (const child of children) {
    if (child === undefined)
      continue
    if (typeof child === 'string')
      element.append(child)
    else
      element.appendChild(child)
  }
  return element
}

export const set_el_attributes = (element: HTMLElement, attrs: { [_: string]: string }) => {
  for (const key in attrs)
    element.setAttribute(key, attrs[key])
  return element
}
