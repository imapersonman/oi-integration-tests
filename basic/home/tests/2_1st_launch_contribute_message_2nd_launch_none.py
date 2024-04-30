from home.helpers import start


"""
This tests makes sure that after a fresh install, OpenInterpreter:
  1) asks the user to run --contribute-conversation on the 1st run, and
  2) does NOT ask the user to run --contribute_conversation on the 2nd run.
"""


child = start()

child.expect("#")
child.sendline("interpreter")

child.expect("--contribute_conversation")
child.expect(">")
child.sendline("calculate 100 - 42 using python.  don't explain just code.")
child.expect(".+(y/n).+")
child.sendline("y")
child.expect(">")
child.sendline("\x03")

child.expect("#")
child.sendline("interpreter")  # second invocation!
# expect ">", NOT "--contribute_conversation".
assert 0 == child.expect([">", "--contribute_conversation"])
child.sendline("calculate 100 - 42 using python.  don't explain just code.")
child.expect(".+(y/n).+")
child.sendline("y")
child.expect(">")
child.sendline("\x03")
