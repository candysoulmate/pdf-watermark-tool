import formidable from "formidable";
import { PDFDocument } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import fs from "fs";
import { promisify } from "util";
import { createCanvas } from "canvas";
import sharp from "sharp";

// 将文件操作方法转换为Promise形式
const readFile = promisify(fs.readFile);
const unlink = promisify(fs.unlink);
const writeFile = promisify(fs.writeFile);

// 设置PDF.js worker
const pdfjsWorker = require("pdfjs-dist/build/pdf.worker.entry");
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// 配置node-canvas
const nodeCanvas = require("canvas");
const Canvas = nodeCanvas.Canvas;
const NodeImage = nodeCanvas.Image;

// 创建自定义canvas工厂
const canvasFactory = {
  create(width, height) {
    const canvas = new Canvas(width, height);
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

/**
 * 将PDF页面渲染为图片
 * @param {Object} page - PDF页面对象
 * @param {number} scale - 缩放比例，默认2.0以获得更好的图像质量
 * @returns {Promise<Buffer>} 渲染后的图像数据
 */
async function renderPageToImage(page, scale = 2.0) {
  try {
    const viewport = page.getViewport({ scale });
    const { canvas, context } = canvasFactory.create(
      Math.floor(viewport.width),
      Math.floor(viewport.height)
    );

    // 设置白色背景
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);

    // 渲染页面
    await page.render({
      canvasContext: context,
      viewport: viewport,
      canvasFactory: canvasFactory,
      background: "white",
    }).promise;

    // 直接返回PNG格式的buffer
    return canvas.toBuffer("image/png");
  } catch (error) {
    console.error("渲染PDF页面时出错:", error);
    throw error;
  }
}

/**
 * 检查颜色是否匹配水印颜色
 * @param {Object} color - 待检查的颜色 {r, g, b}
 * @param {Object} settings - 水印设置
 * @returns {boolean} - 是否匹配水印颜色
 */
function isWatermarkColor(color, settings) {
  if (
    !color ||
    !settings ||
    !settings.watermarkColor1 ||
    !settings.watermarkColor2
  ) {
    return false;
  }

  const { watermarkColor1, watermarkColor2 } = settings;

  // 计算颜色差异
  function colorDifference(c1, c2) {
    const rDiff = Math.abs(c1.r - c2.r);
    const gDiff = Math.abs(c1.g - c2.g);
    const bDiff = Math.abs(c1.b - c2.b);
    return Math.max(rDiff, gDiff, bDiff); // 使用最大差异值
  }

  // 检查是否匹配第一种水印颜色
  const diff1 = colorDifference(color, watermarkColor1);
  const matchesColor1 = diff1 <= watermarkColor1.tolerance;

  // 检查是否匹配第二种水印颜色
  const diff2 = colorDifference(color, watermarkColor2);
  const matchesColor2 = diff2 <= watermarkColor2.tolerance;

  return matchesColor1 || matchesColor2;
}

/**
 * 确保图像数据是有效的PNG格式
 * @param {Buffer} imageData - 图像数据
 * @returns {Promise<Buffer>} - 处理后的PNG图像数据
 */
async function ensureValidPngImage(imageData) {
  try {
    const image = sharp(imageData);
    const metadata = await image.metadata();

    if (metadata.format !== "png") {
      return await image.png().toBuffer();
    }

    return imageData;
  } catch (error) {
    console.error("处理图像格式时出错:", error);
    throw error;
  }
}

/**
 * 处理图像，移除水印
 * @param {Buffer} imageBuffer - 图像数据
 * @param {Object} settings - 水印设置
 * @returns {Promise<Buffer>} - 处理后的图像数据
 */
async function processImage(imageBuffer, settings) {
  try {
    if (!imageBuffer || !settings) {
      throw new Error("无效的图像数据或设置");
    }

    console.log("水印设置:", JSON.stringify(settings, null, 2));

    // 确保输入图像是有效的PNG格式
    const validImageBuffer = await ensureValidPngImage(imageBuffer);

    // 使用sharp加载图像
    const image = sharp(validImageBuffer);
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
      throw new Error("无法获取图像尺寸");
    }

    // 计算页眉和页脚的高度（像素）
    const headerHeight = Math.ceil(
      (metadata.height * settings.headerHeight) / 100
    );
    const footerHeight = Math.ceil(
      (metadata.height * settings.footerHeight) / 100
    );

    console.log("图像处理信息:", {
      width: metadata.width,
      height: metadata.height,
      headerHeight,
      footerHeight,
      format: metadata.format,
      channels: metadata.channels,
    });

    // 转换为RGB格式并提取像素数据
    const { data, info } = await image
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // 创建新的图像数据
    const newData = Buffer.alloc(data.length);
    data.copy(newData);

    // 处理页眉区域（在页面顶部）
    for (let y = 0; y < headerHeight; y++) {
      for (let x = 0; x < info.width; x++) {
        const i = (y * info.width + x) * 3;
        // 直接设置为白色，确保完全移除水印
        newData[i] = 255; // R
        newData[i + 1] = 255; // G
        newData[i + 2] = 255; // B
      }
    }

    // 处理页脚区域（在页面底部）
    const footerStartY = metadata.height - footerHeight;
    for (let y = footerStartY; y < metadata.height; y++) {
      for (let x = 0; x < info.width; x++) {
        const i = (y * info.width + x) * 3;
        // 直接设置为白色，确保完全移除水印
        newData[i] = 255; // R
        newData[i + 1] = 255; // G
        newData[i + 2] = 255; // B
      }
    }

    // 处理中间区域
    for (let y = headerHeight; y < footerStartY; y++) {
      for (let x = 0; x < info.width; x++) {
        const i = (y * info.width + x) * 3;
        const color = {
          r: data[i],
          g: data[i + 1],
          b: data[i + 2],
        };

        if (isWatermarkColor(color, settings)) {
          newData[i] = 255; // R
          newData[i + 1] = 255; // G
          newData[i + 2] = 255; // B
        }
      }
    }

    // 创建新图像
    return await sharp(newData, {
      raw: {
        width: info.width,
        height: info.height,
        channels: 3,
      },
    })
      .png({ quality: 100 })
      .toBuffer();
  } catch (error) {
    console.error("处理图像时出错:", error);
    throw error;
  }
}

