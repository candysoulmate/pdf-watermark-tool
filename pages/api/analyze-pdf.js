import formidable from "formidable";
import * as pdfjsLib from "pdfjs-dist";
import fs from "fs";
import { promisify } from "util";
import { createCanvas } from "canvas";

// 将文件操作方法转换为Promise形式
const readFile = promisify(fs.readFile);
const unlink = promisify(fs.unlink);

// 设置PDF.js worker
const pdfjsWorker = require("pdfjs-dist/build/pdf.worker.entry");
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// 禁用Next.js的默认body解析，因为我们使用formidable处理文件上传
export const config = {
  api: {
    bodyParser: false,
  },
};

/**
 * Canvas工厂类，用于创建和管理canvas实例
 * 这是PDF.js渲染PDF必需的组件
 */
const NodeCanvasFactory = {
  /**
   * 创建一个新的canvas实例
   * @param {number} width - canvas宽度
   * @param {number} height - canvas高度
   * @returns {Object} 包含canvas和context的对象
   */
  create(width, height) {
    const canvas = createCanvas(width, height);
    const context = canvas.getContext("2d");
    return {
      canvas,
      context,
    };
  },

  /**
   * 重置canvas的尺寸
   * @param {Object} canvasAndContext - canvas和context对象
   * @param {number} width - 新的宽度
   * @param {number} height - 新的高度
   */
  reset(canvasAndContext, width, height) {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  },

  /**
   * 销毁canvas实例（在node-canvas中不需要特别处理）
   */
  destroy(canvasAndContext) {
    // node-canvas不需要特别的清理
  },
};

/**
 * 检查颜色是否匹配水印颜色
 * @param {number} r - 红色通道值 (0-255)
 * @param {number} g - 绿色通道值 (0-255)
 * @param {number} b - 蓝色通道值 (0-255)
 * @param {Object} settings - 水印设置对象
 * @returns {boolean} 是否匹配水印颜色
 */
function isWatermarkColor(r, g, b, settings) {
  const { watermarkColor, watermarkColor2 } = settings;

  // 检查是否匹配第一种水印颜色（浅蓝色系）
  const matchesColor1 =
    Math.abs(r - watermarkColor.r) <= watermarkColor.tolerance &&
    Math.abs(g - watermarkColor.g) <= watermarkColor.tolerance &&
    Math.abs(b - watermarkColor.b) <= watermarkColor.tolerance;

  // 检查是否匹配第二种水印颜色（浅灰色系）
  const matchesColor2 =
    Math.abs(r - watermarkColor2.r) <= watermarkColor2.tolerance &&
    Math.abs(g - watermarkColor2.g) <= watermarkColor2.tolerance &&
    Math.abs(b - watermarkColor2.b) <= watermarkColor2.tolerance;

  return matchesColor1 || matchesColor2;
}

/**
 * 提取水印图像
 * @param {Object} page - PDF页面对象
 * @param {string} location - 水印位置 ('header'|'footer'|'center')
 * @param {Object} settings - 水印设置对象
 * @returns {Promise<string>} 水印图像的base64字符串
 */
async function extractWatermarkImage(page, location, settings) {
  // 使用2.0的缩放比例以获得更好的图像质量
  const scale = 2.0;
  const viewport = page.getViewport({ scale });
  const { canvas, context } = NodeCanvasFactory.create(
    viewport.width,
    viewport.height
  );

  // 渲染页面
  await page.render({
    canvasContext: context,
    viewport,
    canvasFactory: NodeCanvasFactory,
  }).promise;

  // 根据位置提取不同区域的图像
  const { width, height } = canvas;
  let imageData;
  let regionCanvas = createCanvas(width, height);
  let regionContext = regionCanvas.getContext("2d");

  if (location === "header") {
    const headerHeight = height * (settings.headerHeight / 100);
    imageData = context.getImageData(0, 0, width, headerHeight);
    regionCanvas.height = headerHeight;
  } else if (location === "footer") {
    const footerHeight = height * (settings.footerHeight / 100);
    const startY = height - footerHeight;
    imageData = context.getImageData(0, startY, width, footerHeight);
    regionCanvas.height = footerHeight;
  } else {
    // 中间区域
    const headerHeight = height * (settings.headerHeight / 100);
    const footerHeight = height * (settings.footerHeight / 100);
    const startY = headerHeight;
    const centerHeight = height - headerHeight - footerHeight;
    imageData = context.getImageData(0, startY, width, centerHeight);
    regionCanvas.height = centerHeight;
  }

  regionContext.putImageData(imageData, 0, 0);
  return regionCanvas.toDataURL("image/png");
}

