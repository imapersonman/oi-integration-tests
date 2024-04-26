import os
from pathlib import Path
import subprocess
from typing import List
from questionary import select, checkbox, confirm, Choice
import docker
import rich


from tests.test_suite import run as run_tests


"""
This file currently has to be run from the utility directory for everything to work properly,
"""


TEST_DIRECTORY = Path("../home/tests")


def load_tests_from_directory(suite_directory: Path) -> List:
    suite = os.listdir(suite_directory)
    return list(sorted(suite))


def run_docker_image(test_name, extra_args=[]):
    path = TEST_DIRECTORY / Path(test_name)
    subprocess.run(["docker", "run", "-t", "oi", "python", path, *extra_args])


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
        from_scratch = confirm("From scratch?", default=False).ask()
        build_docker_image(with_cache=not from_scratch)
    elif action == "run-tests":
        all_or_some = select(
            "Which tests?",
            default="all",
            choices=[
                Choice("all of them!", "all"),
                Choice("only some of them", "some")
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
            user_or_script = select(
                "What kind of logs do you want to see?",
                default="script",
                choices=[
                    Choice("as an expect script", "script"),
                    Choice("as the user would see it", "user")
                ]
            ).ask()
            if user_or_script == "user":
                run_tests(to_include=to_run, show_output=True)
            elif user_or_script == "script":
                run_tests(to_include=to_run, show_output=False)
    elif action == "view-interaction":
        suite = load_tests_from_directory(TEST_DIRECTORY)
        test = select(
            "Which test would you like to view in real time?",
            choices=suite
        ).ask()
        user_or_script = select(
            "How would you like to view the interaction?",
            default="user",
            choices=[
                Choice("as the user would see it", "user"),
                Choice("as an expect script", "script")
            ]
        ).ask()
        if user_or_script == "user":
            run_docker_image(test, extra_args=["--output"])
        elif user_or_script == "script":
            run_docker_image(test)
    elif action == "interact-manually":
        run_docker_image_interactively()
    elif action == "quit":
        running = False


client.close()
