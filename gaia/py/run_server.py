import argparse
import json
import os
from typing import List, Optional
import uvicorn
from fastapi_server import Server
from models import FullTask, TaskResult, TaskRun
from store import DefaultTaskRunStore, DefaultTaskStore, MemoryTaskRunStore, MemoryTaskStore, TaskRunStore, TaskStore
from runner import DefaultTaskRunner, FakeTaskRunner, TaskRunner
from pydantic import TypeAdapter


def make_task_store(tasks_path: Optional[str]) -> TaskStore:
    if tasks_path is None:
        return DefaultTaskStore()

    with open(tasks_path) as file:
        js = json.load(file)
        os = TypeAdapter(List[FullTask]).validate_python(js)
        return MemoryTaskStore(os)


def make_task_runner(result_path: Optional[str]) -> TaskRunner:
    if result_path is None:
        return DefaultTaskRunner()
    
    with open(result_path) as file:
        js = json.load(file)
        os = TypeAdapter(List[TaskResult]).validate_python(js)
        return FakeTaskRunner(os)


def make_task_runs_store(runs_path: Optional[str]) -> TaskRunStore:
    if runs_path is None:
        return DefaultTaskRunStore("runs")

    with open(runs_path) as file:
        js = json.load(file)
        os = TypeAdapter(List[TaskRun]).validate_python(js)
        print('objects', os)
        return MemoryTaskRunStore(os)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--tasks", type=str)
    parser.add_argument('--results', type=str)
    parser.add_argument("--runs", type=str)
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()

    tasks = make_task_store(args.tasks)
    runner = make_task_runner(args.results)
    runs = make_task_runs_store(args.runs)

    app = Server(tasks, runner, runs).make_app()
    uvicorn.run(app, port=args.port)
   