from typing import cast
import unittest
from unittest.mock import Mock
from fastapi.testclient import TestClient

from fastapi_server import Server
from runner import TaskRunner
from models import AnnotatorMetadata, FullTask, TaskPreview
from store import TaskRunStore, TaskStore


class TestServerOnly(unittest.TestCase):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.tasks = cast(TaskStore, Mock(spec=TaskStore))
        self.runner = cast(TaskRunner, Mock(spec=TaskRunner))
        self.runs = cast(TaskRunStore, Mock(spec=TaskRunStore))
        self.server = Server(self.tasks, self.runner, self.runs)
        self.client = TestClient(self.server.make_app())
    
    def test_get_tasks_empty(self):
        self.tasks.get_all.return_value = []

        expected = []
        actual = self.client.get("/gaia/tasks").json()
        self.assertListEqual(expected, actual) # type: ignore
    
    def test_get_tasks_nonempty(self):
        self.tasks.get_all.return_value = [
            TaskPreview(
                task_id="some-id",
                level=2,
                question="Why are ducks means?"
            ),
            TaskPreview(
                task_id="some-other-id",
                level=5,
                question="What is brown?"
            )
        ]

        expected = [tp.model_dump() for tp in self.tasks.get_all.return_value]
        actual = self.client.get("/gaia/tasks").json()
        self.assertListEqual(expected, actual)
    
    def test_get_missing_task(self):
        self.tasks.get_single.return_value = None

        self.assertEqual(404, self.client.get("/gaia/tasks/some-task").status_code)
        args, = self.tasks.get_single.call_args[0]
        self.assertEqual("some-task", args)
    
    def test_get_existing_task(self):
        task_id = "this-is-an-identifier-i-promise"
        am = AnnotatorMetadata(
            steps="",
            number_of_steps=0,
            length_of_time="3",
            tools="None",
            number_of_tools="Some"
        )
        self.tasks.get_single.return_value = FullTask(
            task_id=task_id,
            level=12,
            question="Who are you??",
            final_answer="",
            file_name="",
            annotator_metadata=am
        )

        expected = self.tasks.get_single.return_value.model_dump()
        actual = self.client.get(f"/gaia/tasks/{task_id}").json()
        self.assertDictEqual(expected, actual)
        args, = self.tasks.get_single.call_args[0]
        self.assertEqual(task_id, args)
    
    
if __name__ == "__main__":
    unittest.main()