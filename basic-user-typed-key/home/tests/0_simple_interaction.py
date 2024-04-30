import os
from home.helpers import start, insert_key


"""
This test makes sure Open Interpreter runs a simple query right after install.
It's a smoke test.
"""

child = start()

child.expect("#")
child.sendline("interpreter")
insert_key(child)
child.expect(">")
child.sendline("calculate 100 - 42 using python.  don't explain just code.")
child.expect(".+(y/n).+")
child.sendline("y")
child.expect(">")
child.sendline("\x03")
