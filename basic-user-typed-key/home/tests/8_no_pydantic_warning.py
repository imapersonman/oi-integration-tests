from home.helpers import insert_key, start


child = start()

child.expect("#")
child.sendline("interpreter")
insert_key(child)
assert 0 == child.expect([">", "pydantic"]), "found pydantic error print on launch!"
child.sendline("\x03")

child.close()
