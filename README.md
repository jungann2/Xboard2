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
