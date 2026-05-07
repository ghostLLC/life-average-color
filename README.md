# 生活平均色 (Life Average Color)

> 你的相册，调成一杯莫吉托的颜色

选取任意时段内的照片，AI 提取你的生活色系，生成可分享的海报卡片。

## 功能

- **灵活时段** — 今天 / 本周 / 本月 / 今年 / 自定义日期范围，任意选择
- **智能筛选** — OCR 自动识别并标记截图、聊天记录等非实拍照片，可在审核页面手动调整
- **色彩分析** — 4 路并行处理，K-means 聚类提取核心色系，LAB 空间渐变插值
- **色号命名** — 中国传统色库（120 色）匹配，胭脂、霁色、秋香……
- **照片推荐** — 自动推荐 0–3 张最接近平均色的照片
- **AI 配文** — DeepSeek 根据色系生成诗意文案，支持输入个人感受重新生成
- **海报分享** — 一键生成包含渐变色、色名、推荐照片的品牌海报，直接分享到微信/QQ
- **往期回顾** — 首页轮播展示历史分析，点击即可回顾
- **暗色主题** — 全暗色界面，渐入动效，精致排版

## 怎么用

1. 打开 App，授权相册权限
2. 选择时间段（今天/本周/本月/今年/自定义）
3. 点「开始分析」→ 进入照片审核页
4. OCR 自动识别截图（红框），可手动点击每张照片切换选择
5. 确认 → 等待色彩融合分析
6. 查看结果：渐变色卡、核心色名、推荐照片
7. 可选输入个人感受 →「重新配文」
8. 「分享海报」发送给朋友，或「保存海报」到相册

## 技术栈

- **React Native 0.81** — 纯 RN（已从 Expo 迁移）
- **LAB 色彩空间 + K-means 聚类** — 色彩科学
- **pako** (纯 JS zlib) — PNG 解码，零 Node.js 依赖
- **ML Kit Text Recognition** — 设备端 OCR 截图检测
- **DeepSeek API** — AI 诗意配文
- **react-native-linear-gradient** — 渐变色渲染
- **react-native-share** — 系统分享（微信/QQ 等）
- **react-native-view-shot** — 海报截屏

## 颜色算法

```
照片 → 缩略 200px → PNG 解码 → LAB 转换 → 稀疏采样(5000点/图)
    → K-means 聚类(单图 3 主色)
    → 加权 K-means(跨图合成 3 核心色)
    → 相近色合并(自适应阈值)
    → LAB 空间比例插值(8 色阶渐变)
    → 中国传统色命名(120 色库)
```

## 构建

```bash
# 安装依赖
npm install

# 配置 API Key（DeepSeek 文案生成）
cp .env.example .env
# 编辑 .env，填入 DEEPSEEK_API_KEY

# Metro 开发服务器
npx react-native start

# Android 构建
cd android && gradlew.bat assembleDebug

# 安装到手机
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

构建前确保 `JAVA_HOME` 指向 JDK 17+，Android SDK 36 已安装。

## 项目结构

```
App.tsx                     # 主界面：时段选择、分析触发、结果展示、历史轮播
index.ts                    # 入口
src/
  hooks/
    usePhotos.ts            # 相册权限 + CameraRoll 照片加载
    useColor.ts             # 分析管线：解码→提取→合成→渐变→命名→推荐→配文
    useOCRFilter.ts         # ML Kit OCR 截图检测
  color/
    lab.ts                  # RGB ↔ LAB 转换 + 均值
    decodeImage.ts          # 图片解码 (ImageResizer + RNFS + pako)
    extract.ts              # 单图 K-means 主色提取
    synthesize.ts           # 跨图加权 K-means 调色板合成
    gradient.ts             # LAB 空间比例插值渐变
    beautify.ts             # 饱和度/明度后处理
    nameColor.ts            # 中国传统色命名（120 色库 + LAB 距离）
  caption/
    generate.ts             # DeepSeek API 文案生成
  components/
    CardView.tsx            # 渐变色卡片（色名浮动标签 + 配文叠加）
    Poster.tsx              # 海报（品牌 + 渐变 + 色名 + 推荐照片 + 水印）
    PhotoPicker.tsx         # 照片审核（OCR 实时标记 + 手动选择）
    PeriodSelector.tsx      # 时段选择器（预设 + 自定义日期）
    CustomDatePicker.tsx    # 暗色主题日期选择器
    AnalysisAnimation.tsx   # 分析过程色彩融合动画
  types.ts                  # 类型定义
```

## 许可

MIT
