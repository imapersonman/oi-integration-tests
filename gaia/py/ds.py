import sys
from typing import Dict, List
from datasets import Dataset, load_dataset
from interpreter import interpreter, OpenInterpreter
import pexpect

from helpers import OutputWrapper


def pull_out(ds: Dataset, columns: List[str]) -> List[Dict]:
    a = []
    for row in ds:
        d = {}
        for c in columns:
            d[c] = row[c]
        a.append(d)
    return a


def all_of_the_validation_tests() -> Dataset:
    return load_dataset("gaia-benchmark/GAIA", "2023_all", split="validation")


def run_gaia_task_from_command_line(entry, command: str) -> bool:
    # to a run a task, we need to
    # 1) grab the path where the needed file is located if it exists.
    path_to_file = entry["file_path"]
    print("Running Command:", command)
    split_commands = command.strip().split(' ')
    # I will definitely change this if I didn't trust the frontend -- generally super cursed.

    # we're going to auto-run tests by default.
    child = pexpect.spawn(f"{command} -y")
    child.logfile_read = OutputWrapper(sys.stdout)
    child.expect(">")
    child.sendline(entry["Question"].replace("\n", " "))
    # if the llm decides to output "> ", everything will stop.  this isn't great so let's not do that.
    child.expect("> ", timeout=None)
    child.close()

    print()
    print("Finished!  I don't know if it's correct yet, though.")

    return True


def run_gaia_task_from_library(entry, command: Dict) -> bool:
    print("command configuration:", command)
    interpreter = OpenInterpreter(import_computer_api=True)
    interpreter.llm.model = command["model"] if command["model"] != "" else interpreter.llm.model
    interpreter.llm.api_base = command["api_base"] if command["api_base"] != "" else interpreter.llm.api_base
    interpreter.llm.api_key = command["api_key"] if command["api_key"] != "" else interpreter.llm.api_key
    interpreter.auto_run = command["auto_run"]
    interpreter.custom_instructions = command["system_prompt"]

    print()
    print("api_base:", interpreter.llm.api_base)
    print("api_key:", interpreter.llm.api_key)
    print("auto_run:", interpreter.auto_run)
    print("system_prompt:", interpreter.custom_instructions)
    print()

    try:
        for _ in interpreter.chat(entry["Question"], display=True):
            ...
    except KeyboardInterrupt:
        ...
    finally:
        interpreter.computer.terminate()

    return False


if __name__ == "__main__":
    run_gaia_task_from_command_line({"file_path": "something.txt"}, "interpreter")
