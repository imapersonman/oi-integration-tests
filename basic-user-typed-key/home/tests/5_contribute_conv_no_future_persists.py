from home.helpers import insert_key, start


"""
This tests makes sure that on the no-args run after the user said they would NOT like to contribute
conversations, they're NOT shown a message saying that this conversation is being sent to Open
Interpreter.

This test might be prone to breakage if the wording changes considerably.
"""


child = start()

child.expect("#")
child.sendline("interpreter --contribute_conversation")
insert_key(child)
child.expect("(y/n)")
child.sendline("n")  # say no to the past.
child.expect("(y/n)")
child.sendline("n")  # say yes to the future.
child.expect(">")
child.sendline("\x03")

child.expect("#")
child.sendline("interpreter")
insert_key(child)
assert 0 == child.expect([">", "This conversation will be used to train OpenInterpreter's language model."])
child.sendline("\x03")

child.expect("#")

child.close()
