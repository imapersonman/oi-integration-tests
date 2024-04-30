from home.helpers import start


child = start()
child.expect("#")
child.close()