import re
from typing import List, cast
import ds
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


class TaskRunner:
    def run(self, command: CommandConfiguration, task: FullTask) -> TaskResult:
        interpreter = interpreter_from_command(command)

        file_path = f"files/{task.file_name}"
        prompt = f"file_path:{file_path}\n{task.question}"

        output = cast(List, interpreter.chat(prompt, display=True, stream=False))
        final_message = output[-1]["content"]
        final_answer_re = re.search("FINAL ANSWER: (.+)", final_message)
        if final_answer_re is None:
            return TR.not_found(output)

        final_answer = final_answer_re.group(1).strip().lower()
        if final_answer == task.final_answer.lower():
            return TR.correct(task.final_answer, output)
        else:
            return TR.incorrect(task.final_answer, final_answer, output)