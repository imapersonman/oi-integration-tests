from abc import ABC, abstractmethod
from contextlib import contextmanager
import shelve
import uuid
import ds
from typing import Any, Dict, List, Optional, TypedDict, cast
from models import AnnotatorMetadata, CommandConfiguration, FullTask, TaskPreview, TaskResult, TaskRun, TaskRunPreview


class TaskStore(ABC):
    @abstractmethod
    def get_all(self) -> List[TaskPreview]:
        ...
    
    @abstractmethod
    def get_single(self, task_id: str) -> Optional[FullTask]:
        ...


class MemoryTaskStore(TaskStore):
    def __init__(self, tasks: List[FullTask]):
        self.tasks = tasks
    
    def get_all(self) -> List[TaskPreview]:
        return [t.to_preview() for t in self.tasks]
    
    def get_single(self, task_id: str) -> Optional[FullTask]:
        for t in self.tasks:
            if t.task_id == task_id:
                return t
        return None


class DefaultTaskStore(TaskStore):
    def __init__(self):
        self.validation = ds.all_of_the_validation_tests()

    def get_all(self) -> List[TaskPreview]:
        data = ds.pull_out(self.validation, ["task_id", "Level", "Question"])
        previews = []
        for d in data:
            p = TaskPreview(task_id=d["task_id"], level=d["Level"], question=d["Question"])
            previews.append(p)
        return previews

    def get_single(self, task_id: str) -> Optional[FullTask]:
        for entry in self.validation:
            e: Any = entry
            if e["task_id"] == task_id:
                am = e["Annotator Metadata"]
                return FullTask(
                    task_id=e["task_id"],
                    level=e["Level"],
                    question=e["Question"],
                    final_answer=e["Final answer"],
                    file_name=e["file_name"],
                    annotator_metadata=AnnotatorMetadata(
                        steps=am["Steps"],
                        number_of_steps=am["Number of steps"],
                        length_of_time=am["How long did this take?"],
                        tools=am["Tools"],
                        number_of_tools=am["Number of tools"]
                    )
                )
        return None


class TaskRunStoreShelfSchema(TypedDict):
    # The keys should be string versions of UUIDs.
    runs: Dict[str, TaskRun]


@contextmanager
def open_shelf(file_path: str, *args, **kwargs):
    shelf = shelve.open(file_path, *args, **kwargs)
    yield cast(TaskRunStoreShelfSchema, shelf)
    shelf.close()


class TaskRunStore(ABC):
    @abstractmethod
    def start(self, task: FullTask, command: CommandConfiguration) -> TaskRun:
        ...

    @abstractmethod
    def finish(self, run: TaskRun, result: TaskResult):
        ...
    
    @abstractmethod
    def get(self, id: str) -> TaskRun:
        ...
    
    @abstractmethod
    def get_previews(self) -> List[TaskRunPreview]:
        ...
    
    @abstractmethod
    def get_task_runs(self, task: FullTask) -> List[TaskRunPreview]:
        ...


class MemoryTaskRunStore(TaskRunStore):
    def __init__(self, runs: List[TaskRun]):
        self.runs = runs
    
    def start(self, task: FullTask, command: CommandConfiguration) -> TaskRun:
        r = TaskRun(task=task, command=command, result=None)
        self.runs.append(r)
        return r

    def finish(self, run: TaskRun, result: TaskResult):
        ...
    
    def get(self, id: str) -> Optional[TaskRun]:
        for tr in self.runs:
            if tr.id == id:
                return tr
        return None
    
    def get_previews(self) -> List[TaskRunPreview]:
        return [r.to_preview() for r in self.runs]
    
    def get_task_runs(self, task: FullTask) -> List[TaskRunPreview]:
        return [r.to_preview() for r in self.runs if r.task.task_id == task.task_id]


class DefaultTaskRunStore(TaskRunStore):
    def __init__(self, path: str):
        self.path = path
        self.__create_store_if_missing()

    def start(self, task: FullTask, command: CommandConfiguration) -> TaskRun:
        with open_shelf(self.path, "w") as store:
            run = TaskRun(task=task, command=command, result=None)
            store["runs"] = {**store["runs"], run.id: run}
            return run
    
    def finish(self, run: TaskRun, result: TaskResult):
        with open_shelf(self.path, "w") as store:
            stored_run = store["runs"].get(run.id)
            if stored_run is None:
                print(dict(store))
                raise RuntimeError("Not found!!")
            stored_run.result = result
            store["runs"] = {**store["runs"], run.id: stored_run}
    
    def get(self, id: str) -> TaskRun:
        with open_shelf(self.path, "r") as store:
            return store["runs"][id]
    
    def get_previews(self) -> List[TaskRunPreview]:
        with open_shelf(self.path, "c") as store:
            runs = store["runs"]
            previews = [f.to_preview() for f in runs.values()]
            return previews
    
    def get_task_runs(self, task: FullTask) -> List[TaskRunPreview]:
        with open_shelf(self.path, "r") as store:
            runs = cast(Dict[uuid.UUID, TaskRun], store["runs"])
            previews = (f.to_preview() for f in runs.values())
            task_previews = [p for p in previews if p.task.task_id == task.task_id]
            return task_previews

    def __create_store_if_missing(self):
        with open_shelf(self.path, "c") as store:
            if store.get("runs") is None:
                store["runs"] = {}
