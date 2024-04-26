import os
from pathlib import Path
import subprocess
from typing import List
from questionary import select, checkbox, Choice
import docker
import rich


from tests.test_suite import run as run_tests


"""
This file currently has to be run from the utility directory for everything to work properly,
"""


TEST_DIRECTORY = Path("../home/tests")


def load_tests_from_directory(suite_directory: Path) -> List:
    suite = []
    test_names = os.listdir(suite_directory)
    for name in test_names:
        suite.append(name)
    return suite


def run_docker_image(test_name):
    path = TEST_DIRECTORY / Path(test_name)
    subprocess.run(["docker", "run", "-t", "oi", "python", path, "--output"])


def run_docker_image_interactively():
    subprocess.run(["docker", "run", "-ti", "oi"])


def build_docker_image(with_cache=True):
    openai_key = os.environ.get("OPENAI_API_KEY")
    command = ["docker", "build", "-t", "oi"]
    if openai_key is not None:
        command.extend(["--build-arg", f"OPENAI_API_KEY={openai_key}"])
    else:
        rich.print("[yellow]Warning: OPENAI_API_KEY not found in env -- building without it[/yellow]")
    if not with_cache:
        command.extend(["--no-cache"])
    subprocess.run([*command, ".."])


running = True
client = docker.from_env()

while running:
    action = select(
        "What would you like to do?",
        choices=[
            Choice("build image", value="build-image"),
            Choice("run tests", value="run-tests"),
            Choice("view interaction", value="view-interaction"),
            Choice("interact manually", value="interact-manually"),
            "quit"
        ]
    ).ask()

    if action == "build-image":
        build_docker_image()
    elif action == "run-tests":
        all_or_some = select(
            "How would you like to run your tests?",
            default="all",
            choices=[
                "all",
                "some"
            ]
        ).ask()
        if all_or_some == "all":
            run_tests()
        else:
            suite = load_tests_from_directory(TEST_DIRECTORY)
            to_run = checkbox(
                "Which tests would you like to run?",
                choices=suite
            ).ask()
            print(to_run)
            run_tests(to_include=to_run)
    elif action == "view-interaction":
        suite = load_tests_from_directory(TEST_DIRECTORY)
        test = select(
            "Which test would you like to view in real time?",
            choices=suite
        ).ask()
        run_docker_image(test)
    elif action == "interact-manually":
        run_docker_image_interactively()
    elif action == "quit":
        running = False


client.close()
