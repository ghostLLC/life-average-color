# 生活平均色 (Life Average Color)

> 你的相册，调成一杯莫吉托的颜色

选取一个月的照片，AI 帮你提取这个月的生活色系，生成一张可分享的信息卡片。

## 怎么用

1. 打开 App，授权相册权限
2. 选择月份（左右箭头切换）
3. 点「开始分析」
4. 等待几秒，卡片生成
5. 保存到相册或分享给朋友

## 技术栈

- **Expo** (React Native) — 跨平台原生 App
- **LAB 色彩空间 + K-means 聚类** — 提取照片主色
- **DeepSeek API** — AI 生成诗意配文

## 颜色算法

```
照片像素 → LAB 转换 → K-means 聚类(单图3主色) 
         → 加权 K-means(跨图5核心色) 
         → 12色站平滑渐变 → 饱和度/明度调校
```

## 开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npx expo start

# 在 Android 模拟器或 Expo Go 中预览
npx expo start --android
```

### 配置

复制 `.env.example` 为 `.env`，填入 DeepSeek API Key：

```
EXPO_PUBLIC_DEEPSEEK_API_KEY=sk-xxxxxxxx
```

## 许可

MIT
