# Xboard2

<div align="center">

[![Telegram](https://img.shields.io/badge/Telegram-Channel-blue)](https://t.me/XboardOfficial)
![PHP](https://img.shields.io/badge/PHP-8.2+-green.svg)
![MySQL](https://img.shields.io/badge/MySQL-5.7+-blue.svg)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

## 📖 Introduction 📖 简介

Xboard2 is a modern panel system built on Laravel 11, focusing on providing a clean and efficient user experience. Forked from [Xboard](https://github.com/cedar2025/Xboard) with security enhancements and additional features.

Xboard2 是一个基于 Laravel 11 构建的现代面板系统，专注于提供简洁高效的用户体验。基于 [Xboard](https://github.com/cedar2025/Xboard) 二次开发，增强了安全性并新增多项功能。

## 💻 System Requirements 💻 系统要求

- 🐧 推荐系统 / Recommended OS：**Debian 12 (Bookworm)**
- ✅ 兼容系统 / Compatible：Ubuntu 22.04+、CentOS 7+
- 🐘 PHP 8.2+、MySQL 5.7+（或 SQLite）、Redis
- 🐳 Docker 部署（推荐）或 LNMP 环境
- 💾 内存 / RAM：≥ 512MB（含数据库和 Redis）

> 💡 Debian 推荐理由：官方源直接提供 PHP 8.2，Docker 支持最稳定，系统开销最小。Ubuntu 同样兼容，CentOS 需通过 Remi 源安装 PHP 8.2。

## 📦 Installation Guide 📦 安装教程

### 方式一：Debian 12 专用安装（推荐）/ Method 1: Debian 12 Dedicated (Recommended)

#### 1️⃣ 更新系统并安装依赖 / Update System & Install Dependencies

root 用户执行：
```bash
apt update -y && apt install -y curl socat wget
```

非 root 用户执行：
```bash
sudo apt update -y && sudo apt install -y curl socat wget
```

#### 2️⃣ 安装 PHP 8.2 及扩展 / Install PHP 8.2 & Extensions

```bash
apt install -y php8.2 php8.2-cli php8.2-fpm php8.2-mysql php8.2-sqlite3 \
    php8.2-mbstring php8.2-xml php8.2-curl php8.2-zip php8.2-gd \
    php8.2-redis php8.2-bcmath php8.2-intl php8.2-readline
```

#### 3️⃣ 安装 MySQL / Redis / Nginx / Install MySQL / Redis / Nginx

```bash
apt install -y mariadb-server redis-server nginx
systemctl enable --now mariadb redis-server nginx
```

#### 4️⃣ 配置数据库 / Configure Database

```bash
mysql -u root -e "CREATE DATABASE xboard2 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -e "CREATE USER 'xboard2'@'localhost' IDENTIFIED BY '你的数据库密码';"
mysql -u root -e "GRANT ALL PRIVILEGES ON xboard2.* TO 'xboard2'@'localhost';"
mysql -u root -e "FLUSH PRIVILEGES;"
```

#### 5️⃣ 安装 Composer / Install Composer

```bash
curl -sS https://getcomposer.org/installer | php
mv composer.phar /usr/local/bin/composer
```

#### 6️⃣ 克隆项目并安装 / Clone & Install

```bash
cd /var/www
git clone https://github.com/jungann2/Xboard2.git
cd Xboard2
composer install --no-dev --optimize-autoloader
cp .env.example .env
php artisan key:generate
```

编辑 `.env` 文件，配置数据库连接：
```bash
nano .env
```

修改以下字段：
```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=xboard2
DB_USERNAME=xboard2
DB_PASSWORD=你的数据库密码

REDIS_HOST=127.0.0.1
```

#### 7️⃣ 初始化并运行 / Initialize & Run

```bash
php artisan xboard:install
php artisan migrate --force
chown -R www-data:www-data /var/www/Xboard2
chmod -R 755 /var/www/Xboard2/storage
```

#### 8️⃣ 配置 Nginx / Configure Nginx

```bash
nano /etc/nginx/sites-available/xboard2
```

写入以下内容（将 `你的域名` 替换为实际域名）：
```nginx
server {
    listen 80;
    server_name 你的域名;
    root /var/www/Xboard2/public;
    index index.php;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        fastcgi_pass unix:/run/php/php8.2-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
    }

    location ~ /\.(?!well-known).* {
        deny all;
    }
}
```

启用站点：
```bash
ln -s /etc/nginx/sites-available/xboard2 /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

#### 9️⃣ 配置队列和定时任务 / Configure Queue & Cron

```bash
# 添加定时任务
(crontab -l 2>/dev/null; echo "* * * * * cd /var/www/Xboard2 && php artisan schedule:run >> /dev/null 2>&1") | crontab -

# 安装 Supervisor 管理队列
apt install -y supervisor
```

创建 Supervisor 配置：
```bash
nano /etc/supervisor/conf.d/xboard2.conf
```

写入：
```ini
[program:xboard2-octane]
process_name=%(program_name)s
command=php /var/www/Xboard2/artisan octane:start --host=127.0.0.1 --port=7001
autostart=true
autorestart=true
user=www-data
redirect_stderr=true
stdout_logfile=/var/log/xboard2-octane.log
```

启动：
```bash
supervisorctl reread && supervisorctl update && supervisorctl start xboard2-octane
```

> 🌐 浏览器访问 / Visit：`http://你的域名`
> ⚠️ 请务必保存安装时显示的管理员账号密码

---

### 方式二：Ubuntu 22.04+ 专用安装 / Method 2: Ubuntu 22.04+ Dedicated

#### 1️⃣ 更新系统并安装依赖 / Update System & Install Dependencies

root 用户执行：
```bash
apt update -y && apt install -y curl socat wget software-properties-common
```

非 root 用户执行：
```bash
sudo apt update -y && sudo apt install -y curl socat wget software-properties-common
```

#### 2️⃣ 添加 PHP 源并安装 / Add PHP Repository & Install

Ubuntu 官方源可能不含 PHP 8.2，需添加 PPA：
```bash
add-apt-repository ppa:ondrej/php -y
apt update -y
apt install -y php8.2 php8.2-cli php8.2-fpm php8.2-mysql php8.2-sqlite3 \
    php8.2-mbstring php8.2-xml php8.2-curl php8.2-zip php8.2-gd \
    php8.2-redis php8.2-bcmath php8.2-intl php8.2-readline
```

#### 3️⃣ 安装 MySQL / Redis / Nginx / Install MySQL / Redis / Nginx

```bash
apt install -y mysql-server redis-server nginx
systemctl enable --now mysql redis-server nginx
```

#### 4️⃣ 配置数据库 / Configure Database

```bash
mysql -u root -e "CREATE DATABASE xboard2 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -e "CREATE USER 'xboard2'@'localhost' IDENTIFIED BY '你的数据库密码';"
mysql -u root -e "GRANT ALL PRIVILEGES ON xboard2.* TO 'xboard2'@'localhost';"
mysql -u root -e "FLUSH PRIVILEGES;"
```

#### 5️⃣ 安装 Composer / Install Composer

```bash
curl -sS https://getcomposer.org/installer | php
mv composer.phar /usr/local/bin/composer
```

#### 6️⃣ 克隆项目并安装 / Clone & Install

```bash
cd /var/www
git clone https://github.com/jungann2/Xboard2.git
cd Xboard2
composer install --no-dev --optimize-autoloader
cp .env.example .env
php artisan key:generate
```

编辑 `.env` 文件，配置数据库连接：
```bash
nano .env
```

修改以下字段：
```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=xboard2
DB_USERNAME=xboard2
DB_PASSWORD=你的数据库密码

REDIS_HOST=127.0.0.1
```

#### 7️⃣ 初始化并运行 / Initialize & Run

```bash
php artisan xboard:install
php artisan migrate --force
chown -R www-data:www-data /var/www/Xboard2
chmod -R 755 /var/www/Xboard2/storage
```

#### 8️⃣ 配置 Nginx / Configure Nginx

```bash
nano /etc/nginx/sites-available/xboard2
```

写入以下内容（将 `你的域名` 替换为实际域名）：
```nginx
server {
    listen 80;
    server_name 你的域名;
    root /var/www/Xboard2/public;
    index index.php;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        fastcgi_pass unix:/run/php/php8.2-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
    }

    location ~ /\.(?!well-known).* {
        deny all;
    }
}
```

启用站点：
```bash
ln -s /etc/nginx/sites-available/xboard2 /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

#### 9️⃣ 配置队列和定时任务 / Configure Queue & Cron

```bash
# 添加定时任务
(crontab -l 2>/dev/null; echo "* * * * * cd /var/www/Xboard2 && php artisan schedule:run >> /dev/null 2>&1") | crontab -

# 安装 Supervisor 管理队列
apt install -y supervisor
```

创建 Supervisor 配置：
```bash
nano /etc/supervisor/conf.d/xboard2.conf
```

写入：
```ini
[program:xboard2-octane]
process_name=%(program_name)s
command=php /var/www/Xboard2/artisan octane:start --host=127.0.0.1 --port=7001
autostart=true
autorestart=true
user=www-data
redirect_stderr=true
stdout_logfile=/var/log/xboard2-octane.log
```

启动：
```bash
supervisorctl reread && supervisorctl update && supervisorctl start xboard2-octane
```

> 🌐 浏览器访问 / Visit：`http://你的域名`
> ⚠️ 请务必保存安装时显示的管理员账号密码

---

### 方式三：Docker Compose 一键部署 / Method 3: Docker Compose

#### 1️⃣ 安装 Docker / Install Docker

```bash
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker
```

#### 2️⃣ 克隆项目并安装 / Clone & Install

```bash
git clone -b compose --depth 1 https://github.com/jungann2/Xboard2 && \
cd Xboard2 && \
docker compose run -it --rm \
    -e ENABLE_SQLITE=true \
    -e ENABLE_REDIS=true \
    -e ADMIN_ACCOUNT=admin@demo.com \
    web php artisan xboard:install && \
docker compose up -d
```

#### 3️⃣ 访问面板 / Access Panel

> 🌐 浏览器访问 / Visit：`http://服务器IP:7001`
> ⚠️ 请务必保存安装时显示的管理员账号密码 / Save the admin credentials shown during installation

#### 4️⃣ 常用命令 / Common Commands

```bash
# 查看运行状态 / Check status
docker compose ps

# 查看日志 / View logs
docker compose logs -f

# 重启服务 / Restart
docker compose restart

# 停止服务 / Stop
docker compose down

# 更新版本 / Update
git pull && docker compose pull && docker compose up -d
```

### 方式四：宝塔面板 + Docker / Method 4: aaPanel + Docker

参考详细文档 / See detailed guide：[Deploy with aaPanel + Docker](./docs/en/installation/aapanel-docker.md)

### 方式五：宝塔面板（LNMP）/ Method 5: aaPanel (LNMP)

参考详细文档 / See detailed guide：[Deploy with aaPanel](./docs/en/installation/aapanel.md)

### 方式六：1Panel / Method 6: 1Panel

参考详细文档 / See detailed guide：[Deploy with 1Panel](./docs/en/installation/1panel.md)

## ✨ Features ✨ 特色

- 🚀 Built with Laravel 12 + Octane for significant performance gains
  🚀 采用 Laravel 12 + Octane 制造，性能显著提升
- 🎨 Redesigned admin interface (React + Shadcn UI)
  🎨 重新设计的管理界面（React + Shadcn UI）
- 📱 Modern user frontend (Vue3 + TypeScript)
  📱 现代用户前端（Vue3 + TypeScript）
- 🐳 Ready-to-use Docker deployment solution
  🐳 现成可用的 Docker 部署解决方案
- 🎯 Optimized system architecture for better maintainability
  🎯 优化系统架构以提升可维护性
- 🔐 Server token CSPRNG secure generation (replaces insecure Math.random)
  🔐 通讯密钥 CSPRNG 安全生成（替换不安全的 Math.random）

## 🚀 Quick Start 🚀 快速入门

```bash
git clone -b compose --depth 1 https://github.com/jungann2/Xboard2 && \
cd Xboard2 && \
docker compose run -it --rm \
    -e ENABLE_SQLITE=true \
    -e ENABLE_REDIS=true \
    -e ADMIN_ACCOUNT=admin@demo.com \
    web php artisan xboard:install && \
docker compose up -d
```

> After installation, visit: http://SERVER_IP:7001
> 安装完成后访问：http://服务器IP:7001
> ⚠️ Make sure to save the admin credentials shown during installation / 请务必保存安装时显示的管理员凭据

## 📖 Documentation 📖 文档

### 🔄 Upgrade Notice / 升级须知
> 🚨 **Important / 重要：** This version involves significant changes. Please strictly follow the upgrade documentation and backup your database before upgrading. 本版本涉及重大变更，请严格按照升级文档操作并提前备份数据库。

### Development Guides / 开发指南
- [Plugin Development Guide](./docs/en/development/plugin-development-guide.md) - Xboard2 插件开发完整指南

### Deployment Guides / 部署指南
- [Deploy with 1Panel](./docs/en/installation/1panel.md)
- [Deploy with Docker Compose](./docs/en/installation/docker-compose.md)
- [Deploy with aaPanel](./docs/en/installation/aapanel.md)
- [Deploy with aaPanel + Docker](./docs/en/installation/aapanel-docker.md) (Recommended / 推荐)

### Migration Guides / 迁移指南
- [Migrate from v2board dev](./docs/en/migration/v2board-dev.md)
- [Migrate from v2board 1.7.4](./docs/en/migration/v2board-1.7.4.md)
- [Migrate from v2board 1.7.3](./docs/en/migration/v2board-1.7.3.md)

## 🛠️ Tech Stack 🛠️ 技术栈

- Backend / 后端：Laravel 11 + Octane
- Admin Panel / 管理面板：React + Shadcn UI + TailwindCSS
- User Frontend / 用户前端：Vue3 + TypeScript + NaiveUI
- Deployment / 部署：Docker + Docker Compose
- Caching / 缓存：Redis + Octane Cache

## 📷 Preview 📷 预览
![Admin Preview](./docs/images/admin.png)

![User Preview](./docs/images/user.png)

## ⚠️ Disclaimer ⚠️ 免责声明

This project is for learning and communication purposes only. Users are responsible for any consequences of using this project.

本项目仅供学习交流使用，使用者需自行承担使用本项目产生的一切后果。

## 🌟 Maintenance Notice 🌟 维护说明

This project is currently under light maintenance. We will:
本项目目前处于轻度维护状态，我们会：
- Fix critical bugs and security issues / 修复关键 Bug 和安全问题
- Review and merge important pull requests / 审核并合并重要的 PR
- Provide necessary updates for compatibility / 提供必要的兼容性更新

However, new feature development may be limited.
但新功能开发可能有限。

## 🔔 Important Notes 🔔 注意事项

1. Restart required after modifying admin path:
```bash
docker compose restart
```

2. For aaPanel installations, restart the Octane daemon process

## 🔒 Security Configuration 🔒 安全配置说明

### 生产环境部署前必读

#### 1. 关闭调试模式

`.env` 文件中 `APP_DEBUG` 控制是否显示详细错误信息。开发测试时可设为 `true`，生产环境必须设为 `false`，否则会暴露数据库凭据、APP_KEY 等敏感信息。

```env
APP_DEBUG=false
```

#### 2. CORS 跨域配置

默认允许所有域名跨域访问（`*`）。生产环境建议在 `.env` 中限制为你的实际域名，多个域名用逗号分隔：

```env
CORS_ALLOWED_ORIGINS=https://你的域名.com,https://www.你的域名.com
```

不设置此项则保持默认 `*`（允许所有），适用于开发测试。

#### 3. Session Cookie 安全

- `secure`：生产环境（`APP_ENV=production`）自动启用 HTTPS-only Cookie，开发环境不受影响
- `same_site`：默认 `lax`，防止跨站请求伪造

如需自定义，在 `.env` 中设置：

```env
SESSION_SECURE_COOKIE=true
SESSION_SAME_SITE=lax
```

#### 4. 内存限制

用户导出、群发邮件等大数据量操作的单请求内存上限为 512MB，防止异常请求耗尽服务器内存。正常使用不受影响，可满足数十万用户规模的导出需求。

## 🤝 Contributing 🤝 贡献

Issues and Pull Requests are welcome to help improve the project.

欢迎提交 Issue 和 Pull Request 来帮助改进项目。

## 📈 Star History

[![Stargazers over time](https://starchart.cc/jungann2/Xboard2.svg)](https://starchart.cc/jungann2/Xboard2)
