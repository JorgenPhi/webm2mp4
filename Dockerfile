FROM rickydunlop/nodejs-ffmpeg

ENV NODE_WORKDIR /home/node/app
WORKDIR $NODE_WORKDIR
ADD . $NODE_WORKDIR
RUN mkdir -p $NODE_WORKDIR/tmp

RUN npm install

CMD [ "npm", "start" ]
