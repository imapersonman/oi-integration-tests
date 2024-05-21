/*
This file contains tests for the api functions found in src/api.ts.
 */

import { describe, test, expect } from 'vitest'
import { ChildProcess, ChildProcessWithoutNullStreams, spawn } from 'child_process'
import { tmpdir } from 'os'

import { default_api } from '../src/api'
import { CommandConfiguration, FullQuestion, QuestionPreview, TaskResult, TaskRun, TaskRunPreview, run_to_preview, task_to_preview } from '../src/models'
import { writeFileSync, existsSync, exists } from 'fs'

global.EventSource = require('eventsource')

const SERVER_PORT = 21680
const SERVER_HOST = '127.0.0.1'
// const SERVER_HOST = 'localhost'
const SERVER_BASE = `http://${SERVER_HOST}:${SERVER_PORT}`

describe('api', () => {
    const api = default_api

    const t1: FullQuestion = {
        task_id: 'some-id',
        question: 'Why are you testing a test framework?',
        level: 2,
        final_answer: 'So we know.',
        file_name: '',
        annotator_metadata: null
    }
    const t2: FullQuestion = {
        task_id: 'some-other-id',
        question: 'Why are you?',
        level: 10,
        final_answer: 'I DON\'T KNOW',
        file_name: '',
        annotator_metadata: null
    }

    const tp1: QuestionPreview = {
        task_id: t1.task_id,
        question: t1.question,
        level: t1.level
    }
    const tp2: QuestionPreview = {
        task_id: t2.task_id,
        question: t2.question,
        level: t2.level
    }

    const cc1: CommandConfiguration = {
        auto_run: true,
        os_mode: false,
        model: 'gpt-21',
        api_base: '',
        api_key: '',
        system_prompt: 'please be nice to me'
    }

    const res1: TaskResult = {
        status: 'correct',
        created: '2000-04-23T10:20:30.100000+02:30',
        actual: '',
        conversation: []
    }

    const r1: TaskRun = {
        id: 'some-run',
        started: '2032-04-23T10:20:30.400000+02:30',
        task: t1,
        command: cc1,
        result: null,
    }
    const r2: TaskRun = {
        id: 'some-other-run',
        started: '2011-04-23T10:20:30.400000+02:30',
        task: t2,
        command: cc1,
        result: null,
    }

    describe('check_connection', () => {
        test('that we\'re good', async () => {
            await run_test_server([], [], [], async () => {
                const result = await api.check_connection(SERVER_BASE, 100)
                expect(result).toEqual(true)
            })
        })
    })

    describe('get_all', () => {
        test('returns nothing when there aren\'t any tasks', async () => {
            await run_test_server([], [], [], async () => {
                const result = await api.get_all(SERVER_BASE)
                expect(result).toEqual([])
            })
        })
        test('returns a list when there are tasks', async () => {
            const expected: QuestionPreview[] = [
                task_to_preview(t1),
                task_to_preview(t2)
            ]
            await run_test_server([t1, t2], [], [], async () => {
                const result = await api.get_all(SERVER_BASE)
                expect(result).toEqual(expected)
            })
        })
    })

    describe('get_single', () => {
        test('that does not exist', async () => {
            await run_test_server([t1, t2], [], [], async () => {
                const result = await api.get_single(SERVER_BASE, 'does-not-exist')
                expect(result).toEqual(undefined)
            })
        })
        test('that exists', async () => {
            await run_test_server([t1, t2], [], [], async () => {
                const result = await api.get_single(SERVER_BASE, 'some-other-id')
                expect(result).toEqual(t2)
            })
        })
    })

    // describe('run_single', () => {
    //     test('non-existent task', async () => {
    //         await run_test_server([t1, t2], [], [], async () => {
    //             const result = await api.run_single(SERVER_BASE, cc1, 'super-fake')
    //             expect(result.status).toEqual('error')
    //         })
    //     })
    //     // test('existing task', async () => {
    //     //     await run_test_server([t1, t2], [res1], [], async () => {
    //     //         const result = await api.run_single(SERVER_BASE, cc1, 'some-id')
    //     //         expect(result).toEqual(res1)
    //     //     })
    //     // })
    // })

    describe('get_all_runs', () => {
        test('no runs', async () => {
            await run_test_server([t1, t2], [], [], async () => {
                const result = await api.get_all_runs(SERVER_BASE)
                expect(result).toEqual([])
            })
        })
        test('some runs', async () => {
            await run_test_server([t1, t2], [], [r1, r2], async () => {
                const result = await api.get_all_runs(SERVER_BASE)
                expect(result).toEqual([
                    run_to_preview(r1),
                    run_to_preview(r2)
                ])
            })
        })
    })

    describe('get_task_runs', () => {
        test('non-existent task', async () => {
            await run_test_server([], [], [], async () => {
                const result = await api.get_task_runs(SERVER_BASE, 'non-existent-id')
                expect(result).toEqual([])
            })
        })
        test('existing task', async () => {
            await run_test_server([t1], [], [r1], async () => {
                const result = await api.get_task_runs(SERVER_BASE, t1.task_id)
                expect(result).toEqual([run_to_preview(r1)])
            })
        })
    })

    describe('get_single_run', () => {
        test('non-existent run', async () => {
            await run_test_server([t1, t2], [], [r2], async () => {
                const result = await api.get_single_run(SERVER_BASE, r1.id)
                expect(result).toEqual(undefined)
            })
        })
        test('existing run', async () => {
            await run_test_server([t1, t2], [], [r1, r2], async () => {
                const result = await api.get_single_run(SERVER_BASE, r2.id)
                expect(result).toEqual(r2)
            })
        })
    })

    describe('invoke', () => {
        test('non-existent task', async () => {
            await run_test_server([t1, t2], [], [], async () => {
                const result = await api.invoke(SERVER_BASE, cc1, 'non-existent-id')
                expect(result).toEqual(undefined)
            })
        })
        test('existing task', async () => {
            await run_test_server([t1, t2], [], [], async () => {
                const result = await api.invoke(SERVER_BASE, cc1, t2.task_id)
                expect(typeof result).toEqual('string')
            })
        })
    })

    describe('check_runs/invoke', () => {
        test('single run', async () => {
            await run_test_server([t1, t2], [res1], [], async () => {
                const es = api.check_runs(SERVER_BASE)
                const run_id = await api.invoke(SERVER_BASE, cc1, t1.task_id)

                const events = await accumulate(es, 2)
                expect(events).toEqual([
                    { tag: 'started', run_id },
                    { tag: 'finished', run_id, result: res1.status }
                ])

                es.close()
            })
        })
        test('a bunch of runs', async () => {
            await run_test_server([t1, t2], [res1], [], async () => {
                // looks like there's a race condition here booooo.
                // moving the calls to invoke after check_runs causes
                // the server to shut down before all the events have
                // accumulated.
                // I don't know why this happens but I'm sad about it.
                const run1_id = await api.invoke(SERVER_BASE, cc1, t1.task_id)
                const run2_id = await api.invoke(SERVER_BASE, cc1, t2.task_id)
                const es = api.check_runs(SERVER_BASE)

                const events = await accumulate(es, 4)
                expect(events).toEqual([
                    { tag: 'started', run_id: run1_id },
                    { tag: 'finished', run_id: run1_id, result: res1.status },
                    { tag: 'started', run_id: run2_id },
                    { tag: 'finished', run_id: run2_id, result: res1.status }
                ])

                es.close()
            })
        })
    })
})

