class OutputWrapper:
    def __init__(self, output):
        self.output = output

    def write(self, s):
        if isinstance(s, bytes):
            s = s.decode('utf-8')  # Assuming UTF-8 encoding
        self.output.write(s)

    def flush(self):
        self.output.flush()

