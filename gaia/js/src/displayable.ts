import { separate_by } from "./utilities"
import { el, set_el_attributes } from "./el"
import { rReactive, reactive, rwReactive } from "./reactive"

export interface Displayable<Options> {
  get_display: (options: Options) => HTMLElement
}

export const sp = '\xa0'

export const reactive_label = <T>(text: rReactive<string>): Displayable<T> => ({
  get_display: () => {
    const display = el('div', {}, text.get())
    text.watch((text) => {
      display.innerHTML = ''
      display.append(text)
    })()
    return display
  }
})
// {
//   const display = el('div', {}, text.get())
//   text.watch((text) => {
//     display.innerHTML = ''
//     display.append(text)
//   })()
//   return { get_display: () => display }
// }

export const reactive_nn = <T>(num: rwReactive<number>): Displayable<T> => ({
  get_display: () => {
    const index_el = el('input', { type: 'number', min: '0', value: num.get().toString(), max: '1000' }) as HTMLInputElement
    num.watch((n) => {
      index_el.value = n.toString()
    })
    index_el.addEventListener('change', () => {
      if (index_el.value === '')
        index_el.value = '0'
      let v = parseInt(index_el.value)
      if (v < 0) {
        index_el.value = '0'
        v = 0
      }
      num.set(v)
    })
    return index_el
  }
})

export const right_justify = <T>(d: Displayable<T>): Displayable<T> => ({
  get_display: (opts) => {
    const del = d.get_display(opts)
    del.style.marginLeft = 'auto'
    return del
  }
})

export const bottom_justify = <T>(d: Displayable<T>): Displayable<T> => ({
  get_display: (opts) => {
    const del = d.get_display(opts)
    del.style.marginTop = 'auto'
    return del
  }
})

// sets the css flex property to the given value.
export const flex = <T>(v: string, d: Displayable<T>): Displayable<T> => ({
  get_display: (opts) => {
    const del = d.get_display(opts)
    del.style.flex = v
    return del
  }
})

// kind of a gross interface but it works and I need it!
type FlexDirection = 'row' | 'row-reverse' | 'column' | 'column-reverse'

export const flex_direction = <T>(dir: FlexDirection, d: Displayable<T>): Displayable<T> => ({
  get_display: (opts) => {
    const del = d.get_display(opts)
    del.style.flexDirection = ''
    return del
  }
})

export const large_op = <T>(d: string | Displayable<T>): Displayable<T> => {
  // this doesn't work but I want it to!
  return { get_display: (opts) => el('mo', { largop: 'true' }, typeof d === 'string' ? d : d.get_display(opts)) }
  // lalalala -- lalalala -- large op's worrrlllddd.
}

export const label = <T>(text: string, attrs?: { [_: string]: string }): Displayable<T> => {
  return { get_display: () => el('div', { style: 'display: flex;', ...(attrs ?? {}) }, text) }
}

// // stands for 'spaced list'.
// export const sl = (...children: (string | Displayable)[]): Displayable => {
//   const spaced = separate_by(children, '\xa0')
//   const mapped = spaced.map((e) => typeof e === 'string' ? e : e.get_display())
//   return { get_display: () => el('div', { style: 'display: flex;' }, ...mapped) }
// }

export const add_class = <T>(c: string, d: Displayable<T>): Displayable<T> => ({
  get_display: (opts) => {
    const del = d.get_display(opts)
    del.classList.add(c)
    return del
  }
})

export const attributed = <T>(attrs: { [_: string]: string }, d: string | Displayable<T>): Displayable<T> => ({
  // PROBLEM: this will override attributes, such as the style attribute, even though that's
  // problably not what I want here!
  get_display: (opts) => {
    if (typeof d === 'string')
      return el('div', attrs, d)
    return set_el_attributes(d.get_display(opts), attrs)
  }
})

const element_from_string_or_displayable = <T>(opts: T) => (e: string | Displayable<T>): string | HTMLElement => {
  if (typeof e === 'string')
    return e
  return e.get_display(opts)
}

export const html = <T>(element: HTMLElement): Displayable<T> => ({
  get_display: () => element
})

// stands for 'spaced list'.
export const sl_inline = <T>(...children: (string | Displayable<T>)[]): Displayable<T> => ({
  get_display: (opts) => {
    const spaced = separate_by(children, '\xa0')
    const mapped = spaced.map(element_from_string_or_displayable(opts))
    return el('div', { style: 'display: inline;' }, ...mapped)
  }
})

