import formidable from "formidable";
import { PDFDocument } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import fs from "fs";
import { promisify } from "util";
import { createCanvas, Image } from "canvas";

// 将文件操作方法转换为Promise形式
const readFile = promisify(fs.readFile);
const unlink = promisify(fs.unlink);
const writeFile = promisify(fs.writeFile);

// 设置PDF.js worker
const pdfjsWorker = require("pdfjs-dist/build/pdf.worker.entry");
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/**
 * Canvas工厂类，用于创建和管理canvas实例
 */
const NodeCanvasFactory = {
  create(width, height) {
    const canvas = createCanvas(width, height);
    const context = canvas.getContext("2d");
    return {
      canvas,
      context,
    };
  },

  reset(canvasAndContext, width, height) {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  },

  destroy(canvasAndContext) {
    // node-canvas不需要特别的清理
  },
};

// 配置API路由
export const config = {
  api: {
    bodyParser: false,
    responseLimit: false, // 禁用响应大小限制，因为PDF可能很大
  },
};

/**
 * 将PDF页面渲染为图片
 * @param {Object} page - PDF页面对象
 * @param {number} scale - 缩放比例，默认2.0以获得更好的图像质量
 * @returns {Promise<Canvas>} 渲染后的canvas对象
 */
async function renderPageToImage(page, scale = 2.0) {
  const viewport = page.getViewport({ scale });
  const canvasFactory = NodeCanvasFactory;
  const { canvas, context } = canvasFactory.create(
    viewport.width,
    viewport.height
  );

  // 渲染PDF页面到canvas
  await page.render({
    canvasContext: context,
    viewport: viewport,
    canvasFactory: canvasFactory,
  }).promise;

  return canvas;
}

/**
 * 处理图片中的水印
 * @param {Canvas} canvas - 包含PDF页面的canvas对象
 * @param {Object} watermark - 水印信息对象
 * @param {Object} settings - 水印设置对象
 * @returns {Canvas} 处理后的canvas对象
 */
function processImage(canvas, watermark, settings) {
  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;

  /**
   * 判断颜色是否匹配水印颜色
   * @param {number} r - 红色通道值
   * @param {number} g - 绿色通道值
   * @param {number} b - 蓝色通道值
   * @returns {boolean} 是否匹配水印颜色
   */
  function isWatermarkColor(r, g, b) {
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

  if (watermark.location === "header") {
    // 处理页眉水印
    const headerHeight = height * (settings.headerHeight / 100);
    const startY = height - headerHeight;

    const imageData = ctx.getImageData(0, startY, width, headerHeight);
    const data = imageData.data;

    // 遍历所有像素
    for (let y = 0; y < headerHeight; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        // 如果是水印颜色，则将其替换为白色
        if (isWatermarkColor(r, g, b) && a > 10) {
          data[i] = 255; // R
          data[i + 1] = 255; // G
          data[i + 2] = 255; // B
          data[i + 3] = 255; // A
        }
      }
    }

    ctx.putImageData(imageData, 0, startY);
    ctx.fillStyle = "white";
    ctx.fillRect(0, startY, width, headerHeight);
  } else if (watermark.location === "footer") {
    // 处理页脚水印
    const footerHeight = height * (settings.footerHeight / 100);
    const startY = 0;

    const imageData = ctx.getImageData(0, startY, width, footerHeight);
    const data = imageData.data;

    // 遍历所有像素
    for (let y = 0; y < footerHeight; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        // 如果是水印颜色，则将其替换为白色
        if (isWatermarkColor(r, g, b) && a > 10) {
          data[i] = 255;
          data[i + 1] = 255;
          data[i + 2] = 255;
          data[i + 3] = 255;
        }
      }
    }

    ctx.putImageData(imageData, 0, startY);
    ctx.fillStyle = "white";
    ctx.fillRect(0, startY, width, footerHeight);
  } else if (watermark.location === "center") {
    // 处理中间水印
    const headerHeight = height * (settings.headerHeight / 100);
    const footerHeight = height * (settings.footerHeight / 100);
    const startY = headerHeight;
    const centerHeight = height - headerHeight - footerHeight;

    const imageData = ctx.getImageData(0, startY, width, centerHeight);
    const data = imageData.data;
    let changed = false;

    // 遍历所有像素
    for (let y = 0; y < centerHeight; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        // 如果是水印颜色，则将其替换为白色
        if (isWatermarkColor(r, g, b) && a > 10) {
          data[i] = 255;
          data[i + 1] = 255;
          data[i + 2] = 255;
          data[i + 3] = 255;
          changed = true;
        }
      }
    }

    // 只有在实际发生改变时才更新canvas
    if (changed) {
      ctx.putImageData(imageData, 0, startY);
    }
  }

  return canvas;
}

