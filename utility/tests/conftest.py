def pytest_addoption(parser):
    parser.addoption(
        "--include-case", action="append", default=[],
        help="Specify one or more files in home/tests to run."
    )
