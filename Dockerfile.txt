FROM node:18

# Install ffmpeg dan yt-dlp
RUN apt-get update && apt-get install -y ffmpeg python3 python3-pip \
    && pip3 install yt-dlp \
    && apt-get clean

WORKDIR /app

# Copy package.json dan install dependencies
COPY package.json ./
RUN npm install

# Copy semua file
COPY . .

# Buat folder output
RUN mkdir -p output

EXPOSE 3000

CMD ["node", "server-clipper-v6.js"]