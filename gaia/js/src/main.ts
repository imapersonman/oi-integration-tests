import { el } from './el'
import './style.css'
import { Displayable, displ, html, label, reactive_label, reactive_ml_text_field, reactive_text_field, sl, vl } from './displayable'
import { combined, rReactive, reactive, reactive_list, rwReactive, rwpReactiveList } from './reactive'
import { z } from 'zod'

const DEFAULT_HOSTNAME = '127.0.0.1'
const DEFAULT_PORT = '7000'
const DEFAULT_OPTIONS = ''
const DEFAULT_SYSTEM_PROMPT = `
You are a general AI assistant. I will ask you a question. Report your thoughts, and finish your answer with the following template: FINAL ANSWER: [YOUR FINAL ANSWER]. YOUR FINAL ANSWER should be a number OR as few words as possible OR a comma separated list of numbers and/or strings.
If you are asked for a number, don’t use comma to write your number neither use units such as $ or percent sign unless specified otherwise.
If you are asked for a string, don’t use articles, neither abbreviations (e.g. for cities), and write the digits in plain text unless specified otherwise.
If you are asked for a comma separated list, apply the above rules depending of whether the element to be put in the list is a number or a string.
`

interface Configuration {
    connection: ConnectionConfiguration
    command: CommandConfiguration
}

interface ConnectionConfiguration {
    host: string
    post: string
}

interface CommandConfiguration {
    auto_run: boolean
    model: string     // empty means default model.
    api_base: string  // empty means default base.
    api_key: string   // empty means default key.
    system_prompt: string
}

const QuestionPreview = z.object({
    task_id: z.string(),
    Level: z.string().transform((ns) => parseInt(ns)),
    Question: z.string()
})

type QuestionPreview = z.infer<typeof QuestionPreview>

const AnnotatorMetadata = z.nullable(z.object({
    Steps: z.string(),
    'Number of steps': z.string().transform((ns) => parseInt(ns)),
    'How long did this take?': z.string(),
    Tools: z.string(),
    'Number of tools': z.string()
}))

type AnnotatorMetadata = z.infer<typeof AnnotatorMetadata>

const FullQuestion = z.object({
    task_id: z.string(),
    Question: z.string(),
    Level: z.string().transform((ns) => parseInt(ns)),
    'Final answer': z.string(),
    file_name: z.string(),
    'Annotator Metadata': AnnotatorMetadata
})

type FullQuestion = z.infer<typeof FullQuestion>

type Options = {
    get_single: (task_id: string, abort_controller?: AbortController) => Promise<FullQuestion>
    run_single: (task_id: string, abort_controller?: AbortController) => Promise<'correct' | 'incorrect' | 'error'>
}

