export interface Watchable<Value> {
  forward_to: (w: wWatchable<Value>) => void
}

export interface rWatchable<Value> extends Watchable<Value> {
  watch: (f: (v: Value) => void) => void
  unwatch: (f: (v: Value) => void) => void
}

export interface wWatchable<Value> extends Watchable<Value> {
  broadcast: (v: Value) => void
}

export interface rwWatchable<Value> extends rWatchable<Value>, wWatchable<Value> {}

export const watchable = <Value>(): rwWatchable<Value> => {
  const watchers: Set<(v: Value) => void> = new Set
  const forwards: Set<wWatchable<Value>> = new Set

  const watch = (f: (v: Value) => void) => {
    watchers.add(f)
    // don't actually call anything in the closure -- just to satisfy
    // interface constraints for now.
  }

  const unwatch = (f: (v: Value) => void) => {
    watchers.delete(f)
  }

  const broadcast = (v: Value): void => {
    for (const w of watchers)
      w(v)
    for (const f of forwards)
      f.broadcast(v)
  }

  const forward_to = (w: wWatchable<Value>): void => {
    forwards.add(w)
  }

  return {
    watch,
    unwatch,
    broadcast,
    forward_to
  }
}

export interface rReactive<Value> {
  get: () => Value
  values_equal: (v1: Value, v2: Value) => boolean
  derive: <NewValue>(f: (value: Value) => NewValue, cache?: boolean) => rReactive<NewValue>
  underive: (derived: DerivedReactive<Value, unknown>) => void
  watch: (f: (value: Value) => void) => () => void
  unwatch: (watcher: () => void) => void
}

export interface wReactive<Value> {
  set: (v: Value) => void
}

export interface rwReactive<Value> extends rReactive<Value>, wReactive<Value> {}

export interface rReactiveList<Element> extends Iterable<Element> {
  // called AFTER an element is added.
  watch_add: (f: (e: Element) => void) => () => void
  // called BEFORE an element is added.
  watch_remove: (f: (e: Element, index: number) => void) => void
  // can throw exceptions!
  at: (index: number) => Element
  // returns -1 if it can't find the element in the list.
  index_of: (element: Element) => number
  find_index: (pred: (element: Element) => boolean) => number

  // like map, but keeps updates with its base.
  map_derive: <T>(f: (e: Element) => T) => rpReactiveList<T>

  map: <T>(f: (e: Element, index: number) => T) => rReactiveList<T>
  length: () => number

  print: () => void
}

export interface wReactiveList<Element> {
  add: (...elements: Element[]) => void
  remove: (index: number) => void
}

export interface rwReactiveList<Element> extends rReactiveList<Element>, wReactiveList<Element> {}

// the p stands for 'permutable'.
export interface rpReactiveList<Element> extends rReactiveList<Element> {
  watch_move: (f: (e: Element, sourcei: number, targeti: number) => void) => void
}

export interface rwpReactiveList<Element> extends rpReactiveList<Element>, rwReactiveList<Element> {
  move: (sourcei: number, targeti: number) => void
}

