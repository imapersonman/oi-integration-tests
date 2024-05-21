import { el } from './el'
import './style.css'
import { Displayable, displ, html, label, reactive_label, reactive_ml_text_field, reactive_text_field, sl, vl } from './displayable'
import { combined, rReactive, reactive, reactive_list, rwReactive, rwReactiveList, rwpReactiveList } from './reactive'
import { AnnotatorMetadata, CommandConfiguration, FullQuestion, QuestionPreview, TaskResult, TaskRun, TaskRunPreview } from './models'
import { Api, default_api } from './api'
import { assert_exists } from './utilities'

const DEFAULT_HOSTNAME = '127.0.0.1'
const DEFAULT_PORT = '7172'
const DEFAULT_OPTIONS = ''
const DEFAULT_SYSTEM_PROMPT = `You are a general AI assistant.
I will ask you a question. Report your thoughts, and finish your answer with the following template: FINAL ANSWER: [YOUR FINAL ANSWER].
YOUR FINAL ANSWER should be a number OR as few words as possible OR a comma separated list of numbers and/or strings.
If you are asked for a number, don’t use comma to write your number neither use units such as $ or percent sign unless specified otherwise.
If you are asked for a string, don’t use articles, neither abbreviations (e.g. for cities), and write the digits in plain text unless specified otherwise.
If you are asked for a comma separated list, apply the above rules depending of whether the element to be put in the list is a number or a string.`

const API = default_api
const MODAL_DISPL = reactive<Displayable<any> | undefined>(undefined)

const stored_boolean = (key: string, default_value: boolean): rwReactive<boolean> => {
    const stored = localStorage.getItem(key) === 'true' ? true : false
    const r = reactive(stored ?? default_value)
    r.watch((value) => localStorage.setItem(key, `${value}`))
    return r
}

const stored_string = (key: string, default_value: string): rwReactive<string> => {
    const r = reactive(localStorage.getItem(key) ?? default_value)
    r.watch((value) => localStorage.setItem(key, value))
    return r
}

const stored_number = (key: string, default_value: number): rwReactive<number> => {
    const stored = localStorage.getItem(key)
    const r = reactive(stored === null ? default_value : parseInt(stored))
    r.watch((value) => localStorage.setItem(key, `${value}`))
    return r
}

const task_result = <Opt>(tr: rReactive<TaskResult | undefined>): Displayable<Opt> => {
    return displ(() => {
        const e = el('pre', {})
        tr.watch((tr) => {
            e.innerHTML = ''
            if (tr !== undefined)
                e.append(JSON.stringify(tr, null, 2))
        })
        return e
    })
}

type ChildOptions = {
    base: rReactive<string>
    command: rReactive<CommandConfiguration>
    api: Api
}

type Hostname = {
    host: string
    port: string
}

type rwHostname = {
    host: rwReactive<string>
    port: rwReactive<string>
    full: rReactive<string>
    status: rwReactive<'unknown' | 'good' | 'bad'>
}

const rw_hostname = (host: rwReactive<string>, port: rwReactive<string>): rwHostname => ({
    host, port,
    full: combined({ host, port }).derive(({ host, port }) => `http://${host}:${port}`),
    status: reactive<'unknown' | 'good' | 'bad'>('unknown')
})

// Cannot reorder using drag and drop.
const dynamic_list = <Item, Opts>(list: rwReactiveList<Item>, to_d: (item: Item) => Displayable<Opts>): Displayable<Opts> => {
    return displ((opts) => {
        const e = el('div', {})
        const i2e: Map<Item, HTMLElement> = new Map

        list.watch_add((item) => {
            const ie = to_d(item).get_display(opts)
            i2e.set(item, ie)
            e.appendChild(ie)
        })()
        list.watch_remove((item) => {
            const e = assert_exists(i2e.get(item))
            i2e.delete(item)
            e.remove()
        })

        return e
    })
}