const stored_boolean = (key: string, default_value: boolean): rwReactive<boolean> => {
    const stored = localStorage.getItem(key) === 'true' ? true : false
    console.log('stored boolean???', stored)
    const r = reactive(stored ?? default_value)
    r.watch((value) => { console.log('stored', stored); localStorage.setItem(key, `${value}`) })
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

const container = (): Displayable<{}> => {
    const hostname = stored_string('hostname', DEFAULT_HOSTNAME)
    const port = stored_string('port', DEFAULT_PORT)

    const full = combined({ hostname, port }).derive(({ hostname, port }) => `http://${hostname}:${port}`)
    const qb = reactive<QuestionPreview[] | undefined>(undefined)

    const [command, command_display] = command_builder()

    const child_options: Options = {
        get_single: (task_id, c) => get_single_question(full.get(), task_id, c),
        run_single: (task_id, c) => run_single_task(full.get(), command.get(), task_id, c)
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
                html(header),
                command_display,
                html(qb_parent),
            ).get_display(opts)

            connect_button.addEventListener('click', async () => {
                console.log(`attemping to connect to host "${full.get()}"...`)
                spinner.style.display = 'block'
                qb_parent.innerHTML = ''
                await get_all_questions(full.get())
                    .then((data) => qb_parent.appendChild(question_browser(data).get_display(child_options)))
                    .catch(() => qb_parent.appendChild(el('div', {}, `There was a problem connecting to ${full.get()}.`)))
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
    const model = stored_string('model', '')
    const api_base = stored_string('api_base', '')
    const api_key = stored_string('api_key', '')
    const system_prompt = stored_string('system_prompt', DEFAULT_SYSTEM_PROMPT)

    const display = vl(
        sl(label('auto_run:'), checkbox(auto_run)),
        sl(label('model:'), reactive_text_field(model)),
        sl(label('api_base:'), reactive_text_field(api_base)),
        sl(label('api_key:'), reactive_text_field(api_key)),
        vl(label('system_prompt:'), reactive_ml_text_field(system_prompt))
    )

    // const display: Displayable<Opt> = vl(
    //     displ((opts) => el('pre', { style: 'margin: 0;' }, sl(label('interpreter'), reactive_text_field(options)).get_display(opts))),
    //     sl(label('command:'), displ((opts) => el('pre', {}, reactive_label(command).get_display(opts)))),
    // )

    const command_config = combined({ auto_run, model, api_base, api_key, system_prompt })
    return [command_config, display]
}

const get_single_question = (base: string, task_id: string, abort_controller?: AbortController): Promise<any> => {
    const signal_opt = abort_controller === undefined ? {} : { signal: abort_controller.signal }
    return fetch(`${base}/gaia/${task_id}`, signal_opt)
        .then((response) => {
            if (response.ok)
                return response.json()
            else
                throw new Error('Request for specific question failed.')
        })
        .then(FullQuestion.parse)
}

const get_all_questions = (base: string): Promise<QuestionPreview[]> => {
    return fetch(`${base}/gaia`)
        .then((response) => {
            if (response.ok)
                return response.json()
            else
                throw new Error('Request for specific question failed.')
        })
        .then(z.array(QuestionPreview).parse)
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

const hideable = <Opt>(display: Displayable<Opt>, is_hidden: rReactive<boolean>): Displayable<Opt> => {
    return displ((opt) => {
        const e = display.get_display(opt)
        const og_display = e.style.display
        console.log('og_display', og_display)
        is_hidden.watch((is_hidden) => e.style.display = is_hidden ? 'none' : og_display)()
        return e
    })
}

const button = (label: string, callback: (event: MouseEvent) => void): HTMLInputElement => {
    const b = el('input', { type: 'button', value: label })
    b.addEventListener('click', callback)
    return b as HTMLInputElement
}

const TaskResult = z.union([
    z.literal('correct'),
    z.literal('incorrect'),
    z.literal('error')
])

type TaskResult = z.infer<typeof TaskResult>

const run_single_task = (base: string, command: CommandConfiguration, task_id: string, c?: AbortController): Promise<'correct' | 'incorrect' | 'error'> => {
    const signal_opt = c === undefined ? {} : { signal: c.signal }
    const options = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id, command }),
        ...signal_opt
    }
    return fetch(`${base}/gaia/run`, options)
        .then((response) => {
            if (response.ok)
                return response.text()
            else
                throw new Error('Error running single task.')
        })
        .then(TaskResult.parse)
}

const annotator_metadata = <Opt>(am: AnnotatorMetadata): Displayable<Opt> => {
    if (am === null) {
        return label('None')
    } else {
        return vl(
            sl(label('Number of Steps:'), label(`${am['Number of steps']}`)),
            sl(label('How long did this take?:'), label(am['How long did this take?'])),
            sl(label('Number of tools:'), label(am['Number of tools'])),
            sl(label('Steps:'), html(el('pre', {}, am.Steps))),
            sl(label('Tools:'), html(el('pre', {}, am.Tools))),
        )
    }
}

const full_question = (qp: FullQuestion): Displayable<Options> => {
    const is_running = reactive(false)
    const is_not_running = is_running.derive((r) => !r)
    return displ((opts) => {
        const controller = new AbortController()
        const cancel_button = button('cancel', () => { console.log('cancelling!!'); controller.abort() })
        const run = button('run', () => {
            run.value = 'running...'
            run.disabled = true
            is_running.set(true)
            opts.run_single(qp.task_id, controller)
                .then((result) => {
                    console.log('result', result)
                })
                .finally(() => {
                    run.value = 'run'
                    run.disabled = false
                    is_running.set(false)
                })
        })
        return vl(
            sl(label('Task ID:'), label(qp.task_id)),
            sl(label('Level:'), label(`${qp.Level}`)),
            sl(label('File name:'), label(qp.file_name === '' ? 'N/A' : qp.file_name)),
            sl(label('Question:'), html(el('pre', {}, qp.Question))),
            sl(label('Final answer:'), html(el('pre', {}, qp['Final answer']))),
            vl(
                label('Annotator Metadata:'),
                sl(html(el('div', { style: 'width: 2em;' }, '\xa0')), annotator_metadata(qp['Annotator Metadata'])),
            ),
            html(run),
            hideable(html(cancel_button), is_not_running)
            // sl(html(button('', goto_prev)), html(button('', goto_next)))
        ).get_display(opts)
    })
}

const question_browser = (qps: QuestionPreview[]): Displayable<Options> => {
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
            const t = table(rows, ['selected', "expand", 'task_id', 'Level', 'Question'], (r, row_el) => {
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
                const qe = el('pre', { class: 'collapsed' }, r.Question)
                const expand = button('expand', (e) => {
                    opts.get_single(r.task_id)
                        .then((full) => {
                            expanded.set(expanded.get()?.task_id === full.task_id ? undefined : full)
                        })
                    e.stopPropagation()
                })
                row_el.addEventListener('click', () => selected.set(!selected.get()))
                return {
                    selected: { tag: 'dynamic', value: selected, display: checkbox(selected) },
                    expand: { tag: 'static', value: r.task_id, display: html(expand) },
                    task_id: { tag: 'static', value: r.task_id, display: label(r.task_id) },
                    Level: { tag: 'static', value: r.Level, display: label(`${r.Level}`) },
                    Question: { tag: 'static', value: r.Question, display: html(qe) }
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

            const level_1 = button('select level 1', () => row_selections.forEach(([r, s]) => {
                if (r.Level === 1)
                    s.set(true)
            }))
            const level_2 = button('select level 2', () => row_selections.forEach(([r, s]) => {
                if (r.Level === 2)
                    s.set(true)
            }))
            const level_3 = button('select level 3', () => row_selections.forEach(([r, s]) => {
                if (r.Level === 3)
                    s.set(true)
            }))

            const header = vl(
                m,
                sl(html(all), html(clear)),
                sl(html(level_1), html(level_2), html(level_3)),
                sl(html(run_selected), count_label),
            ).get_display(opts)

            const e = el('div', { style: 'overflow: auto; max-width: 100%; margin-top: 0.5em;' },
                header,
                t.get_display(opts))

            console.log(qps)
            rows.add(...qps)

            return e
        }
    }
}

const root = document.querySelector('#app')!
root.appendChild(container().get_display({}))
