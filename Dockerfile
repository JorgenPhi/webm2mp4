FROM rickydunlop/nodejs-ffmpeg

ENV NODE_WORKDIR /home/node/app
WORKDIR $NODE_WORKDIR
ADD . $NODE_WORKDIR

RUN npm install

CMD [ "npm", "start" ]