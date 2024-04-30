from home.helpers import insert_key, start


"""
This test makes sure that the user is told to contribute conversations after they've installed
OpenInterpreter.
"""

child = start()

child.expect("#")
child.sendline("interpreter")
insert_key(child)
child.expect("--contribute_conversation")
child.expect(">")
child.sendline("calculate 100 - 42 using python.  don't explain just code.")
child.expect("(y/n)")
child.sendline("y")
child.expect(">")
child.sendline("\x03")
