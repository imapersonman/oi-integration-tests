import os
import sys
from typing import Generic, TypeVar
import pexpect


class ModifiedExpect(pexpect.spawn):
    """
    Adds some methods I wish pexpect had.
    """
    def __init__(self, child: pexpect.spawn):
        self.child = child

    def __getattr__(self, attr):
        return self.child.__getattribute__(attr)

    def dont_expect_str(self, not_expected: str, timeout=5):
        index = self.child.expect([not_expected, pexpect.TIMEOUT], timeout=timeout)
        if index == 0:
            raise Exception(f"did not expect '{not_expected}'")
    
    def expect_index(self, expected_index, possible_list):
        index = self.child.expect(possible_list)
        if index != expected_index:
            expected = possible_list[expected_index]
            actual = possible_list[index]
            try:
                raise Exception(f"expected '{expected}', received '{actual}'")
            finally:
                self.child.close()


T = TypeVar("T")
class ObjectWrapper(Generic[T]):
    def __init__(self, obj: T):
        self.obj = obj
    
    def __getattr__(self, attr):
        original = getattr(self.obj, attr)
        if callable(original):
            name_str = original.__name__
            def wrapped(*args, **kwargs):
                args_strs = map(str, args)
                kwargs_strs = [f"{k}={v}" for k, v in kwargs]
                given_args_str = ", ".join([*args_strs, *kwargs_strs])
                print(f"{name_str}({given_args_str})")
                return original(*args, **kwargs)
            return wrapped
        else:
            return original


def wrap(obj: T) -> T:
    # nasty nasty ignore but it should work so whatevs.
    return ObjectWrapper(obj) # type: ignore

class OutputWrapper:
    def __init__(self, output):
        self.output = output

    def write(self, s):
        if isinstance(s, bytes):
            s = s.decode('utf-8')  # Assuming UTF-8 encoding
        self.output.write(s)

    def flush(self):
        self.output.flush()


def start() -> pexpect.spawn:
    child = pexpect.spawn("/usr/bin/bash")
    if len(sys.argv) > 1 and sys.argv[1] == "--output":
        child.logfile_read = OutputWrapper(sys.stdout)
    else:
        child = wrap(child)
    return child


def insert_key(child: pexpect.spawn):
    child.expect("key:")
    key = os.environ.get("OPENAI_INDIRECT_API_KEY")
    child.sendline(key)