/**
 * 创建修改后的PDF
 * @param {Buffer} pdfBuffer - 原始PDF数据
 * @param {Array} watermarks - 水印信息
 * @param {Object} settings - 水印设置
 * @returns {Promise<Buffer>} - 处理后的PDF数据
 */
async function createModifiedPDF(pdfBuffer, watermarks, settings) {
  try {
    if (!pdfBuffer || !settings) {
      throw new Error("无效的PDF数据或设置");
    }

    // 使用pdf.js加载PDF文档
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(pdfBuffer),
      useSystemFonts: true,
      disableFontFace: true,
      canvasFactory: canvasFactory,
      isEvalSupported: false,
      nativeImageDecoderSupport: "none",
      ignoreEncryption: true,
    });

    const pdfJsDoc = await loadingTask.promise;
    const pdfDoc = await PDFDocument.create();

    // 处理每个页面
    for (let pageIndex = 0; pageIndex < pdfJsDoc.numPages; pageIndex++) {
      console.log(`处理第 ${pageIndex + 1} 页`);
      const pdfJsPage = await pdfJsDoc.getPage(pageIndex + 1);
      const viewport = pdfJsPage.getViewport({ scale: 1.0 });

      // 使用更高的缩放比例渲染页面以获得更好的质量
      const imageData = await renderPageToImage(pdfJsPage, 2.0);

      // 处理图像
      const modifiedImage = await processImage(imageData, settings);

      // 嵌入处理后的图像
      const image = await pdfDoc.embedPng(modifiedImage);

      // 创建新页面并保持原始尺寸
      const page = pdfDoc.addPage([viewport.width, viewport.height]);

      // 绘制处理后的图像，确保完全覆盖页面
      page.drawImage(image, {
        x: 0,
        y: 0,
        width: viewport.width,
        height: viewport.height,
      });
    }

    // 保存修改后的PDF
    return await pdfDoc.save({
      useObjectStreams: false,
      addDefaultPage: false,
    });
  } catch (error) {
    console.error("创建修改后的PDF时出错:", error);
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
 * 默认水印颜色设置
 */
const DEFAULT_WATERMARK_SETTINGS = {
  headerHeight: 9, // 页眉高度默认为9%
  footerHeight: 9, // 页脚高度默认为9%
  watermarkColor1: {
    r: 221,
    g: 228,
    b: 250,
    tolerance: 30,
  },
  watermarkColor2: {
    r: 211,
    g: 211,
    b: 211,
    tolerance: 30,
  },
};

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
      maxFileSize: 50 * 1024 * 1024, // 50MB
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
    const watermarks = JSON.parse(fields.watermarks || "[]");
    const userSettings = JSON.parse(fields.settings || "{}");

    // 合并用户设置和默认设置
    const settings = {
      headerHeight:
        userSettings.headerHeight ?? DEFAULT_WATERMARK_SETTINGS.headerHeight,
      footerHeight:
        userSettings.footerHeight ?? DEFAULT_WATERMARK_SETTINGS.footerHeight,
      watermarkColor1: {
        r:
          userSettings.watermarkColor1?.r ??
          DEFAULT_WATERMARK_SETTINGS.watermarkColor1.r,
        g:
          userSettings.watermarkColor1?.g ??
          DEFAULT_WATERMARK_SETTINGS.watermarkColor1.g,
        b:
          userSettings.watermarkColor1?.b ??
          DEFAULT_WATERMARK_SETTINGS.watermarkColor1.b,
        tolerance:
          userSettings.watermarkColor1?.tolerance ??
          DEFAULT_WATERMARK_SETTINGS.watermarkColor1.tolerance,
      },
      watermarkColor2: {
        r:
          userSettings.watermarkColor2?.r ??
          DEFAULT_WATERMARK_SETTINGS.watermarkColor2.r,
        g:
          userSettings.watermarkColor2?.g ??
          DEFAULT_WATERMARK_SETTINGS.watermarkColor2.g,
        b:
          userSettings.watermarkColor2?.b ??
          DEFAULT_WATERMARK_SETTINGS.watermarkColor2.b,
        tolerance:
          userSettings.watermarkColor2?.tolerance ??
          DEFAULT_WATERMARK_SETTINGS.watermarkColor2.tolerance,
      },
    };

    console.log("处理使用的设置:", JSON.stringify(settings, null, 2));

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

    return res.status(500).json({ message: error.message || "处理PDF时出错" });
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

// 配置API路由
export const config = {
  api: {
    bodyParser: false,
    responseLimit: false, // 禁用响应大小限制，因为PDF可能很大
  },
};
