import requests
import sseclient
from typing import List, Optional
from pydantic import TypeAdapter

from models import CommandConfiguration, FullTask, TaskPreview, TaskResult, TaskRun, TaskRunPreview


# check_connection: (base: string, timeout_ms: number) => Promise<boolean>
def check_connection(base: str, timeout_ms: int = 5000) -> bool:
    response = requests.get(f"{base}/gaia/check-connection", timeout=timeout_ms / 1000)
    return response.json() == "good"

# get_single: (base: string, task_id: string, abort_controller?: AbortController) => Promise<FullQuestion | undefined>
def get_single(base: str, task_id: str) -> FullTask:
    response = requests.get(f"{base}/gaia/tasks/{task_id}")
    return TypeAdapter(FullTask).validate_python(response.json())

# get_all: (base: string) => Promise<QuestionPreview[]>
def get_all(base: str) -> List[TaskPreview]:
    response = requests.get(f"{base}/gaia/tasks")
    return TypeAdapter(List[TaskPreview]).validate_python(response.json())

# run_single: (base: string, command: CommandConfiguration, task_id: string, abort_controller?: AbortController) => Promise<TaskResult>
def run_single(base: str, command: CommandConfiguration, task_id: str) -> TaskResult:
    json = {
        "command": command.model_dump(),
        "task_id": task_id
    }
    headers = { "Content-Type": "application/json" }
    response = requests.post(f"{base}/gaia/invoke-task", json=json, headers=headers)
    return TypeAdapter(TaskResult).validate_python(response.json())

# get_all_runs: (base: string, abort_controller?: AbortController) => Promise<TaskRunPreview[]>
def get_all_runs(base: str) -> List[TaskRunPreview]:
    ...

# get_task_runs: (base: string, task_id: string, abort_controller?: AbortController) => Promise<TaskRunPreview[]>
def get_task_run(base: str, task_id: str) -> List[TaskRunPreview]:
    ...

# get_single_run: (base: string, run_id: string, abort_controller?: AbortController) => Promise<TaskRun | undefined>
def get_single_run(base: str, run_id: str) -> Optional[TaskRun]:
    ...

# // returns the run's id if it was successfully created, and undefined if it wasn't for some reason.
# invoke: (base: string, command: CommandConfiguration, task_id: string, abort_controller?: AbortController) => Promise<string | undefined>
def invoke(base: str, command: CommandConfiguration, task_id: str) -> Optional[str]:
    json = {
        "task_id": task_id,
        "command": command.model_dump()
    }
    headers = { "Content-Type": "application/json" }
    response = requests.post(f"{base}/invoke", json=json, headers=headers)
    
    return response.text

# invoke_all: (base: string, command: CommandConfiguration) => Promise<void>
def invoke_all(base: str, command: CommandConfiguration):
    ...
