from home.helpers import insert_key, start


"""
This test makes there is no error if a user has a conversation, then says that they want to send
all previous conversations.
"""


child = start()

child.expect("#")
child.sendline("interpreter")
insert_key(child)
child.expect(">")
child.sendline("calculate 50 + 49 in python")
child.expect("(y/n)")
child.sendline("y")
child.expect(">")
child.sendline("\x03")
child.expect("#")
child.sendline("interpreter --contribute_conversation")
insert_key(child)
child.expect("(y/n)")
child.sendline("y")
child.expect("y/n")
child.sendline("n")
child.expect(">")
child.sendline("\x03")