const editable_connection_entry = <Opts>(hn: rwHostname, editing: rwReactive<boolean>): Displayable<Opts> => {
    const og_host = hn.host.get()
    const og_port = hn.port.get()
    return displ((opts) => {
        const confirm = button('confirm', () => {
            if (hn.host.get() === '') hn.host.set(og_host)
            if (hn.port.get() === '') hn.port.set(og_port)
            editing.set(false)
        })
        return sl(
            label('http://'),
            reactive_text_field(hn.host, 'host'),
            label(':'),
            reactive_text_field(hn.port, 'port'),
            html(confirm)
        ).get_display(opts)
    })
}

const viewable_connection_entry = <Opts>(hn: rwHostname): Displayable<Opts> => {
    return reactive_label(hn.full)
}

const colored = <Opts>(color: string, d: Displayable<Opts>): Displayable<Opts> => {
    return displ((opts) => {
        const e = d.get_display(opts)
        e.style.backgroundColor = color
        return e
    })
}

const connection_entry = <Opts>(hn: rwHostname): Displayable<Opts> => {
    const editing = reactive(false)
    const viewing = editing.derive((editing) => !editing)
    const connection_status = reactive<'unknown' | 'good' | 'bad'>('unknown')

    return displ((opts) => {
        const edit = button('edit', () => editing.set(true))
        editing.watch((editing) => edit.disabled = editing)

        const editing_e = hideable(viewing, editable_connection_entry(hn, editing))
        const viewing_e = hideable(editing, viewable_connection_entry(hn))

        viewing.watch(async (viewing) => {
            if (viewing) {
                const is_good = await API.check_connection(hn.full.get(), 5000)
                const status = is_good ? 'good' : 'bad'
                connection_status.set(status)
            } else {
                connection_status.set('unknown')
            }
        })()

        connection_status.watch((status) => hn.status.set(status))

        const status_badge = one_of_displ(connection_status, {
            'unknown': colored('yellow', label('\xa0')),
            'good': colored('green', label('\xa0')),
            'bad': colored('red', label('\xa0'))
        })

        return sl(html(edit), status_badge, editing_e, viewing_e).get_display(opts)
    })
}

type DisplMap<Keys extends string, Opts> = {
    [K in Keys]: Displayable<Opts>
}

const one_of_displ = <Selector extends string, Opts>(selector: rReactive<Selector>, dm: DisplMap<Selector, Opts>): Displayable<Opts> => {
    return displ((opts) => {
        let e = dm[selector.get()].get_display(opts)
        selector.watch(() => {
            const old = e
            e = dm[selector.get()].get_display(opts)
            old.replaceWith(e)
        })
        return e
    })
}

const reactive_displ = <Opts>(rd: rReactive<Displayable<Opts>>): Displayable<Opts> => {
    return displ((opts) => {
        const holder = el('div', {})
        let e = rd.get().get_display(opts)
        holder.appendChild(e)
        rd.watch((d) => {
            holder.innerHTML = ''
            e = d.get_display(opts)
            holder.appendChild(e)
        })()
        return holder
    })
}

type PromisedDisplMap<P, Opts> = {
    'waiting': () => Displayable<Opts>
    'rejected': (e: any) => Displayable<Opts>
    'resolved': (p: P) => Displayable<Opts>
}

const promised_displ = <P, Opts>(promise: Promise<P>, m: PromisedDisplMap<P, Opts>): Displayable<Opts> => {
    const d = reactive<Displayable<Opts>>(m['waiting']())
    promise
        .then((p) => d.set(m['resolved'](p)))
        .catch((e) => d.set(m['rejected'](e)))
    return reactive_displ(d)
}

const faded_hoverable = <Opts>(d: Displayable<Opts>, normal_opacity: number): Displayable<Opts> => {
    return displ((opts) => {
        const e = d.get_display(opts)
        e.style.opacity = `${normal_opacity}`
        e.style.cursor = 'pointer'
        e.addEventListener('mouseover', (event) => {
            e.style.opacity = '1'
            event.stopPropagation()
        })
        e.addEventListener('mouseout', () => {
            e.style.opacity = `${normal_opacity}`
        })
        return e
    })
}

