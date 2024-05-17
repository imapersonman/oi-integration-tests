from asyncio import Queue
import json
from typing import List, Literal, Optional
from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from runner import DefaultTaskRunner, TaskRunner
from store import DefaultTaskRunStore, DefaultTaskStore, TaskRunStore, TaskStore
from models import CommandConfiguration, FullTask, RunQuery, TaskFinished, TaskPreview, TaskResult, TaskRun, TaskRunPreview, TaskRunRequest, TaskStarted, TaskUpdate


"""
GET /gaia
top-level description of the dataset.
does NOT include task or run specific information,
but may include info concerning
  - total number of tasks/runs,
  - name of the dataset,
  - where the dataset originates from,
  - links to papers describing the dataset, and
  - links to tasks or runs.

POST /gaia/runs
body { query: { tag: 'all' } | { tag: 'for-tasks', ids: string[] } }
resp TaskRunPreview[]

GET /gaia/runs/{run_id}

POST /gaia/tasks
body { query: { tag: 'all' } }
resp TaskPreview[]

GET /gaia/tasks/{task_id}

POST /gaia/invoke
body { task_id: string, command: CommandConfiguration }
resp TaskResult
"""


"""
ideal:
GET /runs
GET /runs/{run_id}
POST /invoke
"""


class Server:
    def __init__(self, tasks: TaskStore, runner: TaskRunner, runs: TaskRunStore):
        self.tasks = tasks
        self.runner = runner
        self.runs = runs
        self.updates: Queue[TaskUpdate] = Queue()

    def make_app(self) -> FastAPI:
        app = FastAPI()
        app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_methods=["*"]
        )

        @app.get("/gaia/tasks")
        async def get_all() -> List[TaskPreview]:
            return self.tasks.get_all()
        
        @app.get("/gaia/tasks/{task_id}")
        async def get_single(task_id: str) -> Optional[FullTask]:
            print("getting single task!", task_id)
            task = self.tasks.get_single(task_id)
            if task is None:
                raise HTTPException(status_code=404, detail="Task not found!")
            return self.tasks.get_single(task_id)

        # @app.post("/gaia/invoke")
        # def run_single(request: TaskRunRequest) -> TaskResult:
        #     task = self.tasks.get_single(request.task_id)
        #     if task is None:
        #         raise HTTPException(status_code=404, detail="Task doesn't exist!")
        #     else:
        #         run = self.runs.start(task, request.command)
        #         result = self.runner.run(request.command, task)
        #         self.runs.finish(run, result)
        #         return result

        @app.get("/gaia/runs")
        async def get_all_runs() -> List[TaskRunPreview]:
            print('getting all runs!')
            return self.runs.get_previews()

        @app.get("/gaia/runs/{run_id}")
        async def get_single_run(run_id: str) -> TaskRun:
            print("getting single run!", run_id)
            run = self.runs.get(run_id)
            if run is None:
                raise HTTPException(status_code=404, detail="Task run doesn't exist!")
            else:
                return run

        @app.get("/gaia/tasks/{task_id}/runs")
        async def get_task_runs(task_id: str) -> List[TaskRunPreview]:
            print("getting all runs for task!", task_id)
            task = self.tasks.get_single(task_id)
            if task is None:
                raise HTTPException(status_code=404, detail="Task doesn't exist!")
            else:
                return self.runs.get_task_runs(task)
        
        async def run_task(run: TaskRun):
            await self.updates.put({"tag": "started", "run_id": run.id})
            result = self.runner.run(run.command, run.task)
            await self.updates.put({"tag": "finished", "run_id": run.id, "result": result.status})
            self.runs.finish(run, result)
        
        @app.post("/gaia/invoke-task")
        async def invoke_task(request: TaskRunRequest) -> TaskResult:
            task = self.tasks.get_single(request.task_id)
            if task is None:
                raise HTTPException(status_code=404, detail="Task doesn't exist!")
            else:
                run = self.runs.start(task, request.command)
                result = self.runner.run(run.command, run.task)
                self.runs.finish(run, result)
                return result
        
        @app.post("/gaia/invoke")
        async def invoke(request: TaskRunRequest, bg_tasks: BackgroundTasks) -> str:
            print("trying to invoke!")
            task = self.tasks.get_single(request.task_id)
            if task is None:
                raise HTTPException(status_code=404, detail="Task doesn't exist!")
            else:
                run = self.runs.start(task, request.command)
                bg_tasks.add_task(run_task, run)
                return run.id
        
        async def update_events():
            try:
                while True:
                    update = await self.updates.get()
                    data = f"data: {json.dumps(update)}\n\n"
                    yield data
            except GeneratorExit:
                ...
        
        @app.get("/gaia/check-runs")
        def check_runs():
            return StreamingResponse(update_events(), media_type="text/event-stream")

        @app.get("/gaia/check-connection")
        def check_connection() -> Literal["good"]:
            return "good"
        
        return app


# tstore = DefaultTaskStore()
# runner = DefaultTaskRunner()
# rstore = DefaultTaskRunStore("runs")
# app = Server(tstore, runner, rstore).make_app()
