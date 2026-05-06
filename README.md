# 生活平均色 (Life Average Color)

> 你的相册，调成一杯莫吉托的颜色

选取一个月的照片，AI 帮你提取这个月的生活色系，生成一张可分享的信息卡片。

## 功能

- **月份浏览** — 左右箭头切换月份，自动加载该时段照片
- **色彩分析** — 4 路并行处理，实时显示进度，可随时取消
- **色号命名** — 对中国传统色库（120 色），给核心色匹配诗意名称（胭脂、霁色…）
- **照片推荐** — 自动推荐 0-3 张最接近平均色的照片，建立视觉联想
- **AI 配文** — DeepSeek 根据色系生成诗意文案（≤20 字）；可选输入个人感受，让文案更有参与感
- **卡片分享** — 保存到相册或分享给朋友，PNG 高清输出
- **暗色主题** — 全暗色界面，无闪烁过渡

## 怎么用

1. 打开 App，授权相册权限
2. 选择月份（左右箭头切换）
3. 点「开始分析」，等待进度条走完
4. 卡片生成，查看诗意配文（可选输入你的感受重新生成）
5. 查看推荐照片和色号命名
6. 保存到相册或分享给朋友

## 技术栈

- **Expo** (React Native) — 跨平台原生 App
- **LAB 色彩空间 + K-means 聚类** — 提取照片主色
- **pako** (纯 JS zlib) — PNG 解码，零 Node.js 依赖
- **DeepSeek API** — AI 生成诗意配文

## 颜色算法

```
照片解码 → LAB 转换 → 稀疏采样(5000点/图)
         → K-means 聚类(单图 3 主色)
         → 加权 K-means(跨图合成 5 核心色)
         → LAB 空间线性插值(8 色站渐变)
         → 饱和度/明度微调
```

性能优化：4 路并发解码 + K-means，500 张照片从串行 ~2 分钟降至 ~30 秒。

## 构建

Debug APK 已配置为包含 JS bundle，可直接安装运行，无需 Metro 开发服务器。

```bash
# 构建 APK
cd android && gradlew.bat assembleDebug

# 安装到手机
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

构建前确保 `JAVA_HOME` 指向完整 JDK 17+（Android Studio 自带的 JBR 可用）。

## 开发

### 环境准备

```bash
# 安装依赖
npm install

# 配置 API Key（DeepSeek 文案生成）
cp .env.example .env
# 编辑 .env，填入你的 API Key
```

### 运行

```bash
# Expo 开发服务器
npx expo start

# Android（USB 连接手机）
npx expo start --android

# 或在 Android Studio 中打开 android/ 目录直接运行
```

### 项目结构

```
App.tsx                     # 主界面：月份选择、分析触发、卡片展示、感受输入
src/
  hooks/
    usePhotos.ts            # 相册权限 + 按月加载照片
    useColor.ts             # 分析管线：解码→提取→合成→渐变→命名→推荐→配文
  color/
    lab.ts                  # RGB ↔ LAB 转换 + 均值工具
    decodeImage.ts          # 图片解码（纯 JS PNG 解码器 + pako zlib）
    extract.ts              # 单图 K-means 主色提取
    synthesize.ts           # 跨图加权 K-means 调色板合成
    gradient.ts             # LAB 空间渐变插值（hex 输出）
    beautify.ts             # 饱和度/明度后处理
    nameColor.ts            # 中国传统色命名（120 色库 + LAB 距离匹配）
  caption/
    generate.ts             # DeepSeek API 文案生成（支持可选用户输入）
  card/
    CardView.tsx            # 渐变色卡片 + 色号命名组件（可截屏分享）
  types.ts                  # 共享类型定义
```

## 许可

MIT
