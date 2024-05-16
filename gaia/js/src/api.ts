import { z } from "zod"
import { CommandConfiguration, FullQuestion, QuestionPreview, TaskResult, TaskRun, TaskRunPreview } from "./models"

export type Api = {
    check_connection: (base: string, timeout_ms: number) => Promise<boolean>

    get_single: (base: string, task_id: string, abort_controller?: AbortController) => Promise<FullQuestion | undefined>
    get_all: (base: string) => Promise<QuestionPreview[]>
    run_single: (base: string, command: CommandConfiguration, task_id: string, abort_controller?: AbortController) => Promise<TaskResult>
    get_all_runs: (base: string, abort_controller?: AbortController) => Promise<TaskRunPreview[]>
    get_task_runs: (base: string, task_id: string, abort_controller?: AbortController) => Promise<TaskRunPreview[]>
    get_single_run: (base: string, run_id: string, abort_controller?: AbortController) => Promise<TaskRun | undefined>

    // returns the run's id if it was successfully created, and undefined if it wasn't for some reason.
    invoke: (base: string, command: CommandConfiguration, task_id: string, abort_controller?: AbortController) => Promise<string | undefined>
    invoke_all: (base: string, command: CommandConfiguration) => Promise<void>
    check_runs: (base: string) => EventSource
}

export const default_api: Api = ({
    check_connection: (base, timeout_ms = 5000) => {
        const controller = new AbortController()
        const options = { signal: controller.signal }
        const tmout = setTimeout(() => controller.abort(), timeout_ms)
        return fetch(`${base}/gaia/check-connection`, options)
            .then((response) => {
                clearTimeout(tmout)
                return response.ok
            })
            .catch((e) => {
                clearTimeout(tmout)
                if (e.name === 'AbortError')
                    return false
                return false
            })
    },
    get_single: (base, task_id, c) => {
        const signal_opt = c === undefined ? {} : { signal: c.signal }
        return fetch(`${base}/gaia/tasks/${task_id}`, signal_opt)
            .then((response) => {
                if (response.ok)
                    return response.json()
                else
                    return null
            })
            .then(FullQuestion.optional().parse)
    },
    get_all: (base) => {
        return fetch(`${base}/gaia/tasks`)
            .then((response) => {
                if (response.ok)
                    return response.json()
                else
                    throw new Error('Request for specific question failed.')
            })
            .then(z.array(QuestionPreview).parse)
    },
    run_single: (base, command, task_id, c) => {
        const signal_opt = c === undefined ? {} : { signal: c.signal }
        const options = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ task_id, command: command }),
            ...signal_opt
        }
        return fetch(`${base}/gaia/invoke`, options)
            .then((response) => {
                if (response.ok)
                    return response.json()
                else
                    throw new Error('Error running single task.')
            })
            .then((data) => {
                console.log('data', data)
                return data
            })
            .then(TaskResult.parse)
            .catch((e) => {
                console.log('TaskResult')
                console.log(e)
                return { status: 'error', created: Date().toString() }
            })
    },
    get_all_runs: (base, c) => {
        const signal_opts = c === undefined ? {} : { signal: c.signal }
        const options = { method: 'GET', ...signal_opts }
        return fetch(`${base}/gaia/runs`, options)
            .then((response) => {
                if (response.ok)
                    return response.json()
                else {
                    console.log('Response')
                    console.log(response)
                    throw new Error('Error getting all runs!')
                }
            })
            .then((data) => {
                console.log('all task run previews', data)
                return data
            })
            .then(z.array(TaskRunPreview).parse)
    },
    get_task_runs: (base, task_id, c) => {
        const signal_opts = c === undefined ? {} : { signal: c.signal }
        const options = { method: 'GET', ...signal_opts }
        return fetch(`${base}/gaia/tasks/${task_id}/runs`, options)
            .then((response) => {
                if (response.ok)
                    return response.json()
                else if (response.status === 404)
                    return []
                else
                    throw new Error('Error getting task runs!')
            })
            .then((data) => {
                console.log('some task runs previews:', data)
                return data
            })
            .then(z.array(TaskRunPreview).parse)
            .catch((e) => {
                console.log('get_task_runs error', e)
                throw e
            })
    },
    get_single_run: (base, run_id, c) => {
        const signal_opts = c === undefined ? {} : { signal: c.signal }
        const options = { method: 'GET', ...signal_opts }
        return fetch(`${base}/gaia/runs/${run_id}`, options)
            .then((response) => {
                if (response.ok)
                    return response.json()
                else if (response.status === 404)
                    return null
                else
                    throw new Error('Error getting single run!')
            })
            .then(TaskRun.optional().parse)
            .catch((e) => {
                console.log('get_single_run error', e)
                throw e
            })

    },
    invoke: (base, command, task_id, c) => {
        const signal_opts = c === undefined ? {} : { signal: c.signal }
        const data = { task_id, command }
        const options = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            ...signal_opts,
            body: JSON.stringify(data)
        }
        return fetch(`${base}/gaia/invoke`, options)
            .then((response) => {
                if (response.ok)
                    return response.json()
                else if (response.status === 404)
                    return undefined
                else
                    throw new Error('Error invoking task run!')
            })
    },
    invoke_all: async (base, command) => {
        // need to add failure info eventually!
        const task_ids = (await default_api.get_all(base)).map(({ task_id }) => task_id)
        for (const id of task_ids)
            await default_api.invoke(base, command, id)
    },
    check_runs: (base) => {
        const es = new EventSource(`${base}/gaia/check-runs`)
        return es
    }
})

// const get_single_question = (base: string, task_id: string, abort_controller?: AbortController): Promise<any> => {
//     const signal_opt = abort_controller === undefined ? {} : { signal: abort_controller.signal }
//     return fetch(`${base}/gaia/tasks/${task_id}`, signal_opt)
//         .then((response) => {
//             if (response.ok)
//                 return response.json()
//             else
//                 throw new Error('Request for specific question failed.')
//         })
//         .then(FullQuestion.parse)
// }

// const get_all_questions = (base: string): Promise<QuestionPreview[]> => {
//     return fetch(`${base}/gaia/tasks`)
//         .then((response) => {
//             if (response.ok)
//                 return response.json()
//             else
//                 throw new Error('Request for specific question failed.')
//         })
//         .then(z.array(QuestionPreview).parse)
// }

// const run_single_task = (base: string, command: CommandConfiguration, task_id: string, c?: AbortController): Promise<TaskResult> => {
//     const signal_opt = c === undefined ? {} : { signal: c.signal }
//     const options = {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ task_id, command }),
//         ...signal_opt
//     }
//     return fetch(`${base}/gaia/invoke`, options)
//         .then((response) => {
//             if (response.ok)
//                 return response.json()
//             else
//                 throw new Error('Error running single task.')
//         })
//         .then((data) => {
//             console.log('data', data)
//             return data
//         })
//         .then(TaskResult.parse)
//         .catch((e) => {
//             console.log('TaskResult')
//             console.log(e)
//             return { status: 'error', created: Date().toString() }
//         })
// }