const clickable = <Opts>(d: Displayable<Opts>, f: () => void): Displayable<Opts> => {
    return displ((opts) => {
        const e = d.get_display(opts)
        e.addEventListener('click', () => f())
        return e
    })
}

const expandable = <Opts>(heading: Displayable<Opts>, content: () => Displayable<Opts>): Displayable<Opts> => {
    const state = reactive<'expanded' | 'collapsed'>('collapsed')
    const is_collapsed = state.derive((state) => state === 'collapsed')
    const fade = 0.3
    const chevron = one_of_displ(state, {
        'expanded': clickable(faded_hoverable(label('▼'), fade), () => state.set('collapsed')),
        'collapsed': clickable(faded_hoverable(label('►'), fade), () => state.set('expanded'))
    })
    return sl(
        chevron,
        vl(heading, lazy_hideable(is_collapsed, content)))
}

const task_preview = <Opts>(t: QuestionPreview): Displayable<Opts> => {
    // return label(t.task_id)
    return label(t.question)
}

const full_task = <Opts>(task: FullQuestion): Displayable<Opts> => {
    return vl(
        sl(label('Task ID:'), label(task.task_id)),
        sl(label('Level:'), label(`${task.level}`)),
        sl(label('File name:'), label(task.file_name === '' ? 'N/A' : task.file_name)),
        sl(label('Question:'), html(el('pre', {}, task.question))),
        sl(label('Final answer:'), html(el('pre', {}, task.final_answer))),
        vl(
            label('Annotator Metadata:'),
            sl(html(el('div', { style: 'width: 2em;' }, '\xa0')), annotator_metadata(task.annotator_metadata))))
}

const task_runner = <Opts>(hn: rReactive<string>, t_id: string): Displayable<Opts> => {
    const [command, display] = command_configurator()
    const run_button = button('run!', () => {
        run_button.disabled = true
        API.run_single(hn.get(), command.get(), t_id)
            .finally(() => {
                run_button.disabled = false
            })
    })
    return vl(display, html(run_button))
}

const command_configurator = <Opts>(): [rReactive<CommandConfiguration>, Displayable<Opts>] => {
    const auto_run = reactive(false)
    const os_mode = reactive(false)
    const model = reactive('')
    const api_base = reactive('')
    const api_key = reactive('')
    const system_prompt = reactive(DEFAULT_SYSTEM_PROMPT)
    const rcommand = combined({ auto_run, os_mode, model, api_base, api_key, system_prompt })
    const d = vl(
        sl(label('auto_run:'), checkbox(auto_run)),
        sl(label('os_mode:'), checkbox(os_mode)),
        sl(label('model:'), reactive_text_field(model)),
        sl(label('api_base:'), reactive_text_field(model)),
        sl(label('api_key:'), reactive_text_field(api_key)),
        sl(label('system_prompt:'), reactive_ml_text_field(system_prompt)),
    )
    return [rcommand, d]
}

const loading_full_task = <Opts>(hn: rReactive<string>, t_id: string): Displayable<Opts> => {
    return promised_displ(API.get_single(hn.get(), t_id), {
        'waiting': () => label('waiting'),
        'rejected': () => label('rejected'),
        'resolved': (task) => {
            if (task === undefined)
                return label('no task!')
            return vl(full_task(task), html(button('run!', () => MODAL_DISPL.set(task_runner(hn, t_id)))))
        }
    })
}

const expandable_task = <Opts>(hn: rReactive<string>, t: QuestionPreview): Displayable<Opts> => {
    return expandable(
        task_preview(t),
        () => loading_full_task(hn, t.task_id))
}

