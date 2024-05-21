from datetime import datetime
from abc import ABC
from typing import Any, Dict, List, Literal, Optional, TypedDict, Union
import uuid
from pydantic import BaseModel, Field


class TaskPreview(BaseModel):
    task_id: str
    level: int
    question: str


class AnnotatorMetadata(BaseModel):
    steps: str
    number_of_steps: str
    length_of_time: str
    tools: str
    number_of_tools: str


class FullTask(TaskPreview):
    final_answer: str
    file_name: str
    annotator_metadata: Optional[AnnotatorMetadata]

    @staticmethod
    def from_gaia_task(e: Dict[str, Any]) -> "FullTask":
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

    def to_preview(self) -> TaskPreview:
        return self.model_copy()


TaskResultStatus = Union[
    Literal["correct"],
    Literal["incorrect"],
    Literal["not-found"],
    Literal["error"]
]


class TR:
    @staticmethod
    def correct(actual: str, conversation: List[Dict]) -> "CorrectTaskResult":
        return CorrectTaskResult(
            status="correct",
            actual=actual,
            conversation=conversation
        )
    
    @staticmethod
    def incorrect(expected: str, actual: str, conversation: List[Dict]) -> "IncorrectTaskResult":
        return IncorrectTaskResult(
            status="incorrect",
            expected=expected,
            actual=actual,
            conversation=conversation
        )
    
    @staticmethod
    def not_found(conversation: List[Dict]) -> "NotFoundTaskResult":
        return NotFoundTaskResult(
            status="not-found",
            conversation=conversation
        )
    
    @staticmethod
    def error(message: str, conversation: List[Dict]) -> "ErrorTaskResult":
        return ErrorTaskResult(
            status="error",
            message=message,
            conversation=conversation
        )


class CorrectTaskResult(BaseModel):
    status: Literal["correct"] = "correct"
    created: datetime = datetime.now()
    actual: str
    conversation: List[Dict]


class IncorrectTaskResult(BaseModel):
    status: Literal["incorrect"] = "incorrect"
    created: datetime = datetime.now()
    expected: str
    actual: str
    conversation: List[Dict]


class NotFoundTaskResult(BaseModel):
    status: Literal["not-found"] = "not-found"
    created: datetime = datetime.now()
    conversation: List[Dict]


class ErrorTaskResult(BaseModel):
    status: Literal["error"] = "error"
    created: datetime = datetime.now()
    message: str
    conversation: List[Dict]


TaskResult = Union[
    CorrectTaskResult,
    IncorrectTaskResult,
    NotFoundTaskResult,
    ErrorTaskResult
]


class CommandConfiguration(BaseModel):
    auto_run: bool
    os_mode: bool
    model: str
    api_base: str
    api_key: str
    system_prompt: str


class TaskRunRequest(BaseModel):
    command: CommandConfiguration
    task_id: str


class TaskRunPreview(BaseModel):
    id: str
    task: TaskPreview
    started: datetime
    result: Optional[TaskResultStatus]
    finished: Optional[datetime]


class TaskRun(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    started: datetime = datetime.now()
    task: FullTask
    command: CommandConfiguration
    # if a result is None, then the task is still running.
    result: Optional[TaskResult]

    def to_preview(self) -> TaskRunPreview:
        status, finished = (self.result.status, self.result.created) if self.result is not None else (None, None)
        return TaskRunPreview(
            id=self.id,
            task=self.task,
            started=self.started,
            result=status,
            finished=finished
        )


class QueryAll(BaseModel):
    tag: Literal["all"] = "all"


class QueryWithTasks(BaseModel):
    tag: Literal["tasks"] = "tasks"
    ids: List[uuid.UUID]


RunQuery = QueryAll | QueryWithTasks
TaskQuery = QueryAll


class TaskStarted(TypedDict):
    tag: Literal["started"]
    run_id: str


class TaskFinished(TypedDict):
    tag: Literal["finished"]
    run_id: str
    result: TaskResultStatus


TaskUpdate = Union[
    TaskStarted,
    TaskFinished,
]