/**
 * 创建修改后的PDF文档
 * @param {Buffer} inputPdfBytes - 输入PDF文件的二进制数据
 * @param {Array} watermarks - 水印信息数组
 * @param {Object} settings - 水印设置对象
 * @returns {Promise<Uint8Array>} 处理后的PDF文档数据
 */
async function createModifiedPDF(inputPdfBytes, watermarks, settings) {
  try {
    const data = new Uint8Array(inputPdfBytes);
    const pdfDoc = await pdfjsLib.getDocument({
      data,
      canvasFactory: NodeCanvasFactory,
    }).promise;

    const newPdfDoc = await PDFDocument.create();

    // 处理每一页
    for (let i = 0; i < pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i + 1);
      const viewport = page.getViewport({ scale: 1.0 });

      // 将页面渲染为超高分辨率图片
      let canvas = await renderPageToImage(page, 4.0);

      // 获取当前页面的水印
      const pageWatermarks = watermarks.filter((w) => w.selected);

      // 首先处理中间水印
      canvas = processImage(canvas, { location: "center" }, settings);

      // 然后处理页眉和页脚水印
      for (const watermark of pageWatermarks) {
        canvas = processImage(canvas, watermark, settings);
      }

      // 将处理后的图片转换为PDF页面
      const imageData = canvas.toBuffer("image/png", {
        quality: 1,
        compressionLevel: 0,
      });

      const image = await newPdfDoc.embedPng(imageData);
      const newPage = newPdfDoc.addPage([viewport.width, viewport.height]);
      newPage.drawImage(image, {
        x: 0,
        y: 0,
        width: viewport.width,
        height: viewport.height,
      });
    }

    // 保存PDF文档，禁用压缩以保持图像质量
    const modifiedPdfBytes = await newPdfDoc.save({
      useObjectStreams: false,
      addDefaultPage: false,
      compress: false,
    });

    return modifiedPdfBytes;
  } catch (error) {
    console.error("处理PDF时出错:", error);
    throw error;
  }
}

/**
 * 安全地删除文件
 * @param {string} filepath - 要删除的文件路径
 */
async function safeUnlink(filepath) {
  try {
    if (filepath && fs.existsSync(filepath)) {
      await unlink(filepath);
    }
  } catch (err) {
    console.error(`删除文件 ${filepath} 失败:`, err);
  }
}

/**
 * API路由处理函数
 * 处理PDF文件的水印移除请求
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "只支持POST请求" });
  }

  let inputFile = null;
  let outputPath = null;

  try {
    const form = formidable({
      keepExtensions: true,
      multiples: false,
    });

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

    inputFile = files.file[0];
    const watermarks = JSON.parse(fields.watermarks);
    const settings = JSON.parse(fields.settings || "{}");

    // 读取PDF文件
    const inputPdfBytes = await readFile(inputFile.filepath);

    // 处理PDF文件
    const modifiedPdfBytes = await createModifiedPDF(
      inputPdfBytes,
      watermarks,
      settings
    );

    // 创建临时文件保存处理后的PDF
    outputPath = `${inputFile.filepath}-processed.pdf`;
    await writeFile(outputPath, modifiedPdfBytes);

    // 发送处理后的文件
    const processedPdfBuffer = await readFile(outputPath);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="processed.pdf"'
    );

    // 发送文件
    res.send(processedPdfBuffer);

    // 等待响应完成后再删除文件
    res.on("finish", async () => {
      await safeUnlink(inputFile.filepath);
      await safeUnlink(outputPath);
    });
  } catch (error) {
    console.error("处理PDF时出错:", error);

    // 如果有原始文件，尝试返回原始文件
    if (inputFile) {
      try {
        const originalPdfBuffer = await readFile(inputFile.filepath);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          'attachment; filename="original.pdf"'
        );
        return res.send(originalPdfBuffer);
      } catch (readError) {
        console.error("读取原始文件失败:", readError);
      }
    }

    return res.status(500).json({ message: "处理PDF时出错" });
  } finally {
    // 如果响应已经结束但文件还存在，确保清理
    if (!res.writableEnded) {
      res.on("finish", async () => {
        await safeUnlink(inputFile?.filepath);
        await safeUnlink(outputPath);
      });
    }
  }
}