const all_tasks = <Opts>(hn: rReactive<string>): Displayable<Opts> => {
    const task_list = reactive_list<QuestionPreview>([])
    return displ((opts) => {
        hn.watch(async (hn) => {
            task_list.clear()
            try {
                const tasks = await API.get_all(hn)
                for (const t of tasks)
                    task_list.add(t)
            } catch (e) {
                console.error('siojdlaijhdaljdalj', e)
            }
        })()
        return dynamic_list(task_list, (t) => expandable_task(hn, t)).get_display(opts)
    })
}

const task_run_preview = <Opts>(r: TaskRunPreview): Displayable<Opts> => {
    return arbitrary_json(r)
}

const full_task_run = <Opts>(run_id: string): Displayable<Opts> => {
    return label(`full task run for: ${run_id}`)
}

const expandable_run = <Opts>(r: TaskRunPreview): Displayable<Opts> => {
    return expandable(
        task_run_preview(r),
        () => full_task_run(r.id)
    )
}

const all_runs = <Opts>(hn: rReactive<string>): Displayable<Opts> => {
    const runs_list = reactive_list<TaskRunPreview>([])
    return displ((opts) => {
        hn.watch(async (hn) => {
            runs_list.clear()
            const runs = await API.get_all_runs(hn)
            for (const r of runs)
                runs_list.add(r)
        })()
        return dynamic_list(runs_list, (r) => expandable_run(r)).get_display(opts)
    })
}

const connect_with_connection = (hn: rwHostname, remove: () => void) => <Opts>(): Displayable<Opts> => {
    const [command, command_display] = command_configurator()
    return one_of_displ(hn.status, {
        'unknown': label('waiting...'),
        'bad': label('bad connection!'),
        'good': vl(
            html(button('remove', remove)),
            expandable(label('tasks'), () => vl(
                html(button('run all tasks', () => API.invoke_all(hn.full.get(), command.get()))),
                expandable(label('configure command'), () => command_display),
                all_tasks(hn.full)
            )),
            expandable(label('all runs'), () => all_runs(hn.full))),
    })
}

const expandable_connection_entry = <Opts>(hn: rwHostname, remove: () => void): Displayable<Opts> => {
    return expandable(
        connection_entry(hn),
        connect_with_connection(hn, remove)
    )
}

const connections = <Opts>(): Displayable<Opts> => {
    const hname_list: rwReactiveList<rwHostname> = reactive_list<rwHostname>([])

    return displ((opts) => {
        const add = button('add connection', () => {
            const rw_hn = rw_hostname(reactive(DEFAULT_HOSTNAME), reactive(DEFAULT_PORT))
            hname_list.add(rw_hn)
        })

        return vl(
            dynamic_list(hname_list, (hn) => expandable_connection_entry(hn, () => hname_list.remove_item(hn))),
            html(add)
        ).get_display(opts)
    })
}

const optional_displ = <Opts>(d: rReactive<Displayable<Opts> | undefined>): Displayable<Opts> => {
    const is_hidden = d.derive((d) => d === undefined)
    return lazy_hideable(is_hidden, () => d as unknown as Displayable<Opts>)
}

const container2 = (): Displayable<{}> => {
    return vl(
        displ(() => connections().get_display({ api: default_api })),
        modal_displ(MODAL_DISPL)
    )
}

