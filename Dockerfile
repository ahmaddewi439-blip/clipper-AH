FROM node:18-slim

# Install ffmpeg, python3, pip
RUN apt-get update && apt-get install -y ffmpeg python3 python3-pip curl

# Install yt-dlp
RUN pip3 install yt-dlp

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["node", "server-clipper-v6.js"]