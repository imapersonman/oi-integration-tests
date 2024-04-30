def pytest_addoption(parser):
    parser.addoption(
        "--include-case", action="append", default=[],
        help="Specify one or more files in home/tests to run."
    )
    parser.addoption(
        "--output", action="store_true", default=False,
        help="Make tests output what the user sees."
    )
    parser.addoption(
        "--base-dir", action="store", default="",
        help="The path to the directory where the tests should be."
    )