const container = (): Displayable<{}> => {
    const hostname = stored_string('hostname', DEFAULT_HOSTNAME)
    const port = stored_string('port', DEFAULT_PORT)

    const full = combined({ hostname, port }).derive(({ hostname, port }) => `http://${hostname}:${port}`)
    const qb = reactive<QuestionPreview[] | undefined>(undefined)

    const [command, command_display] = command_builder()
    const child_options: ChildOptions = {
        base: full,
        api: default_api,
        command
    }

    return {
        get_display: (opts) => {
            const qb_parent = el('div', { style: 'max-width: 100%; width: 100%;' })
            const connect_button = el('input', { type: 'button', value: 'connect' }) as HTMLInputElement

            const spinner = el('div', { class: 'spinner' })
            spinner.style.display = 'none'
            qb_parent.appendChild(spinner)

            const header = vl(
                sl(label("hostname:"), reactive_text_field(hostname)),
                sl(label("port:"), reactive_text_field(port)),
                sl(label("full:"), reactive_label(full)),
                html(connect_button),
                html(spinner)
            ).get_display(opts)

            header.style.border = '1px solid #ccc'
            header.style.padding = '0.5em'
            header.style.width = 'fit-content'
            header.style.backgroundColor = 'white'

            const e = vl(
                connections(),
                html(header),
                command_display,
                html(qb_parent),
            ).get_display({ api: child_options.api })

            connect_button.addEventListener('click', async () => {
                console.log(`attemping to connect to host "${full.get()}"...`)
                spinner.style.display = 'block'
                qb_parent.innerHTML = ''
                await child_options.api.get_all(child_options.base.get())
                    .then((data) => qb_parent.appendChild(question_browser(data).get_display(child_options)))
                    .catch((e) => {
                        qb_parent.appendChild(el('div', {}, `There was a problem connecting to ${full.get()}.`))
                        qb_parent.append(el('pre', {}, JSON.stringify(e, undefined, 2)))
                        throw e
                    })
                    .finally(() => spinner.style.display = 'none')
            })

            return e
        }
    }
}

const command_builder = <Opt>(): [rReactive<CommandConfiguration>, Displayable<Opt>] => {
    const options = stored_string('options', DEFAULT_OPTIONS)
    const command = options.derive((opts) => `interpreter ${opts}`)

    const auto_run = stored_boolean('auto_run', false)
    const os_mode = stored_boolean('os_mode', false)
    const model = stored_string('model', '')
    const api_base = stored_string('api_base', '')
    const api_key = stored_string('api_key', '')
    const system_prompt = stored_string('system_prompt', DEFAULT_SYSTEM_PROMPT)

    const display = vl(
        sl(label('auto_run:'), checkbox(auto_run)),
        sl(label('os_mode:'), checkbox(os_mode)),
        sl(label('model:'), reactive_text_field(model)),
        sl(label('api_base:'), reactive_text_field(api_base)),
        sl(label('api_key:'), reactive_text_field(api_key)),
        vl(label('system_prompt:'), reactive_ml_text_field(system_prompt))
    )

    const command_config = combined({ auto_run, os_mode, model, api_base, api_key, system_prompt })
    return [command_config, display]
}

const run_selected = () => {
}

const text_preview = (text: string, n_chars: number): string => {
    const continue_text = '...'
    const limit = n_chars - continue_text.length
    if (limit < 0 || text.length < limit)
        return text
    else
        return `${text.substring(0, n_chars)}${continue_text}`
}

const formatted_text = (text: string): HTMLElement[] => {
    return [el('pre', { style: 'text-overflow: ellipses' }, text)]
    // const es = []
    // let acc = ''

    // for (const c of text) {
    //     if (c === '\n') {
    //         // const p = el('p', { style: 'white-space-collapse: preserve;' }, acc)
    //         const p = el('pre', {}, acc)
    //         es.push(p)
    //         acc = ''
    //     } else {
    //         acc += c
    //     }
    // }

    // if (acc !== '')
    //     es.push(el('pre', {}, acc))

    // return es
}

type DisplayableCol<Opt> =
    | { tag: 'static', value: string | number, display: Displayable<Opt> }
    | { tag: 'dynamic', value: rwReactive<any>, display: Displayable<Opt> }

type DisplayableRow<Opt> = {
    [_: string | number]: DisplayableCol<Opt>
}

