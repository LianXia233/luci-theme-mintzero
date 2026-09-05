# Release Guide

本文档说明如何创建和发布 luci-theme-mintzero 的正式版本。

## 自动发布流程

该项目使用 GitHub Actions 自动化构建和发布流程。

### 构建触发条件

1. **推送到 main 分支** → 自动构建并发布到 `nightly` prerelease
2. **推送版本标签** (如 `v1.0.0`) → 自动构建并创建正式 Release
3. **手动触发** → 在 GitHub Actions 页面手动触发，可指定版本号

### 工作流说明

#### main 分支构建

每次推送到 `main` 分支都会：
- 对两个目标架构编译：x86_64 和 mediatek/filogic
- 将产物上传到 workflow artifacts（供下载）
- 发布到 `nightly` prerelease（预发布版本）

#### 版本标签构建 (v*.*.*)

创建形如 `v1.0.0` 的版本标签会：
- 对两个目标架构编译
- 将产物上传到 workflow artifacts
- 发布到同名 Release（正式版本）
- 产物文件名包含版本号前缀

### 产物说明

编译产物为架构无关的 OpenWrt 安装包（主题无 `src/`，luci.mk 设 `PKGARCH=all`；双目标构建仅作验证，产物内容相同）：
- `luci-theme-mintzero-v1.0.0-x86_64.ipk` - x86_64 架构
- `luci-theme-mintzero-v1.0.0-mediatek_filogic.ipk` - MediaTek Filogic 架构

每个版本在两个位置都可下载：
1. **GitHub Releases** - 正式版本页面
2. **GitHub Actions Artifacts** - 工作流临时产物

## 创建正式版本发布

### 方法一：使用发布脚本（推荐）

```bash
# 创建并推送 v1.0.0 标签，自动触发构建
./scripts/create-release.sh v1.0.0

# 不指定版本则默认为 v1.0.0
./scripts/create-release.sh
```

脚本会：
- 验证版本号格式（必须是 v<major>.<minor>.<patch> 形式）
- 检查工作树是否干净
- 创建注解标签
- 推送标签到远程仓库
- 自动触发 GitHub Actions 构建

### 方法二：手动 git 命令

```bash
# 创建注解标签
git tag -a v1.0.0 -m "Release v1.0.0"

# 推送标签到远程
git push origin v1.0.0

# 或推送所有标签
git push origin --tags
```

### 方法三：GitHub Web 界面

1. 访问 https://github.com/LianXia233/luci-theme-mintzero/tags
2. 点击"Releases"或"Create a new release"
3. 输入标签名 `v1.0.0`
4. 添加发布说明
5. 点击"Publish release"

## 监视构建进度

### GitHub Actions

1. 访问 https://github.com/LianXia233/luci-theme-mintzero/actions
2. 找到最新的 "Build Package" 工作流运行
3. 查看各个步骤的日志

### Releases 页面

1. 访问 https://github.com/LianXia233/luci-theme-mintzero/releases
2. 找到对应的版本（如 v1.0.0）
3. 查看产物文件列表

## 版本号约定

遵循 [Semantic Versioning](https://semver.org/)：

- **MAJOR** - 重大更新，不兼容的改动
- **MINOR** - 功能更新，向后兼容
- **PATCH** - 错误修复，向后兼容

例如：
- `v1.0.0` - 首个稳定版本
- `v1.1.0` - 增加新功能
- `v1.0.1` - 修复 bug
- `v2.0.0-beta` - 预发布版本

## 发布检查清单

在创建正式版本前，确保：

- [ ] 所有代码已提交到 `main` 分支
- [ ] 所有测试通过
- [ ] README 已更新，包括新功能说明
- [ ] 版本号已决定
- [ ] 准备好发布说明（Release notes）

## 发布说明建议

在 GitHub Releases 页面添加详细说明：

```markdown
# 新增功能

- 功能 1
- 功能 2

# 改进

- 改进 1
- 改进 2

# 修复

- 修复 1
- 修复 2

# 安装

下载对应架构的 `.ipk` 文件后安装到 OpenWrt 设备：

```sh
scp luci-theme-mintzero-v1.0.0-x86_64.ipk root@192.168.1.1:/tmp/
ssh root@192.168.1.1 "opkg install /tmp/luci-theme-mintzero-v1.0.0-x86_64.ipk"
```

# 致谢

感谢所有贡献者！
```

## 常见问题

### Q: 如何撤销发布？
A: 删除 GitHub 上的标签：
```bash
git tag -d v1.0.0          # 删除本地标签
git push origin :refs/tags/v1.0.0  # 删除远程标签
```

### Q: 如何重新发布同一版本？
A: 发布脚本会检查标签是否存在。删除标签后重新创建：
```bash
git tag -d v1.0.0
git push origin :refs/tags/v1.0.0
./scripts/create-release.sh v1.0.0
```

### Q: 如何修改发布说明？
A: 在 GitHub Releases 页面直接编辑版本信息，无需重新构建。

### Q: 构建失败怎么办？
A: 查看 GitHub Actions 日志，修复问题后删除标签重新发布。

### Q: 如何下载特定版本？
A: 访问 https://github.com/LianXia233/luci-theme-mintzero/releases/tag/v1.0.0

## 更多信息

- [GitHub Actions 文档](https://docs.github.com/en/actions)
- [Semantic Versioning](https://semver.org/)
- [OpenWrt 安装包管理](https://openwrt.org/)
