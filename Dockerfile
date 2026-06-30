FROM node:18-slim

# Install ffmpeg dan curl
RUN apt-get update && apt-get install -y ffmpeg curl

# Download yt-dlp binary langsung
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["node", "server-clipper-v6.js"]