const modal = <Opt, C>(content: rwReactive<C | undefined>, to_d: (c: C) => Displayable<Opt>): Displayable<Opt> => {
    return {
        get_display: (opts) => {
            const close = button('close', () => content.set(undefined))
            close.style.marginBottom = '0.5em'
            const content_parent = el('div', {})
            const e = el('div', { class: 'modal' }, close, content_parent)
            content.watch((content) => {
                content_parent.innerHTML = ''
                if (content !== undefined) {
                    const d = to_d(content)
                    e.style.display = 'block'
                    content_parent.appendChild(d.get_display(opts))
                } else {
                    e.style.display = 'none'
                }
            })()
            e.addEventListener('mouseenter', () => {
                document.body.classList.add('no-scroll-for-modal')
            })
            e.addEventListener('mouseleave', (e) => {
                document.body.classList.remove('no-scroll-for-modal')
            })
            e.style.backgroundColor = 'white'
            e.style.border = 'solid black'
            e.style.padding = '0.5em'
            return e
        }
    }
}

const modal_displ = <Opts>(content: rwReactive<Displayable<Opts> | undefined>): Displayable<Opts> => {
    return displ((opts) => {
        const close = button('close', () => content.set(undefined))
        close.style.marginBottom = '0.5em'
        const content_parent = el('div', {})
        const e = el('div', { class: 'modal' }, close, content_parent)
        content.watch((content) => {
            content_parent.innerHTML = ''
            if (content !== undefined) {
                const de = content.get_display(opts)
                e.style.display = 'block'
                content_parent.appendChild(de)
            } else {
                e.style.display = 'none'
            }
        })()
        e.addEventListener('mouseenter', () => {
            document.body.classList.add('no-scroll-for-modal')
        })
        e.addEventListener('mouseleave', (e) => {
            document.body.classList.remove('no-scroll-for-modal')
        })
        e.style.backgroundColor = 'white'
        e.style.border = 'solid black'
        e.style.padding = '0.5em'
        return e
    })
}

const table = <Opt, R>(rl: rwpReactiveList<R>, headers: string[], to_d: (r: R, e: HTMLElement) => DisplayableRow<Opt>): Displayable<Opt> => {
    return {
        get_display: (opts) => {
            const he = el('tr', {}, ...headers.map((h) => el('th', {}, h)))
            const e = el('table', {}, he)

            rl.watch_add((r) => {
                const re = el('tr', {})
                const d = to_d(r, re)
                e.appendChild(re)
                for (const header of headers) {
                    const cell = el('td', {})
                    re.appendChild(cell)
                    if (d[header] === undefined) {
                        cell.append('empty')
                    } else {
                        cell.appendChild(d[header].display.get_display(opts))
                    }
                }
            })()

            return e
        }
    }
}

const checkbox = <Opt>(rv: rwReactive<boolean>): Displayable<Opt> => {
    return {
        get_display: () => {
            const e = el('input', { type: 'checkbox' }) as HTMLInputElement
            // How is this not causing an infinite loop??
            // ...something something event loop...?
            rv.watch((value) => e.checked = value)()
            e.addEventListener('change', () => rv.set(e.checked))
            return e
        }
    }
}

const hideable = <Opts>(is_hidden: rReactive<boolean>, display: Displayable<Opts>): Displayable<Opts> => {
    return displ((opt) => {
        const e = display.get_display(opt)
        const og_display = e.style.display
        is_hidden.watch((is_hidden) => e.style.display = is_hidden ? 'none' : og_display)()
        return e
    })
}

const lazy_hideable = <Opts>(is_hidden: rReactive<boolean>, to_display: () => Displayable<Opts>): Displayable<Opts> => {
    return displ((opts) => {
        let current = el('div', {})
        let og_display = current.style.display
        is_hidden.watch((h) => {
            if (!h) {
                const e = to_display().get_display(opts)
                current.replaceWith(e)
                current = e
                current.style.display = og_display
                og_display = e.style.display
            } else {
                current.style.display = 'none'
            }
        })
        return current
    })
}

const button = (label: string, callback: (event: MouseEvent) => void): HTMLInputElement => {
    const b = el('input', { type: 'button', value: label })
    b.addEventListener('click', callback)
    return b as HTMLInputElement
}

