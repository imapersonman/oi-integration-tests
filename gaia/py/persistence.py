from abc import ABC
from dataclasses import dataclass, fields, asdict
from datetime import datetime
from typing import Any, Dict, List, Literal, TypedDict, Union

from interpreter import OpenInterpreter


@dataclass
class CommandConfiguration:
    auto_run: bool
    os_mode: bool
    model: str
    api_base: str
    api_key: str
    system_prompt: str

    @classmethod
    def from_dict(cls, data: Dict) -> "CommandConfiguration":
        # Extract field names to ensure we're only passing valid fields to the constructor
        field_names = {field.name for field in fields(cls)}
        valid_data = {k: v for k, v in data.items() if k in field_names}
        return cls(**valid_data)
    
    def to_dict(self) -> Dict:
        return asdict(self)

    def to_interpreter(self):
        interpreter = OpenInterpreter(import_computer_api=True)
        interpreter.llm.model = self.model if self.model != "" else interpreter.llm.model
        interpreter.llm.api_base = self.api_base if self.api_base != "" else interpreter.llm.api_base
        interpreter.llm.api_key = self.api_key if self.api_key != "" else interpreter.llm.api_key
        interpreter.auto_run = self.auto_run
        interpreter.os = self.os_mode
        interpreter.custom_instructions = self.system_prompt
        return interpreter


class CorrectTaskResult(TypedDict):
    status: Literal["correct"]
    actual: str


class IncorrectTaskResult(TypedDict):
    status: Literal["incorrect"]
    expected: str
    actual: str


class NotFoundTaskResult(TypedDict):
    status: Literal["not-found"]


class ErrorTaskResult(TypedDict):
    status: Literal["error"]


TaskResult = Union[
    CorrectTaskResult,
    IncorrectTaskResult,
    NotFoundTaskResult,
    ErrorTaskResult
]


@dataclass
class TaskRun:
    task: Any
    result: TaskResult
    command: CommandConfiguration
    conversation: List
    created: datetime = datetime.now()


class TestRunnerRoot:
    def __init__(self):
        self.runs: List[TaskRun] = []