/**
 * 分析页面中的水印
 * @param {Object} page - PDF页面对象
 * @param {Object} settings - 水印设置对象
 * @returns {Promise<Array>} 水印信息数组
 */
async function analyzePage(page, settings) {
  const watermarks = [];
  const scale = 2.0;
  const viewport = page.getViewport({ scale });
  const { canvas, context } = NodeCanvasFactory.create(
    viewport.width,
    viewport.height
  );

  // 渲染页面
  await page.render({
    canvasContext: context,
    viewport,
    canvasFactory: NodeCanvasFactory,
  }).promise;

  // 分析页眉区域
  const headerPreview = await extractWatermarkImage(page, "header", settings);
  watermarks.push({
    type: "image",
    location: "header",
    previewImage: headerPreview,
    selected: false,
  });

  // 分析页脚区域
  const footerPreview = await extractWatermarkImage(page, "footer", settings);
  watermarks.push({
    type: "image",
    location: "footer",
    previewImage: footerPreview,
    selected: false,
  });

  // 分析中间区域的文字水印
  const textContent = await page.getTextContent();
  const centerWatermarks = new Set();

  for (const item of textContent.items) {
    const { str } = item;
    // 检查文本是否可能是水印
    if (str.length > 3 && isWatermarkText(str)) {
      centerWatermarks.add(str);
    }
  }

  if (centerWatermarks.size > 0) {
    const centerPreview = await extractWatermarkImage(page, "center", settings);
    watermarks.push({
      type: "text",
      location: "center",
      content: Array.from(centerWatermarks).join(", "),
      previewImage: centerPreview,
      selected: false,
    });
  }

  return watermarks;
}

/**
 * 判断文本是否为水印
 * @param {string} text - 要检查的文本
 * @returns {boolean} 是否是水印文本
 */
function isWatermarkText(text) {
  // 水印文本的特征关键词
  const watermarkKeywords = [
    "confidential",
    "机密",
    "内部",
    "internal",
    "草稿",
    "draft",
    "版权",
    "copyright",
    "禁止",
    "prohibited",
    "保密",
    "secret",
  ];
  const lowercaseText = text.toLowerCase();
  return watermarkKeywords.some((keyword) => lowercaseText.includes(keyword));
}

/**
 * API路由处理函数
 * 处理PDF文件上传和水印分析
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "只支持POST请求" });
  }

  const form = formidable({
    keepExtensions: true,
    multiples: false,
    maxFileSize: 50 * 1024 * 1024, // 50MB
  });

  try {
    // 解析上传的文件和字段
    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        resolve([fields, files]);
      });
    });

    if (!files.file || !files.file[0]) {
      return res.status(400).json({ message: "未找到上传的文件" });
    }

    const settings = JSON.parse(fields.settings || "{}");
    const file = files.file[0];
    const data = await readFile(file.filepath);

    // 加载PDF文档
    const pdfDoc = await pdfjsLib.getDocument({
      data: new Uint8Array(data.buffer),
      canvasFactory: NodeCanvasFactory,
    }).promise;

    // 分析所有页面
    const allWatermarks = [];
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const pageWatermarks = await analyzePage(page, settings);

      // 记录水印出现的页码
      pageWatermarks.forEach((watermark) => {
        const existingWatermark = allWatermarks.find(
          (w) => w.type === watermark.type && w.location === watermark.location
        );

        if (existingWatermark) {
          existingWatermark.pages.push(i);
        } else {
          watermark.pages = [i];
          allWatermarks.push(watermark);
        }
      });
    }

    // 清理临时文件
    await unlink(file.filepath);

    res.status(200).json({ watermarks: allWatermarks });
  } catch (error) {
    console.error("处理PDF时出错:", error);
    res.status(500).json({ message: "处理PDF时出错: " + error.message });
  }
}