const annotator_metadata = <Opt>(am: AnnotatorMetadata): Displayable<Opt> => {
    if (am === null) {
        return label('None')
    } else {
        return vl(
            sl(label('Number of Steps:'), label(`${am.number_of_steps}`)),
            sl(label('How long did this take?:'), label(am.length_of_time)),
            sl(label('Number of tools:'), label(am.number_of_tools)),
            sl(label('Steps:'), html(el('pre', {}, am.steps))),
            sl(label('Tools:'), html(el('pre', {}, am.tools))),
        )
    }
}

// loose def of json.
type Json = string | number | null | undefined | { [_: string]: Json }

const arbitrary_json = <Opts>(j: Json): Displayable<Opts> => {
    return displ((opts) => {
        if (j === null || j === undefined)
            return label('null').get_display(opts)
        else if (typeof j === 'string')
            return label(j).get_display(opts)
        else if (typeof j === 'number')
            return label(j.toString()).get_display(opts)
        else {
            const entries: Displayable<Opts>[] = []
            for (const [k, v] of Object.entries(j))
                entries.push(sl(label(`${k}:`), arbitrary_json(v)))
            const body_e = vl(...entries).get_display(opts)
            body_e.style.marginLeft = '2ch'
            return vl(
                label('{'),
                html(body_e),
                label('}')
            ).get_display(opts)
        }
    })
}

const full_question = (qp: FullQuestion): Displayable<ChildOptions> => {
    const is_running = reactive(false)
    const is_not_running = is_running.derive((r) => !r)
    const tr = reactive<TaskResult | undefined>(undefined)
    const without_result = tr.derive((tr) => tr === undefined)
    return displ((opts) => {
        const controller = new AbortController()
        const cancel_button = button('cancel', () => controller.abort())
        const run = button('run', () => {
            run.value = 'running...'
            run.disabled = true
            is_running.set(true)
            API.run_single(opts.base.get(), opts.command.get(), qp.task_id, controller)
                .then((result) => {
                    tr.set(result)
                })
                .finally(() => {
                    run.value = 'run'
                    run.disabled = false
                    is_running.set(false)
                })
        })
        return vl(
            sl(label('Task ID:'), label(qp.task_id)),
            sl(label('Level:'), label(`${qp.level}`)),
            sl(label('File name:'), label(qp.file_name === '' ? 'N/A' : qp.file_name)),
            sl(label('Question:'), html(el('pre', {}, qp.question))),
            sl(label('Final answer:'), html(el('pre', {}, qp.final_answer))),
            vl(
                label('Annotator Metadata:'),
                sl(html(el('div', { style: 'width: 2em;' }, '\xa0')), annotator_metadata(qp.annotator_metadata)),
            ),
            html(run),
            hideable(is_not_running, html(cancel_button)),
            hideable(without_result, task_result(tr))
            // sl(html(button('', goto_prev)), html(button('', goto_next)))
        ).get_display(opts)
    })
}

