from helpers import start


child = start()

child.expect("#")
child.sendline("interpreter --contribute_conversation")
child.expect("(y/n)")
child.sendline("y")
child.expect("(y/n)")
child.sendline("n")
child.expect(">")
child.sendline("\x03")
