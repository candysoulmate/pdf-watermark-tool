import { useState } from "react";
import {
  Upload,
  Button,
  Card,
  List,
  Spin,
  message,
  Form,
  InputNumber,
  Space,
  Divider,
  Image,
} from "antd";
import { UploadOutlined, DeleteOutlined } from "@ant-design/icons";
import styles from "../styles/Home.module.css";

export default function Home() {
  const [watermarks, setWatermarks] = useState([]);
  const [loadingState, setLoadingState] = useState({
    isLoading: false,
    message: "",
  });
  const [form] = Form.useForm();
  const [currentFile, setCurrentFile] = useState(null);

  // 水印设置的默认值
  const defaultSettings = {
    headerHeight: 9,
    footerHeight: 9,
    watermarkColor: {
      r: 211,
      g: 228,
      b: 250,
      tolerance: 30,
    },
    watermarkColor2: {
      r: 202,
      g: 202,
      b: 202,
      tolerance: 30,
    },
  };

  const [settings, setSettings] = useState(defaultSettings);

  // 处理设置变更
  const handleSettingChange = (values) => {
    setSettings({
      ...settings,
      ...values,
    });
  };

  const uploadProps = {
    name: "file",
    accept: ".pdf",
    multiple: false,
    showUploadList: false,
    beforeUpload: (file) => {
      const isPDF = file.type === "application/pdf";
      if (!isPDF) {
        message.error("只能上传PDF文件！");
        return false;
      }
      setCurrentFile(file);
      return true;
    },
    customRequest: async ({ file, onSuccess, onError }) => {
      setLoadingState({
        isLoading: true,
        message: "正在解析PDF文件，请稍候...",
      });

      const formData = new FormData();
      formData.append("file", file);
      formData.append("settings", JSON.stringify(settings));

      try {
        const response = await fetch("/api/analyze-pdf", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) throw new Error("解析PDF失败");

        const data = await response.json();
        const watermarksWithSelection = data.watermarks.map((w) => ({
          ...w,
          selected: true,
        }));
        setWatermarks(watermarksWithSelection);
        message.success("PDF解析成功！");
        onSuccess();
      } catch (error) {
        message.error("解析PDF时出错：" + error.message);
        onError(error);
      } finally {
        setLoadingState({
          isLoading: false,
          message: "",
        });
      }
    },
  };

  const handleRemoveWatermarks = async () => {
    if (!watermarks.length) {
      message.warning("请先上传PDF文件！");
      return;
    }

    if (!currentFile) {
      message.warning("未找到PDF文件，请重新上传！");
      return;
    }

    const selectedWatermarks = watermarks.filter((w) => w.selected);
    if (!selectedWatermarks.length) {
      message.warning("请选择要移除的水印！");
      return;
    }

    setLoadingState({
      isLoading: true,
      message: "正在移除水印，请稍候...",
    });

    const formData = new FormData();
    formData.append("file", currentFile);
    formData.append("watermarks", JSON.stringify(selectedWatermarks));
    formData.append("settings", JSON.stringify(settings));

    try {
      const response = await fetch("/api/remove-watermarks", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("处理PDF失败");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const originalName = currentFile.name.replace(/\.pdf$/i, "");
      a.download = `${originalName}-无水印.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      message.success("水印移除成功！");
    } catch (error) {
      message.error("处理PDF时出错：" + error.message);
    } finally {
      setLoadingState({
        isLoading: false,
        message: "",
      });
    }
  };

  const toggleWatermark = (index) => {
    const newWatermarks = [...watermarks];
    newWatermarks[index].selected = !newWatermarks[index].selected;
    setWatermarks(newWatermarks);
  };

  const toggleAllWatermarks = () => {
    // 检查是否所有水印都已选中
    const allSelected = watermarks.every((w) => w.selected);
    // 如果全部选中，则取消全选；否则全选
    const newWatermarks = watermarks.map((w) => ({
      ...w,
      selected: !allSelected,
    }));
    setWatermarks(newWatermarks);
  };

  return (
    <div className={styles.container}>
      {loadingState.isLoading && (
        <div className={styles.loadingOverlay}>
          <Spin size="large" tip={loadingState.message}>
            <div className={styles.loadingContent} />
          </Spin>
        </div>
      )}

      <main className={styles.main}>
        <h1 className={styles.title}>PDF水印移除工具</h1>

        <Card
          className={styles.uploadCard}
          title={
            <div className={styles.watermarkCardHeader}>
              <span className={styles.cardTitle}>PDF文件上传</span>
            </div>
          }
        >
          <Form
            form={form}
            layout="vertical"
            initialValues={defaultSettings}
            onValuesChange={handleSettingChange}
          >
            <Space direction="vertical" style={{ width: "100%" }} size="large">
              <Space size="large">
                <Form.Item
                  label="页眉高度百分比"
                  name="headerHeight"
                  rules={[{ required: true, message: "请输入页眉高度" }]}
                >
                  <InputNumber
                    min={1}
                    max={20}
                    step={0.1}
                    style={{ width: 120 }}
                    addonAfter="%"
                  />
                </Form.Item>
                <Form.Item
                  label="页脚高度百分比"
                  name="footerHeight"
                  rules={[{ required: true, message: "请输入页脚高度" }]}
                >
                  <InputNumber
                    min={1}
                    max={20}
                    step={0.1}
                    style={{ width: 120 }}
                    addonAfter="%"
                  />
                </Form.Item>
              </Space>

              <Divider>水印颜色设置1</Divider>

              <Space size="large">
                <Form.Item
                  label="R值"
                  name={["watermarkColor", "r"]}
                  rules={[{ required: true, message: "请输入R值" }]}
                >
                  <InputNumber min={0} max={255} style={{ width: 100 }} />
                </Form.Item>
                <Form.Item
                  label="G值"
                  name={["watermarkColor", "g"]}
                  rules={[{ required: true, message: "请输入G值" }]}
                >
                  <InputNumber min={0} max={255} style={{ width: 100 }} />
                </Form.Item>
                <Form.Item
                  label="B值"
                  name={["watermarkColor", "b"]}
                  rules={[{ required: true, message: "请输入B值" }]}
                >
                  <InputNumber min={0} max={255} style={{ width: 100 }} />
                </Form.Item>
                <Form.Item
                  label="颜色容差"
                  name={["watermarkColor", "tolerance"]}
                  rules={[{ required: true, message: "请输入颜色容差" }]}
                >
                  <InputNumber min={0} max={35} style={{ width: 100 }} />
                </Form.Item>
              </Space>

              <Divider>水印颜色设置2</Divider>

              <Space size="large">
                <Form.Item
                  label="R值"
                  name={["watermarkColor2", "r"]}
                  rules={[{ required: true, message: "请输入R值" }]}
                >
                  <InputNumber min={0} max={255} style={{ width: 100 }} />
                </Form.Item>
                <Form.Item
                  label="G值"
                  name={["watermarkColor2", "g"]}
                  rules={[{ required: true, message: "请输入G值" }]}
                >
                  <InputNumber min={0} max={255} style={{ width: 100 }} />
                </Form.Item>
                <Form.Item
                  label="B值"
                  name={["watermarkColor2", "b"]}
                  rules={[{ required: true, message: "请输入B值" }]}
                >
                  <InputNumber min={0} max={255} style={{ width: 100 }} />
                </Form.Item>
                <Form.Item
                  label="颜色容差"
                  name={["watermarkColor2", "tolerance"]}
                  rules={[{ required: true, message: "请输入颜色容差" }]}
                >
                  <InputNumber min={0} max={35} style={{ width: 100 }} />
                </Form.Item>
              </Space>

              <Upload {...uploadProps}>
                <Button icon={<UploadOutlined />} size="large">
                  选择PDF文件
                </Button>
              </Upload>
            </Space>
          </Form>
        </Card>

        {watermarks.length > 0 && (
          <Card
            className={styles.watermarkCard}
            title={
              <div className={styles.watermarkCardHeader}>
                <span className={styles.cardTitle}>检测到的水印</span>
                <Button
                  type="primary"
                  onClick={toggleAllWatermarks}
                  disabled={loadingState.isLoading}
                  icon={<DeleteOutlined />}
                >
                  {watermarks.every((w) => w.selected) ? "取消全选" : "全选"}
                </Button>
              </div>
            }
          >
            <List
              dataSource={watermarks}
              renderItem={(watermark, index) => (
                <List.Item
                  key={index}
                  actions={[
                    <Button
                      type={watermark.selected ? "primary" : "default"}
                      onClick={() => toggleWatermark(index)}
                      icon={<DeleteOutlined />}
                      disabled={loadingState.isLoading}
                    >
                      {watermark.selected ? "已选择" : "选择移除"}
                    </Button>,
                  ]}
                >
                  <div className={styles.watermarkPreview}>
                    {watermark.previewImage && (
                      <Image
                        src={watermark.previewImage}
                        alt="水印预览"
                        className={styles.previewImage}
                        placeholder={
                          <div
                            style={{
                              background: "#f5f5f5",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: "100%",
                              height: "200px",
                            }}
                          >
                            <Spin />
                          </div>
                        }
                      />
                    )}
                    <div className={styles.watermarkInfo}>
                      <div className={styles.watermarkTitle}>
                        <span>
                          水印类型：
                          {watermark.type === "text" ? "文字水印" : "图片水印"}
                        </span>
                        <span className={styles.watermarkType}>
                          位置：
                          {watermark.location === "header"
                            ? "页眉"
                            : watermark.location === "footer"
                            ? "页脚"
                            : "中间"}
                        </span>
                      </div>
                      {watermark.type === "text" && (
                        <p>文字内容：{watermark.content}</p>
                      )}
                      <p>出现页数：{watermark.pages.join(", ")}</p>
                    </div>
                  </div>
                </List.Item>
              )}
            />
            <div style={{ marginTop: "20px", textAlign: "center" }}>
              <Button
                type="primary"
                size="large"
                onClick={handleRemoveWatermarks}
                disabled={
                  loadingState.isLoading || !watermarks.some((w) => w.selected)
                }
                icon={<DeleteOutlined />}
              >
                移除选中的水印
              </Button>
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}
