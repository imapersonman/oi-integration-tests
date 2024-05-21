import re
import traceback
from abc import ABC, abstractmethod
from typing import List, cast
from interpreter import OpenInterpreter

from models import TR, CommandConfiguration, FullTask, TaskResult


def interpreter_from_command(cmd: CommandConfiguration) -> OpenInterpreter:
    interpreter = OpenInterpreter(import_computer_api=True)
    interpreter.llm.model = cmd.model if cmd.model != "" else interpreter.llm.model
    interpreter.llm.api_base = cmd.api_base if cmd.api_base != "" else interpreter.llm.api_base
    interpreter.llm.api_key = cmd.api_key if cmd.api_key != "" else interpreter.llm.api_key
    interpreter.auto_run = cmd.auto_run
    interpreter.os = cmd.os_mode
    interpreter.custom_instructions = cmd.system_prompt
    return interpreter


class TaskRunner(ABC):
    @abstractmethod
    def run(self, command: CommandConfiguration, task: FullTask) -> TaskResult:
        ...


class FakeTaskRunner(TaskRunner):
    def __init__(self, results: List[TaskResult]):
        self.current_index = 0
        self.results = results
    
    def run(self, command: CommandConfiguration, task: FullTask) -> TaskResult:
        if self.current_index >= len(self.results):
            raise RuntimeError(f"Used up all {len(self.results)} results!")
        return self.results[self.current_index]


class DefaultTaskRunner(TaskRunner):
    def run(self, command: CommandConfiguration, task: FullTask) -> TaskResult:
        interpreter = interpreter_from_command(command)

        file_path = f"files/{task.file_name}"
        prompt = task.question
        if file_path != '':
            prompt = f"file_path:{file_path}\n{prompt}"

        try:
            output = cast(List, interpreter.chat(prompt, display=True, stream=False))
        except KeyboardInterrupt:
            print("KeyboardInterrupt!")
            output = [*interpreter.messages, { "role": "error", "content": "KeyboardInterrupt" }]
        except Exception as e:
            trace = traceback.format_exc()
            output = [*interpreter.messages, { "role": "error", "content": trace }]
            return TR.error(str(e), output)
        finally:
            interpreter.computer.terminate()

        final_message = output[-1]["content"]
        final_answer_re = re.search("FINAL ANSWER: (.+)", final_message)
        if final_answer_re is None:
            return TR.not_found(output)

        final_answer = final_answer_re.group(1).strip().lower()
        if final_answer == task.final_answer.lower():
            return TR.correct(task.final_answer, output)
        else:
            return TR.incorrect(task.final_answer, final_answer, output)
    