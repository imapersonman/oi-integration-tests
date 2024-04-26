from helpers import start


"""
This tests makes sure that running with --contribute_conversation on a fresh install walks the
user through the dialog for contributing past and future conversations.
"""

child = start()

child.expect("#")
child.sendline("interpreter --contribute_conversation")

child.expect("(y/n)")
child.sendline("n")
child.expect("y/n")
child.sendline("n")
child.expect(">")
child.sendline("\x03")

child.close()
