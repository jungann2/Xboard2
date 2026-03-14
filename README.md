# Xboard2

<div align="center">

[![Telegram](https://img.shields.io/badge/Telegram-Channel-blue)](https://t.me/XboardOfficial)
![PHP](https://img.shields.io/badge/PHP-8.2+-green.svg)
![MySQL](https://img.shields.io/badge/MySQL-5.7+-blue.svg)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

## 📖 Introduction

Xboard2 is a modern panel system built on Laravel 11, focusing on providing a clean and efficient user experience. Forked from [Xboard](https://github.com/cedar2025/Xboard) with security enhancements and additional features.

## ✨ Features

- 🚀 Built with Laravel 12 + Octane for significant performance gains
- 🎨 Redesigned admin interface (React + Shadcn UI)
- 📱 Modern user frontend (Vue3 + TypeScript)
- 🐳 Ready-to-use Docker deployment solution
- 🎯 Optimized system architecture for better maintainability

## 🚀 Quick Start

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
> ⚠️ Make sure to save the admin credentials shown during installation

## 📖 Documentation

### 🔄 Upgrade Notice
> 🚨 **Important:** This version involves significant changes. Please strictly follow the upgrade documentation and backup your database before upgrading. Note that upgrading and migration are different processes, do not confuse them.

### Development Guides
- [Plugin Development Guide](./docs/en/development/plugin-development-guide.md) - Complete guide for developing Xboard2 plugins

### Deployment Guides
- [Deploy with 1Panel](./docs/en/installation/1panel.md)
- [Deploy with Docker Compose](./docs/en/installation/docker-compose.md)
- [Deploy with aaPanel](./docs/en/installation/aapanel.md)
- [Deploy with aaPanel + Docker](./docs/en/installation/aapanel-docker.md) (Recommended)

### Migration Guides
- [Migrate from v2board dev](./docs/en/migration/v2board-dev.md)
- [Migrate from v2board 1.7.4](./docs/en/migration/v2board-1.7.4.md)
- [Migrate from v2board 1.7.3](./docs/en/migration/v2board-1.7.3.md)

## 💻 系统要求

- 推荐系统：Debian 12 (Bookworm)，Ubuntu 22.04+ / CentOS 7+ 也可使用
- PHP 8.2+、MySQL 5.7+（或 SQLite）、Redis
- Docker 部署（推荐）或 LNMP 环境
- 内存：≥ 512MB（含数据库和 Redis）

> Debian 推荐理由：Xboard2 依赖 PHP 8.2+、Redis、MySQL 等标准 LEMP 栈，Debian 12 官方源直接提供 PHP 8.2，Docker 支持最稳定，系统开销最小。Ubuntu 同样兼容，CentOS 需通过 Remi 源安装 PHP 8.2。

## 🛠️ Tech Stack

- Backend: Laravel 11 + Octane
- Admin Panel: React + Shadcn UI + TailwindCSS
- User Frontend: Vue3 + TypeScript + NaiveUI
- Deployment: Docker + Docker Compose
- Caching: Redis + Octane Cache

## 📷 Preview
![Admin Preview](./docs/images/admin.png)

![User Preview](./docs/images/user.png)

## ⚠️ Disclaimer

This project is for learning and communication purposes only. Users are responsible for any consequences of using this project.

## 🌟 Maintenance Notice

This project is currently under light maintenance. We will:
- Fix critical bugs and security issues
- Review and merge important pull requests
- Provide necessary updates for compatibility

However, new feature development may be limited.

## 🔔 Important Notes

1. Restart required after modifying admin path:
```bash
docker compose restart
```

2. For aaPanel installations, restart the Octane daemon process

## 🔒 安全配置说明

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

## 🤝 Contributing

Issues and Pull Requests are welcome to help improve the project.

## 📈 Star History

[![Stargazers over time](https://starchart.cc/jungann2/Xboard2.svg)](https://starchart.cc/jungann2/Xboard2)