// stands for 'spaced list'.
export const sl = <T>(...children: (string | Displayable<T>)[]): Displayable<T> => ({
  get_display: (opts) => {
    const spaced = separate_by(children, '\xa0')
    const mapped = spaced.map(element_from_string_or_displayable(opts))
    return el('div', { style: 'display: flex;' }, ...mapped)
  }
})

export const collapsable = <T>(pre: Displayable<T>, post: Displayable<T>, horizontal: rwReactive<boolean>): Displayable<T> => ({
  get_display: (opts) => {
    // will soon be set to the proper labels depending on the current value of horiztonal.
    const l = reactive('')
    const label = reactive_label(l)
    const label_el = label.get_display(opts)

    horizontal.watch((t) => {
      if (t) {
        l.set('►')
      } else {
        l.set('▼')
      }
    })()

    label_el.classList.add('expand-collapse-label')

    label_el.addEventListener('mouseover', (event) => {
      label_el.classList.add('hovered')
      event.stopPropagation()
    })

    label_el.addEventListener('mouseout', () => {
      label_el.classList.remove('hovered')
    })

    label_el.addEventListener('click', (event) => {
      horizontal.set(!horizontal.get())
      event.stopPropagation()
    })
    const e = el('div', {}, tl(pre, html(label_el)).get_display(opts), post.get_display(opts))

    horizontal.watch((t) => {
      if (t) {
        e.style.display = 'flex'
      } else {
        e.style.display = 'block'
      }
    })()

    return e
  }
})

// stands for 'vertical list'.
export const vl_block = <T>(...children: (string | Displayable<T>)[]): Displayable<T> => ({
  get_display: (opts) => {
    const mapped = children.map(element_from_string_or_displayable(opts))
    return el('div', { style: 'display: block;' }, ...mapped)
  }
})

// stands for 'vertical list'.
export const vl = <T>(...children: (string | Displayable<T>)[]): Displayable<T> => ({
  get_display: (opts) => {
    const mapped = children.map(element_from_string_or_displayable(opts))
    return el('div', { style: 'display: flex; flex-direction: column;' }, ...mapped)
  }
})

// // stands for 'tight list'.
// export const tl = (...children: (string | Displayable)[]): Displayable => {
//   const mapped = children.map((e) => typeof e === 'string' ? e : e.get_display())
//   return { get_display: () => el('div', { style: 'display: flex;' }, ...mapped) }
// }

// stands for 'tight list'.
export const tl = <T>(...children: (string | Displayable<T>)[]): Displayable<T> => ({
  get_display: (opts) => {
    const mapped = children.map((e) => typeof e === 'string' ? e : e.get_display(opts))
    return el('div', { style: 'display: flex;' }, ...mapped)
  }
})

export const reactive_text_field = <T>(id: rwReactive<string>, placeholder: string = ''): Displayable<T> => ({
  get_display: () => {
    const e = el('input', { type: 'text', placeholder }) as HTMLInputElement
    id.watch((id) => {
      e.value = id
    })()
    e.addEventListener('keyup', () => {
      id.set(e.value)
    })
    return e
  }
})

export const reactive_ml_text_field = <T>(id: rwReactive<string>): Displayable<T> => ({
  get_display: () => {
    const e = el('textarea', { type: 'text' }) as HTMLInputElement
    id.watch((id) => {
      e.value = id
    })()
    e.addEventListener('keyup', () => {
      id.set(e.value)
    })
    return e
  }
})