export const reactive_list = <Element>(initial: Element[]): rwpReactiveList<Element> => {
  const backing: Element[] = [...initial]
  const add_watchers: Set<(e: Element) => void> = new Set
  const rem_watchers: Set<(e: Element, index: number) => void> = new Set
  const mov_watchers: Set<(e: Element, si: number, ti: number) => void> = new Set

  const watch_add = (f: (e: Element) => void): (() => void) => {
    add_watchers.add(f)
    return () => {
      for (const e of backing)
        f(e)
    }
  }

  const watch_remove = (f: (e: Element, index: number) => void): void => {
    rem_watchers.add(f)
  }

  const at = (index: number): Element => {
    if (index < 0 || index >= length())
      throw new Error(`accessing reactive list of length ${length()} out of bounds at index ${index}!`)
    return backing[index]
  }

  const index_of = (element: Element): number => {
    return backing.indexOf(element)
  }

  const find_index = (pred: (element: Element) => boolean): number => {
    return backing.findIndex(pred)
  }

  const map = <T>(f: (e: Element, index: number) => T): rReactiveList<T> => {
    return reactive_list(backing.map(f))
  }

  const length = (): number => backing.length

  const add = (...elements: Element[]): void => {
    backing.push(...elements)
    for (const e of elements)
      for (const w of add_watchers)
        w(e)
  }

  const remove = (index: number): void => {
    const e = at(index)
    backing.splice(index, 1)
    for (const w of rem_watchers)
      w(e, index)
  }

  const move = (sourcei: number, targeti: number): void => {
    if (sourcei < 0 || sourcei >= backing.length)
      throw new Error(`source index ${sourcei} when moving list element is out of bounds [0, ${backing.length})!`)
    if (targeti < 0 || targeti > backing.length)
      throw new Error(`target index ${targeti} when moving list element is out of bounds [0, ${backing.length}]!`)

    const e = backing[sourcei]

    // imma try notifying watchers before moving -- my brain expects sourcei and targeti to point
    // at the element that moved and the element the source moved, respectively.  this stops being
    // the case after the moves are made which is lame.
    for (const w of mov_watchers)
      w(e, sourcei, targeti)
    
    // make the moves.
    backing.splice(sourcei, 1)
    backing.splice(targeti, 0, e)
  }

  const watch_move = (f: (e: Element, si: number, ti: number) => void): void => {
    mov_watchers.add(f)
  }

  const map_derive = <T>(f: (e: Element) => T): rwpReactiveList<T> => {
    const t_list = reactive_list(backing.map(f))

    watch_add((e) => {
      t_list.add(f(e))
    })
    watch_remove((_, i) => {
      t_list.remove(i)
    })
    watch_move((_, si, ti) => {
      t_list.move(si, ti)
    })

    t_list.watch_add((_) => {
    })

    return t_list
  }

  return {
    move,
    watch_move,
    watch_add,
    watch_remove,
    at,
    index_of,
    find_index,
    map,
    map_derive,
    length,
    // [Symbol.iterator]: backing[Symbol.iterator],
    [Symbol.iterator](): Iterator<Element> {
      let current_index = 0
      const r: Iterator<Element> = {
        next(): IteratorResult<Element, any> {
          if (current_index >= backing.length)
            return { done: true, value: undefined }
          return { done: false, value: backing[current_index++] }
        }
      }
      return r
    },
    add,
    remove,
    print: () => console.log('list', ...backing)
  }
}

const simple_eq = <T>(t1: T, t2: T): boolean => t1 === t2

export class DerivedReactive<From, Value> implements rReactive<Value> {
  private cached_io?: { input: From, output: Value }
  private watchers: Set<() => void> = new Set
  private derived: Set<DerivedReactive<Value, unknown>> = new Set

  constructor(
    private readonly from: rReactive<From>,
    private readonly f: (v: From) => Value,
    private eq = simple_eq,
    private readonly should_cache = true
  ) {}

  get(): Value {
    const from_value = this.from.get()
    if (!this.should_cache)
      return this.f(from_value)
    if (this.cached_io === undefined || !this.from.values_equal(from_value, this.cached_io.input))
      this.cached_io = { input: from_value, output: this.f(from_value) }
    return this.cached_io.output
  }

  values_equal(v1: Value, v2: Value): boolean {
    return this.eq(v1, v2)
  }

  derive<NewValue>(f: (value: Value) => NewValue, cache: boolean = true): rReactive<NewValue> {
    const d = new DerivedReactive(this, f, simple_eq, cache)
    this.derived.add(d)
    return d
  }

  underive(derived: DerivedReactive<Value, unknown>): void {
    this.derived.delete(derived)
  }

