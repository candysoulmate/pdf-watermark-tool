# PDF 水印处理工具

一个基于 Next.js 开发的在线 PDF 水印处理工具，支持智能识别和移除 PDF 文档中的水印。

## 功能特性

- 智能识别 PDF 文档中的水印
- 支持页眉页脚水印的定位和移除
- 支持多种水印颜色的识别和处理
- 支持批量选择和移除水印
- 实时预览水印区域
- 可自定义水印识别参数
- 支持高分辨率 PDF 处理
- 保持原始 PDF 质量

## 技术栈

- **前端框架**: Next.js + React
- **UI 组件**: Ant Design
- **PDF 处理**:
  - pdf-lib: PDF 文档的创建和修改
  - pdf.js: PDF 渲染和解析
  - node-canvas: 服务端 Canvas 实现
- **图像处理**:
  - sharp: 高性能图像处理
  - canvas: 图像渲染和像素操作
- **容器化**: Docker

## 技术实现细节

### PDF 处理流程

1. **文件上传与解析**

   - 使用 formidable 处理文件上传
   - 支持大文件处理，无响应大小限制
   - 自动清理临时文件

2. **水印检测算法**

   - 基于颜色匹配的水印识别
   - 支持两种水印颜色设置：
     - 默认颜色 1: RGB(221, 228, 250)
     - 默认颜色 2: RGB(211, 211, 211)
   - 颜色容差：默认 30
   - 区域划分：
     - 页眉区域：顶部 9%
     - 页脚区域：底部 9%
     - 中间区域：动态计算

3. **图像处理优化**

   - 使用 sharp 进行高性能图像处理
   - 2 倍渲染比例确保高质量输出
   - RGB 颜色空间处理
   - 内存优化的像素处理

4. **水印移除策略**
   - 页眉页脚区域：直接填充白色背景
   - 中间区域：基于颜色匹配的像素替换
   - 保持文档其他内容不变

### 性能优化

1. **内存管理**

   - 流式处理大型 PDF 文件
   - 自动垃圾回收
   - 临时文件管理

2. **并发处理**

   - 异步处理 PDF 页面
   - 并行图像处理
   - 响应式用户界面

3. **缓存策略**
   - 图像缓存
   - 页面渲染缓存
   - 水印检测结果缓存

## 快速开始

### 使用 Docker 部署

1. 构建镜像：

```bash
docker build -t pdf-watermark-tool .
```

2. 运行容器：

```bash
docker run -p 3000:3000 pdf-watermark-tool
```

### 本地开发

1. 安装依赖：

```bash
yarn install
```

2. 启动开发服务器：

```bash
yarn dev
```

3. 构建生产版本：

```bash
yarn build
```

## 环境要求

- Node.js >= 16
- 系统依赖：
  - cairo
  - pango
  - libpdf
  - build-essential

## 配置说明

### 水印设置

```javascript
{
  headerHeight: 9,        // 页眉高度（占页面高度的百分比）
  footerHeight: 9,        // 页脚高度（占页面高度的百分比）
  watermarkColor1: {      // 第一种水印颜色
    r: 221,
    g: 228,
    b: 250,
    tolerance: 30        // 颜色容差
  },
  watermarkColor2: {      // 第二种水印颜色
    r: 211,
    g: 211,
    b: 211,
    tolerance: 30        // 颜色容差
  }
}
```

### 环境变量

```env
NODE_ENV=production
PORT=3000
MAX_FILE_SIZE=50mb
```

## API 文档

### POST /api/analyze-pdf

分析 PDF 文件中的水印。

请求体：

- `file`: PDF 文件
- `settings`: 水印设置（可选）

响应：

```json
{
  "watermarks": [
    {
      "type": "header",
      "location": "top",
      "pages": [1, 2, 3],
      "previewImage": "base64..."
    }
  ]
}
```

### POST /api/remove-watermarks

移除 PDF 文件中的水印。

请求体：

- `file`: PDF 文件
- `watermarks`: 要移除的水印索引数组
- `settings`: 水印设置（可选）

响应：

- 处理后的 PDF 文件

## 注意事项

1. 文件处理

   - 最大支持 50MB 的 PDF 文件
   - 建议使用清晰度较高的 PDF

2. 水印识别
   - 颜色容差影响识别准确度
   - 页眉页脚比例可能需要根据文档调整
   - 某些特殊水印可能需要调整参数

## 开发计划

- [ ] 支持更多水印类型
- [ ] 添加批量处理功能
- [ ] 优化水印识别算法
- [ ] 添加文件处理进度显示
- [ ] 支持自定义输出格式

## 贡献指南

1. Fork 项目
2. 创建特性分支
3. 提交改动
4. 发起 Pull Request

## 许可证

本项目采用 MIT 许可证。详见 [LICENSE](LICENSE) 文件。

## 联系方式

如有问题或建议，请提交 Issue 或联系开发团队。
