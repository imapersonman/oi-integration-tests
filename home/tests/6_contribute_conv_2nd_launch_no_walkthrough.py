from helpers import start


child = start()

child.expect("#")
child.sendline("interpreter --contribute_conversation")
child.expect("(y/n)")
child.sendline("n")
child.expect("(y/n)")
child.sendline("n")
child.expect(">")
child.sendline("\x03")

child.expect("#")
child.sendline("interpreter --contribute_conversation")
child.expect(">")
child.sendline("\x03")

child.close()