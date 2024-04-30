from home.helpers import insert_key, start


"""
This tests makes sure that on the no-args run after the user said they'd like to contribute future
conversations, they're shown a message saying that this conversation is being sent to Open
Interpreter.

This test might be prone to breakage if the wording changes.
"""


child = start()

child.expect("#")
child.sendline("interpreter --contribute_conversation")
insert_key(child)
child.expect("(y/n)")
child.sendline("n")  # say no to the past.
child.expect("(y/n)")
child.sendline("y")  # say yes to the future.
child.expect(">")
child.sendline("\x03")

child.expect("#")
child.sendline("interpreter")
insert_key(child)
child.expect("This conversation will be used to train OpenInterpreter's language model.")
child.expect(">")
child.sendline("\x03")

child.expect("#")

child.close()
