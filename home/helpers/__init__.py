import sys
import pexpect

from output_wrapper import OutputWrapper
from object_wrapper import wrap


def start() -> pexpect.spawn:
    child = pexpect.spawn("/usr/bin/bash")
    if len(sys.argv) > 1 and sys.argv[1] == "--output":
        child.logfile_read = OutputWrapper(sys.stdout)
    else:
        child = wrap(child)
    return child
