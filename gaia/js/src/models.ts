import { z } from "zod"

interface Configuration {
    connection: ConnectionConfiguration
    command: CommandConfiguration
}

export interface ConnectionConfiguration {
    host: string
    post: string
}

export const CommandConfiguration = z.object({
    auto_run: z.boolean(),
    os_mode: z.boolean(),
    model: z.string(),
    api_base: z.string(),
    api_key: z.string(),
    system_prompt: z.string()
})

export type CommandConfiguration = z.infer<typeof CommandConfiguration>

export const QuestionPreview = z.object({
    task_id: z.string(),
    level: z.number(),
    question: z.string()
})

export type QuestionPreview = z.infer<typeof QuestionPreview>

export const AnnotatorMetadata = z.nullable(z.object({
    steps: z.string(),
    number_of_steps: z.number(),
    length_of_time: z.string(),
    tools: z.string(),
    number_of_tools: z.string()
}))

export type AnnotatorMetadata = z.infer<typeof AnnotatorMetadata>

export const FullQuestion = z.object({
    task_id: z.string(),
    question: z.string(),
    level: z.number(),
    final_answer: z.string(),
    file_name: z.string(),
    annotator_metadata: AnnotatorMetadata.nullable()
})

export const task_to_preview = (t: FullQuestion): QuestionPreview => ({
    task_id: t.task_id,
    level: t.level,
    question: t.question
})

export type FullQuestion = z.infer<typeof FullQuestion>

export const TaskResultStatus = z.union([z.literal('correct'), z.literal('incorrect'), z.literal('not-found'), z.literal('error')])

export type TaskResultStatus = z.infer<typeof TaskResultStatus>

export const TaskResult = z.union([
    z.object({ status: z.literal('correct'), created: z.string(), actual: z.string(), conversation: z.array(z.record(z.string(), z.string())) }),
    z.object({ status: z.literal('incorrect'), created: z.string(), expected: z.string(), actual: z.string(), conversation: z.array(z.record(z.string(), z.string())) }),
    z.object({ status: z.literal('not-found'), created: z.string(), conversation: z.array(z.record(z.string(), z.string())) }),
    z.object({ status: z.literal('error'), created: z.string() })
])

export type TaskResult = z.infer<typeof TaskResult>

export const TaskRunPreview = z.object({
    id: z.string(),
    task: QuestionPreview,
    started: z.string(),
    result: TaskResultStatus.nullable(),
    finished: z.string().nullable()
})

export type TaskRunPreview = z.infer<typeof TaskRunPreview>

export const TaskRun = z.object({
    id: z.string(),
    started: z.string(),
    task: FullQuestion,
    command: CommandConfiguration,
    // conversation: z.array(z.record(z.string(), z.string())),
    result: TaskResult.nullable()
})

export const run_to_preview = (tr: TaskRun): TaskRunPreview => ({
    id: tr.id,
    task: task_to_preview(tr.task),
    started: tr.started,
    result: tr.result?.status ?? null,
    finished: tr.result?.created ?? null
})

export type TaskRun = z.infer<typeof TaskRun>

export interface QueryAll { tag: 'all' }
export interface QueryWithTasks {
    tag: 'tasks'
    ids: string[]
}
