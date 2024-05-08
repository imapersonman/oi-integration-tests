from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from runner import TaskRunner
from store import TaskRunStore, TaskStore
from models import CommandConfiguration, FullTask, TaskPreview, TaskResult, TaskRun, TaskRunPreview, TaskRunRequest


app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"]
)

tstore = TaskStore()
runner = TaskRunner()
rstore = TaskRunStore("runs")


@app.get("/gaia/tasks")
def get_all() -> List[TaskPreview]:
    return tstore.get_all()


@app.post("/gaia/run")
def run_single(request: TaskRunRequest) -> TaskResult:
    task = tstore.get_single(request.task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task doesn't exist!")
    else:
        run = rstore.start(task, request.command)
        result = runner.run(request.command, task)
        rstore.finish(run, result)
        return result


@app.get("/gaia/runs")
def get_all_runs() -> List[TaskRunPreview]:
    print('getting all runs!')
    return rstore.get_previews()


@app.get("/gaia/runs/{run_id}")
def get_single_run(run_id: str) -> TaskRun:
    print("getting single run!", run_id)
    run = rstore.get(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Task run doesn't exist!")
    else:
        return run


@app.get("/gaia/tasks/{task_id}")
def get_single(task_id: str) -> Optional[FullTask]:
    print("getting single task!", task_id)
    return tstore.get_single(task_id)


@app.get("/gaia/tasks/{task_id}/runs")
def get_task_runs(task_id: str) -> List[TaskRunPreview]:
    print("getting all runs for task!", task_id)
    task = tstore.get_single(task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task doesn't exist!")
    else:
        return rstore.get_task_runs(task)
