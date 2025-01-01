import { Upload, message } from "antd";
import { InboxOutlined, FilePdfOutlined } from "@ant-design/icons";
import styles from "./FileUpload.module.css";
import { useState } from "react";
import * as pdfjsLib from "pdfjs-dist";

// 设置PDF.js worker
const pdfjsWorker = require("pdfjs-dist/build/pdf.worker.entry");
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const { Dragger } = Upload;

/**
 * 格式化文件大小
 * @param {number} bytes - 文件大小（字节）
 * @returns {string} - 格式化后的文件大小
 */
const formatFileSize = (bytes) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

/**
 * 文件上传组件
 * @param {Object} props
 * @param {Function} props.onFileSelected - 文件选择回调
 * @param {boolean} props.loading - 加载状态
 */
const FileUpload = ({ onFileSelected, loading }) => {
  const [currentFile, setCurrentFile] = useState(null);
  const [pageCount, setPageCount] = useState(null);

  const getPdfPageCount = async (file) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
      setPageCount(pdf.numPages);
    } catch (error) {
      console.error("获取PDF页数失败:", error);
      message.error("获取PDF页数失败");
    }
  };

  const uploadProps = {
    name: "file",
    multiple: false,
    accept: ".pdf",
    showUploadList: false,
    beforeUpload: async (file) => {
      const isPDF = file.type === "application/pdf";
      if (!isPDF) {
        message.error("只能上传PDF文件！");
        return false;
      }
      const isLt50M = file.size / 1024 / 1024 < 50;
      if (!isLt50M) {
        message.error("文件大小不能超过50MB！");
        return false;
      }
      setCurrentFile(file);
      await getPdfPageCount(file);
      onFileSelected(file);
      return false;
    },
  };

  return (
    <div className={styles.uploadContainer}>
      <Dragger {...uploadProps} disabled={loading}>
        {currentFile ? (
          <div className={styles.fileInfo}>
            <FilePdfOutlined className={styles.pdfIcon} />
            <div className={styles.fileDetails}>
              <p className={styles.fileName}>{currentFile.name}</p>
              <p className={styles.fileSize}>
                文件大小：{formatFileSize(currentFile.size)}
              </p>
              <p className={styles.fileType}>类型：PDF文档</p>
              {pageCount && (
                <p className={styles.pageCount}>总页数：{pageCount} 页</p>
              )}
            </div>
          </div>
        ) : (
          <>
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">点击或拖拽PDF文件到此区域上传</p>
            <p className="ant-upload-hint">
              支持单个PDF文件上传，文件大小不超过50MB
            </p>
          </>
        )}
      </Dragger>
    </div>
  );
};

export default FileUpload;
