FROM node:18

# Force rebuild - install ffmpeg
RUN apt-get update -y && apt-get install -y ffmpeg

# Verify ffmpeg
RUN which ffmpeg
RUN ffmpeg -version

# Install yt-dlp
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["node", "server-clipper-v6.js"]