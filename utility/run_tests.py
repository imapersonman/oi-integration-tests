"""
I'm writing this file because pytest is trash and I should be able to run tests within the same
process and not be required to have 3 different files to configure everything.
"""


import os
from pathlib import Path
import subprocess
from typing import List, Optional
import docker


TEST_DIR = Path("home/tests")


def run_tests(base_dir: Path, to_include: Optional[List[str]] = None, show_output=False):
    test_dir = base_dir / TEST_DIR
    all_tests = os.listdir(test_dir)
    tests_to_run = [t for t in all_tests if to_include is None or t in to_include]

    client = docker.from_env()
    args = ["--output"] if show_output else []

    for test in tests_to_run:
        path = TEST_DIR / test
        print(path)
        # response, command, container = run_test_in_docker(client, str(path), args)
        # print(response["StatusCode"])
        run_test_in_docker_subprocess(str(path), args)


def run_test_in_docker(docker_client, test_path: str, args: List[str] = []):
    args_str = " ".join(args)
    command = f"python {test_path} {args_str}"
    container = docker_client.containers.run("oi", command=command, detach=True)
    response = container.wait() # type: ignore

    return response, command, container


def run_test_in_docker_subprocess(test_path: str, test_args: List[str] = []):
    """
    Ugh also not a fan of the docker python lib so we're just calling a subprocess WOOOO!
    """
    args = ["docker", "run", "-t", "oi", "python", test_path, *test_args]
    subprocess.run(args)
