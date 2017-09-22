FROM ubuntu:zesty

RUN apt-get update \
 && apt-get install -y \
    git \
    python-numpy \
    python-qt4 \
    python-pip \
    python-tk

RUN git clone https://github.com/chanzuckerberg/starfish.git \
 && cd starfish \
 && pip install -r REQUIREMENTS.txt \
 && python setup.py install
