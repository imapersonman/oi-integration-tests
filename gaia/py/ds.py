import sys
from typing import Dict, List
from datasets import Dataset, load_dataset
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
    return load_dataset("gaia-benchmark/GAIA", "2023_all", split="validation", trust_remote_code=True)


def run_gaia_task(entry, command: str) -> bool:
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
    child.expect(">", timeout=None)
    child.close()

    return "correct"


if __name__ == "__main__":
    run_gaia_task({"file_path": "something.txt"}, "interpreter")