export const id_decl = <T>(name: rwReactive<string>): Displayable<T> => ({
  get_display: () => {
    const min_size = 2

    const dlabel = el('div', {}, name.get())
    const dinput = el('input', { type: 'text', placeholder: 'id', value: name.get(), size: min_size.toString() }) as HTMLInputElement
    const display = el('div', { class: 'bound-variable' })

    const rstate = reactive<'input' | 'display'>('display')
    rstate.watch((state) => {
      if (state === 'input') {
        display.innerHTML = ''
        display.appendChild(dinput)
      } else if (state === 'display') {
        if (name.get().trim().length === 0) {
          // dangerous!  normally shouldn't do this but I'm certain it won't result in a loop.
          rstate.set('input')
          return
        }
        display.innerHTML = '';
        display.append(dlabel)
      }
    })

    name.watch((name) => {
      if (name.trim().length > 0) {
        dlabel.innerText = name
        dinput.value = name
        rstate.set('display')
      } else {
        rstate.set('input')
      }
      if (dinput.value.length > min_size)
        dinput.size = dinput.value.length
      else
        dinput.size = min_size
    })

    display.addEventListener('mouseover', (event) => {
      display.classList.add('hovered')
      event.stopPropagation()
    })

    display.addEventListener('mouseout', () => {
      display.classList.remove('hovered')
    })

    display.addEventListener('click', (event) => {
      if (rstate.get() === 'display') {
        rstate.set('input')
        dinput.focus()
      }
      event.stopPropagation()
    })

    dinput.addEventListener('keyup', (event) => {
      if (event.key === 'Enter') {
        name.set(dinput.value)
      }
    })

    dinput.addEventListener('blur', () => {
      name.set(dinput.value)
    })

    dinput.addEventListener('input', () => {
      if (dinput.value.length >= 1)
        dinput.size = dinput.value.length
      dlabel.innerText = dinput.value
    })

    name.set(name.get())  // dumb line just to get things updating (I think I'm doing reactivity wrong).

    return display
  }
})
// {
//   const min_size = 2

//   const dlabel = el('div', {}, name.get())
//   const dinput = el('input', { type: 'text', placeholder: 'id', value: name.get(), size: min_size.toString() }) as HTMLInputElement
//   const display = el('div', { class: 'bound-variable' })

//   const rstate = reactive<'input' | 'display'>('display')
//   rstate.watch((state) => {
//     if (state === 'input') {
//       display.innerHTML = ''
//       display.appendChild(dinput)
//     } else if (state === 'display') {
//       if (name.get().trim().length === 0) {
//         // dangerous!  normally shouldn't do this but I'm certain it won't result in a loop.
//         rstate.set('input')
//         return
//       }
//       display.innerHTML = '';
//       display.append(dlabel)
//     }
//   })

//   name.watch((name) => {
//     if (name.trim().length > 0) {
//       dlabel.innerText = name
//       dinput.value = name
//       rstate.set('display')
//     } else {
//       rstate.set('input')
//     }
//     if (dinput.value.length > min_size)
//       dinput.size = dinput.value.length
//     else
//       dinput.size = min_size
//   })

//   display.addEventListener('mouseover', (event) => {
//     display.classList.add('hovered')
//     event.stopPropagation()
//   })

//   display.addEventListener('mouseout', () => {
//     display.classList.remove('hovered')
//   })

//   display.addEventListener('click', (event) => {
//     if (rstate.get() === 'display') {
//       rstate.set('input')
//       dinput.focus()
//     }
//     event.stopPropagation()
//   })

//   dinput.addEventListener('keyup', (event) => {
//     if (event.key === 'Enter') {
//       name.set(dinput.value)
//     }
//   })

//   dinput.addEventListener('blur', () => {
//     name.set(dinput.value)
//   })

//   dinput.addEventListener('input', () => {
//     if (dinput.value.length >= 1)
//       dinput.size = dinput.value.length
//     dlabel.innerText = dinput.value
//   })

//   name.set(name.get())  // dumb line just to get things updating (I think I'm doing reactivity wrong).

//   return { get_display: () => display }
// }

export const reactive_wrap = <T>(should_wrap: rReactive<boolean>, display: Displayable<T>): Displayable<T> => ({
  get_display: (opts) => {
    const d = el('div', { style: 'display: flex;' })
    const child_d = display.get_display(opts)
    should_wrap.watch((should_wrap) => {
      d.innerHTML = ''
      if (should_wrap) {
        d.append('(')
        d.appendChild(child_d)
        d.append(')')
      } else {
        d.appendChild(child_d)
      }
    })()
    return d
  }
})
// {
//   const d = el('div', { style: 'display: flex;' })
//   const child_d = display.get_display()
//   should_wrap.watch((should_wrap) => {
//     d.innerHTML = ''
//     if (should_wrap) {
//       d.append('(')
//       d.appendChild(child_d)
//       d.append(')')
//     } else {
//       d.appendChild(child_d)
//     }
//   })()
//   return {
//     get_display: () => d
//   }
// }

export const displ = <T>(get_display: (opts: T) => HTMLElement): Displayable<T> => ({ get_display })