  watch(f: (value: Value) => void): () => void {
    // question: should watchers of derived values wait to be called until after the watchers
    //           of the base values are all called?
    // answer: I think so.
    // cons: it's not immediately obvious how I would accomplish this.
    // pros: this vibes with my own intuition -- the things most directly dependent on a reactive
    //       value should update before the less direct dependents.
    const w = () => f(this.get())
    this.watchers.add(w)
    return w
  }

  unwatch(watcher: () => void): void {
    this.watchers.delete(watcher)
  }

  // although this is public, it shouldn't be called by anyone but the base!
  public notify_watchers(): void {
    for (const w of this.watchers)
      w()
    for (const d of this.derived)
      d.notify_watchers()
  }
}

export class BaseReactive<Value> implements rwReactive<Value> {
  private watchers: Set<() => void> = new Set
  private derived: Set<DerivedReactive<Value, unknown>> = new Set

  constructor(private value: Value, private eq: (v1: Value, v2: Value) => boolean = simple_eq) {}

  set(v: Value): void {
    this.value = v
    this.notify_watchers()
  }

  get(): Value { return this.value }

  values_equal(v1: Value, v2: Value): boolean { return this.eq(v1, v2) }

  derive<NewValue>(f: (value: Value) => NewValue): rReactive<NewValue> {
    const d = new DerivedReactive(this, f)
    this.derived.add(d)
    return d
  }

  underive(derived: DerivedReactive<Value, unknown>): void {
    this.derived.delete(derived)
  }

  watch(f: (value: Value) => void): () => void {
    const w = () => f(this.get())
    this.watchers.add(w)
    return w
  }

  unwatch(watcher: () => void): void {
    this.watchers.delete(watcher)
  }

  private notify_watchers(): void {
    for (const w of this.watchers)
      w()
    for (const d of this.derived)
      d.notify_watchers()
  }
}

export class ReactiveMap<Map extends { [_: string]: unknown }> implements rReactive<Map> {
  private watchers: Set<() => void> = new Set
  private derived: Set<DerivedReactive<Map, unknown>> = new Set

  constructor(private readonly reactives: Reactify<Map>) {
    for (const key of Object.keys(this.reactives))
      // QUESTION: when/how wo I unwatch the map stuff??
      this.reactives[key].watch((v) => {
        for (const w of this.watchers)
          w()
        for (const d of this.derived)
          d.notify_watchers()
      })
  }

  get(): Map {
    const m = {} as any
    for (const key of Object.keys(this.reactives))
      m[key] = this.reactives[key].get()
    return m as Map
  }

  values_equal(v1: Map, v2: Map): boolean {
    for (const key of Object.keys(v1)) {
      if (!this.reactives[key].values_equal(v1[key] as any, v2[key] as any))
        return false
    }
    return true
  }

  derive<NewValue>(f: (value: Map) => NewValue): rReactive<NewValue> {
    const d = new DerivedReactive(this, f)
    this.derived.add(d)
    return d
  }

  underive(derived: DerivedReactive<Map, unknown>): void {
    this.derived.delete(derived)
  }

  watch(f: (value: Map) => void): () => void {
    const w = () => f(this.get())
    this.watchers.add(w)
    return w
  }

  unwatch(watcher: () => void): void {
    this.watchers.delete(watcher)
  }
}

export const reactive = <Value>(value: Value, eq: (v1: Value, v2: Value) => boolean = simple_eq): rwReactive<Value> => {
  return new BaseReactive(value, eq)
}

export const rreactive = <Value>(value: Value, eq: (v1: Value, v2: Value) => boolean = simple_eq): rReactive<Value> => {
  return reactive(value, eq)
}

type Reactify<Map> = {
  [K in keyof Map]: rReactive<Map[K]>
}

export const combined = <M extends { [_: string]: unknown }>(map: Reactify<M>): rReactive<M> => {
  return new ReactiveMap(map)
}

export const lift_undefined = <V>(rv: rReactive<V> | undefined): rReactive<V | undefined> => {
  if (rv === undefined)
    return rreactive<V | undefined>(undefined)
  return rv.derive<V | undefined>((v) => v)
}
