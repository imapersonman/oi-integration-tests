import csv
from dataclasses import dataclass
import io
from queue import Queue
from threading import Thread
from abc import ABC, abstractmethod
from datetime import datetime
import traceback
from typing import Callable, Dict, Generic, List, Literal, NotRequired, Tuple, TypeVar, TypedDict, cast

from interpreter import OpenInterpreter


Task = TypeVar("Task")
LMC = Dict[str, str]
ResultStatus = Literal["correct", "incorrect", "unknown", "error"]


class ZeroShotTask(TypedDict):
    id: str
    prompt: str


class OpenInterpreterCommand(TypedDict):
    auto_run: NotRequired[bool]
    os_mode: NotRequired[bool]
    model: NotRequired[str]
    context_window: NotRequired[int]
    api_base: NotRequired[str]
    api_key: NotRequired[str]
    custom_instructions: NotRequired[str]


def command_to_interpreter(cmd: OpenInterpreterCommand) -> OpenInterpreter:
    interpreter = OpenInterpreter(import_computer_api=True)
    interpreter.llm.model = cmd.get("model", interpreter.llm.model)  # type: ignore
    interpreter.llm.context_window = cmd.get("context_window", interpreter.llm.context_window)  # type: ignore
    interpreter.llm.api_base = cmd.get("api_base", interpreter.llm.api_base)  # type: ignore
    interpreter.llm.api_key = cmd.get("api_key", interpreter.llm.api_key)  # type: ignore
    interpreter.auto_run = cmd.get("auto_run", interpreter.auto_run)  # type: ignore
    interpreter.os = cmd.get("os_mode", interpreter.os)  # type: ignore
    interpreter.custom_instructions = cmd.get("custom_instructions", interpreter.custom_instructions)  # type: ignore
    return interpreter


class TaskResult(TypedDict):
    task_id: str
    command: OpenInterpreterCommand
    prompt: str
    start: datetime
    end: datetime
    messages: List[LMC]
    status: ResultStatus


@dataclass
class Benchmark(Generic[Task]):
    get_tasks: Callable[[], List[Task]]
    task_to_id_prompt: Callable[[Task], ZeroShotTask]
    task_result_status: Callable[[Task, List[LMC]], ResultStatus]


class BenchmarkRunner(ABC):
    @abstractmethod
    def run(self, command: OpenInterpreterCommand, prompt: str) -> List[LMC]:
        ...


class DefaultBenchmarkRunner(BenchmarkRunner):
    def run(self, command: OpenInterpreterCommand, prompt: str) -> Tuple[datetime, List[LMC], datetime]:
        interpreter = command_to_interpreter(command)
        start = datetime.now()

        try:
            output = cast(List, interpreter.chat(prompt, stream=False))
        except KeyboardInterrupt:
            output = [*interpreter.messages, { "role": "error", "content": "KeyboardInterrupt" }]
        except Exception as e:
            trace = traceback.format_exc()
            output = [*interpreter.messages, { "role": "error", "content": trace }]
        finally:
            end = datetime.now()
            interpreter.computer.terminate()
            return start, output, end


def run_benchmark(benchmark: Benchmark, command: OpenInterpreterCommand) -> List[TaskResult]:
    all_tasks = benchmark.get_tasks()
    runner = DefaultBenchmarkRunner()
    results: List[TaskResult] = []

    print(f"Running {len(all_tasks)} task(s)...")

    for task in all_tasks:
        zstask = benchmark.task_to_id_prompt(task)

        print(f"  Running task {zstask["id"]}...", end=" ")
        start, messages, end  = runner.run(command, zstask["prompt"])

        status = benchmark.task_result_status(task, messages)
        result: TaskResult = {
            "task_id": zstask["id"],
            "command": command,
            "prompt": zstask["prompt"],
            "start": start,
            "end": end,
            "status": status,
            "messages": messages,
        }
        # print(f"  done: {result}")

        results.append(result)

    print("done!")

    return results


def run_benchmark_threaded(benchmark: Benchmark[Task], command: OpenInterpreterCommand, n_threads: int = 2) -> List[TaskResult]:
    all_tasks = benchmark.get_tasks()
    runner = DefaultBenchmarkRunner()
    results: Queue[TaskResult] = Queue()
    threads: List[Tuple[Queue, Thread]] = []

    def run_task(task_queue: Queue):
        # THERE IS A RACE CONDITION -- check if empty, then get will NOT work.  Should be atomic op.
        # actually jk this isn't a problem because tasks are assigned before any threads are started,
        # and we aren't assigning anything after thread creation.
        # YES I am cheating but it's fine.
        while not task_queue.empty():
            task = task_queue.get()
            zstask = benchmark.task_to_id_prompt(task)
            start, messages, end = runner.run(command, zstask["prompt"])
            status = benchmark.task_result_status(task, messages)
            results.put({
                "task_id": zstask["id"],
                "command": command,
                "prompt": zstask["prompt"],
                "start": start,
                "end": end,
                "messages": messages,
                "status": status
            })

    print(f"Setting up {n_threads} threads...", end=" ")

    # setting up threads.
    for _ in range(0, n_threads):
        q = Queue()
        threads.append((q, Thread(target=run_task, args=(q,))))
    
    print("done!")
    print(f"Assigning {len(all_tasks)} tasks to {n_threads} threads...", end=" ")
    
    # assigning tasks to threads in a round-robin manner.
    th_index = 0
    for task in all_tasks:
        q, _ = threads[th_index]
        q.put(task)
        th_index = (th_index + 1) % n_threads
    
    print("done!")
    print(f"Starting {n_threads} threads...")
    
    # starting threads.
    for q, th in threads:
        th.start()
        print(f"  Started thread with {q.qsize()} tasks.")
    
    print("done!")
    print(f"Running {len(all_tasks)} tasks across {n_threads} threads...", end=" ")

    # joining threads.
    for _, th in threads:
        th.join()
    
    print("done!")

    return list(results.queue)