const accumulate = (es: EventSource, n_events: number) => new Promise<any[]>((resolve, reject) => {
    const events: any[] = []

    if (n_events <= 0)
        return resolve([])

    es.onmessage = async (e) => {
        const data = JSON.parse(e.data)
        console.log('received!', data)
        events.push(data)
        if (events.length >= n_events) {
            es.onerror = null
            es.onmessage = null
            return resolve(events)
        }
    }
    es.onerror = (e) => {
        es.onerror = null
        es.onmessage = null
        return reject(e)
    }
})

const run_test_server = async (tasks: FullQuestion[], results: TaskResult[], runs: TaskRun[], f: () => void) => {
    const tmp_dir = tmpdir()
    const tasks_path = `${tmp_dir}/tasks.json`
    const results_path = `${tmp_dir}/results.json`
    const runs_path = `${tmp_dir}/runs.json`

    try {
        writeFileSync(tasks_path, JSON.stringify(tasks)),
        writeFileSync(results_path, JSON.stringify(results))
        writeFileSync(runs_path, JSON.stringify(runs))
    } catch (e) {
        console.log('error writing files!')
    }

    console.log('tasks file exists:', existsSync(tasks_path))
    console.log('runs file exists:', existsSync(runs_path))
    let p: ChildProcessWithoutNullStreams | undefined = undefined

    return new Promise<void>((resolve, reject) => {
        const server_path = '../py/run_server.py'
        console.log('python file exists:', existsSync(server_path))
        const [cmd, args] = [`python`, [server_path, '--port', SERVER_PORT.toString(), '--tasks', tasks_path, '--results', results_path, '--runs', runs_path]]
        console.log('cmd:', cmd)
        console.log('args:', args)
        p = spawn(cmd, args)

        p.stdout.on('data', (data) => {
            console.log('stdout data', data.toString())
        })

        p.stderr.on('data', (data) => {
            console.log('stderror data', data.toString())
            if (data.includes('Application startup complete.'))
                try {
                    // I don't know why this is coming in through stderr but it's fine.
                    f()
                    resolve()
                } catch (e) {
                    console.log('error in function!', e)
                }
        })

        p.on('error', (e) => {
            console.log('error', e)
            reject()
        })

        p.on('exit', (exit_code) => {
            console.log('exit', exit_code)
            if (exit_code === 0)
                resolve()
            else
                reject()
        })

        p.on('close', (exit_code) => {
            console.log('close', exit_code)
            if (exit_code === 0)
                resolve()
            else
                reject()
        })
    })
    .finally(() => {
        console.log('killing process')
        if (p?.pid !== undefined)
            return killProcess(p.pid)
    })
}

// definitely from ChatGPT thanks.
function killProcess(pid: number) {
    return new Promise((resolve, reject) => {
      const processToKill = process;
  
      // Check if the process exists and try to kill it
      try {
        process.kill(pid, 'SIGTERM');
      } catch (err) {
        if (err.code === 'ESRCH') {
          console.log('Process not found, it may have already exited.');
          resolve('Process not found, may already be exited.');
        } else {
          console.error('Error sending SIGTERM:', err);
          reject(err);
        }
        return;
      }
  
      // Set a timeout for force kill
      const killTimeout = setTimeout(() => {
        try {
          process.kill(pid, 'SIGKILL');
        } catch (err) {
          if (err.code === 'ESRCH') {
            console.log('Process not found when trying to SIGKILL.');
            resolve('Process not found on SIGKILL.');
          } else {
            console.error('Error sending SIGKILL:', err);
            reject(err);
          }
        }
      }, 5000); // 5000 ms = 5 seconds
  
      // Listener for the exit event
      processToKill.on('exit', (code, signal) => {
        clearTimeout(killTimeout); // Clear the SIGKILL timeout
        console.log(`Process exited with code ${code} and signal ${signal}`);
        resolve(`Exited with code ${code} and signal ${signal}`);
      });
    });
  }
