FROM python:3.11.8

ARG OPENAI_API_KEY

RUN pip install git+https://github.com/imapersonman/open-interpreter.git@main
RUN pip install pexpect
RUN curl -fsSL https://ollama.com/install.sh | sh

COPY home /home
ENV PYTHONPATH="/home/helpers:$PYTHONPATH"

ENV OPENAI_API_KEY=${OPENAI_API_KEY}
# WORKDIR /home
CMD /bin/bash