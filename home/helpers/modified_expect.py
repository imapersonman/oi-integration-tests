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