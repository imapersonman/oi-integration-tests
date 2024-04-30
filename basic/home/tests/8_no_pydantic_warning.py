from home.helpers import start


child = start()

child.expect("#")
child.sendline("interpreter")
assert 0 == child.expect([">", "pydantic"]), "found pydantic error print on launch!"
child.sendline("\x03")
