from home.helpers import insert_key, start


child = start()

child.expect("#")
child.sendline("interpreter --contribute_conversation")
insert_key(child)
child.expect("(y/n)")
child.sendline("n")
child.expect("(y/n)")
child.sendline("n")
child.expect(">")
child.sendline("\x03")

child.expect("#")
child.sendline("interpreter --contribute_conversation")
insert_key(child)
child.expect(">")
child.sendline("\x03")

child.close()