const question_browser = (qps: QuestionPreview[]): Displayable<ChildOptions> => {
    const qi = reactive<number | undefined>(0)
    const expanded = reactive<FullQuestion | undefined>(undefined)
    const m = modal(expanded, full_question)

    return {
        get_display: (opts) => {
            const row_selections: [QuestionPreview, rwReactive<boolean>][] = []
            const selections: rwReactive<boolean>[] = []
            // a task_id will appear in the following list if its been selected.
            const selected_tasks = reactive_list<string>([])
            const clear = button('clear selections', () => selections.forEach((s) => s.set(false)))
            const all = button('select all', () => selections.forEach((s) => s.set(true)))
            const selected_count = reactive(0)
            const selected_count_text = selected_count.derive((n) => `${n}`)
            const count_label = reactive_label(selected_count_text)

            const task_selected_set = new Set<string>()
            selected_tasks.watch_add((t) => task_selected_set.add(t))
            selected_tasks.watch_remove((t) => task_selected_set.delete(t))

            const rows = reactive_list<QuestionPreview>([])
            const t = table(rows, ['selected', 'expand', 'runs', 'task_id', 'Level', 'Question'], (r, row_el) => {
                const selected = reactive(false)
                row_selections.push([r, selected])
                selected.watch((selected) => {
                    if (selected) {
                        if (!task_selected_set.has(r.task_id))
                            selected_tasks.add(r.task_id)
                    } else {
                        const i = selected_tasks.index_of(r.task_id)
                        if (i >= 0)
                            selected_tasks.remove(i)
                    }
                })
                selections.push(selected)
                const qe = el('pre', { class: 'collapsed' }, r.question)
                const expand = button('expand', (e) => {
                    API.get_single(opts.base.get(), r.task_id)
                        .then((full) => {
                            if (full !== undefined)
                                expanded.set(expanded.get()?.task_id === full.task_id ? undefined : full)
                        })
                        .catch((e) => console.trace(e))
                    e.stopPropagation()
                })
                const runs = button('runs', (e) => {
                    API.get_task_runs(opts.base.get(), r.task_id)
                        .then((runs) => {
                            console.log('runs', runs)
                        })
                    e.stopPropagation()
                })
                row_el.addEventListener('click', () => selected.set(!selected.get()))
                return {
                    selected: { tag: 'dynamic', value: selected, display: checkbox(selected) },
                    expand: { tag: 'static', value: r.task_id, display: html(expand) },
                    runs: { tag: 'static', value: r.task_id, display: html(runs) },
                    task_id: { tag: 'static', value: r.task_id, display: label(r.task_id) },
                    Level: { tag: 'static', value: r.level, display: label(`${r.level}`) },
                    Question: { tag: 'static', value: r.question, display: html(qe) }
                }
            })

            const run_selected = button("run selected", () => {})
            run_selected.disabled = true
            selected_tasks.watch_remove(() => {
                if (task_selected_set.size === 0)
                    run_selected.disabled = true
                selected_count.set(selected_tasks.length())
            })
            selected_tasks.watch_add(() => {
                run_selected.disabled = false
                selected_count.set(selected_tasks.length())
            })

            const show_all_runs = button('show all runs', () => {
                API.get_all_runs(opts.base.get())
                    .then(() => {})
            })

            const level_1 = button('select level 1', () => row_selections.forEach(([r, s]) => {
                if (r.level === 1)
                    s.set(true)
            }))
            const level_2 = button('select level 2', () => row_selections.forEach(([r, s]) => {
                if (r.level === 2)
                    s.set(true)
            }))
            const level_3 = button('select level 3', () => row_selections.forEach(([r, s]) => {
                if (r.level === 3)
                    s.set(true)
            }))

            const header = vl(
                m,
                sl(html(all), html(clear)),
                sl(html(level_1), html(level_2), html(level_3)),
                sl(html(run_selected), count_label),
                html(show_all_runs)
            ).get_display(opts)

            const e = el('div', { style: 'overflow: auto; max-width: 100%; margin-top: 0.5em;' },
                header,
                t.get_display(opts))

            rows.add(...qps)

            return e
        }
    }
}

interface Settings {
    get_hostnames: () => Promise<Hostname[]>
}

window.onload = () => {
    const root = document.querySelector('#app')!
    root.appendChild(container2().get_display({}))
    // const db_request = indexedDB.open('settings', 1)

    // db_request.onupgradeneeded = () => {
    //     const db = db_request.result
    //     const store = db.createObjectStore('settings', )
    // }

    // db_request.onsuccess = () => {
    //     const db = db_request.result
    //     const settings = {
    //         get_hostnames: () => new Promise((reject, resolve) => {
    //             const req = db.get
    //         })
    //     }
    //     root.appendChild(container2().get_display({ settings }))
    // }
}
