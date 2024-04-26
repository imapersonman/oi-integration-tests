import os
from pathlib import Path
from typing import List, Optional
import pytest
from docker import DockerClient, from_env as from_docker_env


SCRIPT_DIR = Path(os.path.dirname(os.path.abspath(__file__)))
TEST_DIRECTORY = SCRIPT_DIR.parent.parent / Path("home/tests")
IMAGE_NAME = "oi"


def run(to_include: Optional[List[str]] = None, show_output=False):
    options = [] if to_include is None else [f"--include-case={i}" for i in to_include]
    if show_output:
        options = [*options, "--output"]
    pytest.main(options)


@pytest.fixture(scope="session")
def docker_client():
    client = from_docker_env()
    yield client
    client.close()


def should_run_as_test(included: List):
    def pred(path):
        basename = os.path.basename(path)
        name, ext = os.path.splitext(basename)
        return ext == ".py" and (len(included) == 0 or path in included)
    return pred


def pytest_generate_tests(metafunc):
    if "test_path" in metafunc.fixturenames:
        to_include = metafunc.config.getoption("--include-case")
        pred = should_run_as_test(to_include)
        all_test_paths = list(filter(pred, os.listdir(TEST_DIRECTORY)))
        ids = [os.path.splitext(os.path.basename(path))[0] for path in all_test_paths]
        metafunc.parametrize("test_path", all_test_paths, ids=ids, scope="function")
    if "show_output" in metafunc.fixturenames:
        show_output = metafunc.config.getoption("--output")
        metafunc.parametrize("show_output", [show_output], scope="function")


def test_install(docker_client: DockerClient, test_path, show_output):
    print(f"Running file: {test_path}")
    print(f"show_output: {show_output}")

    args = ["--output"] if show_output else []
    response, command, container = run_test_in_docker(docker_client, test_path, args)

    status = response["StatusCode"]
    try:
        assert status == 0, f"'{command}' exited with an error code: {status}"
    except AssertionError:
        print(container.logs().decode("utf-8")) # type: ignore
        raise
    finally:
        container.remove() # type: ignore


def run_test_in_docker(docker_client, test_path: str, args: List[str] = []):
    args_str = " ".join(args)
    command = f"python tests/{test_path} {args_str}"
    container = docker_client.containers.run("oi", command=command, detach=True)
    response = container.wait() # type: ignore

    return response, command, container
