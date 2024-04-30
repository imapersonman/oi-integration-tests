"""
I'm writing this file because pytest is trash and I should be able to run tests within the same
process and not be required to have 3 different files to configure everything.
"""


from contextlib import contextmanager
import os
from pathlib import Path
import subprocess
from typing import List, Optional


TEST_DIR = Path("home/tests")

fgRED = "\033[91m"
fgGREEN = "\033[92m"
fgCYAN = "\033[96m"
fgGRAY = "\033[90m"


def run_tests(base_dir: Path, to_include: Optional[List[str]] = None, show_output=False) -> bool:
    test_dir = base_dir / TEST_DIR
    all_tests = os.listdir(test_dir)
    tests_to_run = [t for t in all_tests if to_include is None or t in to_include]

    args = ["--output"] if show_output else []

    try:
        total = len(tests_to_run)
        passing = []
        failing = []
        for test in tests_to_run:
            status = run_single_test(test, args)
            (passing if status == 0 else failing).append(test)
            if status == 0:
                print(color(fgGREEN, f"Success!"))
            else:
                print(color(fgRED, f"Failed! {status}"))
        
        all_passed = len(failing) == 0

        c, msg = (fgGREEN, "All tests passed!") if all_passed else (fgRED, "Some tests failed.")
        print()
        print(f'{color(fgCYAN, "Summary:")} {color(c, msg)}')
        print(color(c, f"  {len(passing)} / {total} tests are passing."))
        print(color(c, f"  {len(failing)} / {total} tests are failing."))
        if len(failing) > 0:
            for f in failing:
                print(f"    - {color(fgRED, f)}")
    except KeyboardInterrupt:
        all_passed = True
    
    return all_passed

def run_test_in_docker(docker_client, test_path: str, args: List[str] = []):
    args_str = " ".join(args)
    command = f"python {test_path} {args_str}"
    container = docker_client.containers.run("oi", command=command, detach=True)
    response = container.wait() # type: ignore

    return response, command, container


def run_single_test(test_path: str, args: List[str] = []) -> int:
    path = TEST_DIR / test_path
    print(color(fgCYAN, f"Running test at {path}"))
    status = run_test_in_docker_subprocess(str(path), args)
    return status


def centered_text(text: Optional[str] = None) -> str:
    width, _ = os.get_terminal_size()
    space_size = 1  # on either side of the text.
    if text == None:
        return "─" * width
    elif len(text) - 2 * space_size > width:
        return text

    # side_length should be even no matter what.
    side_length = int((width - (len(text) + 2 * space_size)) / 2)
    side = "─" * side_length
    space = " " * space_size
    if len(text) % 2 == width % 2:
        return side + space + text + space + side
    else:
        return side + space + text + space + side + "─"


class OutputManager:
    def __init__(self):
        self.at_newline = True  # Assume cursor starts at the beginning

    def write(self, text, end=''):
        print(text, end=end, flush=True)
        self.at_newline = end == '\n'

    def ensure_newline(self):
        if not self.at_newline:
            print()  # Print a newline if not at the beginning
            self.at_newline = True


def run_subprocess(command: List[str]) -> int:
    print(color(fgGRAY, "┌" + centered_text("subprocess")[1:]))
    with subprocess.Popen(command, stdout=subprocess.PIPE, text=True) as proc:
        if proc.stdout is not None:
            om = OutputManager()
            for line in proc.stdout:
                line = line.rstrip("\n")
                om.write(f"{color(fgGRAY, '│')} {line}")
                om.write("\n", end="")
            om.ensure_newline()
    print(color(fgGRAY, "└" + centered_text()[1:]))

    proc.wait()
    return proc.returncode

def run_subprocess_simple(command: List[str]) -> int:
    result = subprocess.run(command)
    return result.returncode

def run_test_in_docker_subprocess(test_path: str, test_args: List[str] = []) -> int:
    """
    Ugh also not a fan of the docker python lib so we're just calling a subprocess WOOOO!
    """
    args = ["docker", "run", "-t", "oi", "python", test_path, *test_args]
    return run_subprocess_simple(args)


def color(esc_seq: str, text: str) -> str:
    END = "\033[0m"
    return esc_seq + text + END


if __name__ == "__main__":
    if not run_tests(Path("../basic")):
        exit(1)
