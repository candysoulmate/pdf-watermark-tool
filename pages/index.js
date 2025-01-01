import { useState, useCallback } from "react";
import { Button, message } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import FileUpload from "../components/FileUpload";
import WatermarkList from "../components/WatermarkList";
import LoadingOverlay from "../components/LoadingOverlay";
import WatermarkSettings from "../components/WatermarkSettings";
import styles from "../styles/Home.module.css";

export default function Home() {
  // 状态管理
  const [file, setFile] = useState(null);
  const [watermarks, setWatermarks] = useState([]);
  const [selectedWatermarks, setSelectedWatermarks] = useState([]);
  const [settings, setSettings] = useState({
    headerHeight: 9,
    footerHeight: 9,
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
  });
  const [loading, setLoading] = useState({
    visible: false,
    message: "",
  });

  // 文件上传处理
  const handleFileSelected = useCallback(
    async (selectedFile) => {
      try {
        setFile(selectedFile);
        setLoading({ visible: true, message: "正在分析PDF文件..." });

        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append(
          "settings",
          JSON.stringify({
            headerHeight: settings.headerHeight,
            footerHeight: settings.footerHeight,
            watermarkColor1: {
              r: settings.watermarkColor1.r,
              g: settings.watermarkColor1.g,
              b: settings.watermarkColor1.b,
              tolerance: settings.watermarkColor1.tolerance,
            },
            watermarkColor2: {
              r: settings.watermarkColor2.r,
              g: settings.watermarkColor2.g,
              b: settings.watermarkColor2.b,
              tolerance: settings.watermarkColor2.tolerance,
            },
          })
        );

        const response = await fetch("/api/analyze-pdf", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error("PDF分析失败");
        }

        const data = await response.json();
        if (!Array.isArray(data.watermarks)) {
          throw new Error("水印数据格式错误");
        }

        // 确保每个水印对象都有必要的属性
        const processedWatermarks = data.watermarks.map((watermark) => ({
          ...watermark,
          previewImage: watermark.previewImage || null,
          type: watermark.type || "unknown",
          location: watermark.location || "unknown",
          pages: watermark.pages || [],
          content: watermark.content || "",
        }));

        setWatermarks(processedWatermarks);
        setSelectedWatermarks(
          Array.from({ length: processedWatermarks.length }, (_, i) => i)
        );
        message.success("PDF分析完成");
      } catch (error) {
        message.error(error.message || "PDF处理出错");
        setWatermarks([]);
        setSelectedWatermarks([]);
      } finally {
        setLoading({ visible: false, message: "" });
      }
    },
    [settings]
  );

  // 水印选择处理
  const handleWatermarkSelect = useCallback((index, checked) => {
    setSelectedWatermarks((prev) => {
      if (checked) {
        return [...prev, index];
      }
      return prev.filter((i) => i !== index);
    });
  }, []);

  // 全选/取消全选处理
  const handleToggleAll = useCallback(() => {
    setSelectedWatermarks((prev) => {
      if (prev.length === watermarks.length) {
        return [];
      }
      return Array.from({ length: watermarks.length }, (_, i) => i);
    });
  }, [watermarks.length]);

  // 设置变更处理
  const handleSettingsChange = useCallback((newSettings) => {
    setSettings(newSettings);
  }, []);

  // 移除水印处理
  const handleRemoveWatermarks = async () => {
    if (!selectedWatermarks.length) {
      message.warning("请选择要移除的水印");
      return;
    }

    try {
      setLoading({
        visible: true,
        message: "正在移除水印，请稍候...",
      });

      const formData = new FormData();
      formData.append("file", file);
      formData.append("watermarks", JSON.stringify(selectedWatermarks));
      formData.append(
        "settings",
        JSON.stringify({
          headerHeight: settings.headerHeight,
          footerHeight: settings.footerHeight,
          watermarkColor1: {
            r: settings.watermarkColor1.r,
            g: settings.watermarkColor1.g,
            b: settings.watermarkColor1.b,
            tolerance: settings.watermarkColor1.tolerance,
          },
          watermarkColor2: {
            r: settings.watermarkColor2.r,
            g: settings.watermarkColor2.g,
            b: settings.watermarkColor2.b,
            tolerance: settings.watermarkColor2.tolerance,
          },
        })
      );

      const response = await fetch("/api/remove-watermarks", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("水印移除失败");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const fileName = file.name.replace(".pdf", "");
      link.download = `${fileName}-无水印.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      message.success("水印移除完成");
    } catch (error) {
      message.error(error.message || "水印移除出错");
    } finally {
      setLoading({ visible: false, message: "" });
    }
  };

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <h1 className={styles.title}>PDF水印处理工具</h1>

        <FileUpload
          onFileSelected={handleFileSelected}
          loading={loading.visible}
        />

        <WatermarkSettings
          onSettingsChange={handleSettingsChange}
          defaultValues={settings}
        />

        {watermarks.length > 0 && (
          <>
            <WatermarkList
              watermarks={watermarks}
              selectedWatermarks={selectedWatermarks}
              onWatermarkSelect={handleWatermarkSelect}
              onToggleAll={handleToggleAll}
            />

            <div className={styles.actionContainer}>
              <Button
                type="primary"
                icon={<DeleteOutlined />}
                onClick={handleRemoveWatermarks}
                disabled={selectedWatermarks.length === 0}
                className={styles.removeButton}
              >
                移除选中的水印
              </Button>
            </div>
          </>
        )}

        <LoadingOverlay visible={loading.visible} message={loading.message} />
      </main>
    </div>
  );
}
