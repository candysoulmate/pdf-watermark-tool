# 使用Node.js官方镜像作为基础镜像
FROM node:18-bullseye

# 设置工作目录
WORKDIR /app

# 安装canvas库所需的系统依赖
RUN apt-get update && apt-get install -y \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    libpdf-dev \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# 复制package.json和yarn.lock
COPY package.json yarn.lock ./

# 安装依赖
RUN yarn install

# 复制项目文件
COPY . .

# 构建应用
RUN yarn build

# 暴露端口
EXPOSE 3000

# 启动应用
CMD ["yarn", "start"] 