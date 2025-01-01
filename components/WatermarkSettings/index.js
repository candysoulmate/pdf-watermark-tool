import { Card, Form, InputNumber, Space, Divider } from "antd";
import styles from "./WatermarkSettings.module.css";

// 默认水印颜色设置
const DEFAULT_WATERMARK_SETTINGS = {
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
  headerHeight: 10,
  footerHeight: 10,
};

/**
 * 水印设置组件
 * @param {Object} props
 * @param {Function} props.onSettingsChange - 设置变更回调
 * @param {Object} props.defaultValues - 默认值
 */
const WatermarkSettings = ({ onSettingsChange, defaultValues = {} }) => {
  const [form] = Form.useForm();

  // 初始化表单值
  const initialValues = {
    headerHeight:
      defaultValues.headerHeight || DEFAULT_WATERMARK_SETTINGS.headerHeight,
    footerHeight:
      defaultValues.footerHeight || DEFAULT_WATERMARK_SETTINGS.footerHeight,
    watermarkColor1_r:
      defaultValues.watermarkColor1?.r ||
      DEFAULT_WATERMARK_SETTINGS.watermarkColor1.r,
    watermarkColor1_g:
      defaultValues.watermarkColor1?.g ||
      DEFAULT_WATERMARK_SETTINGS.watermarkColor1.g,
    watermarkColor1_b:
      defaultValues.watermarkColor1?.b ||
      DEFAULT_WATERMARK_SETTINGS.watermarkColor1.b,
    watermarkColor1_tolerance:
      defaultValues.watermarkColor1?.tolerance ||
      DEFAULT_WATERMARK_SETTINGS.watermarkColor1.tolerance,
    watermarkColor2_r:
      defaultValues.watermarkColor2?.r ||
      DEFAULT_WATERMARK_SETTINGS.watermarkColor2.r,
    watermarkColor2_g:
      defaultValues.watermarkColor2?.g ||
      DEFAULT_WATERMARK_SETTINGS.watermarkColor2.g,
    watermarkColor2_b:
      defaultValues.watermarkColor2?.b ||
      DEFAULT_WATERMARK_SETTINGS.watermarkColor2.b,
    watermarkColor2_tolerance:
      defaultValues.watermarkColor2?.tolerance ||
      DEFAULT_WATERMARK_SETTINGS.watermarkColor2.tolerance,
  };

  const handleValuesChange = (changedValues, allValues) => {
    const settings = {
      headerHeight: allValues.headerHeight,
      footerHeight: allValues.footerHeight,
      watermarkColor1: {
        r: allValues.watermarkColor1_r,
        g: allValues.watermarkColor1_g,
        b: allValues.watermarkColor1_b,
        tolerance: allValues.watermarkColor1_tolerance,
      },
      watermarkColor2: {
        r: allValues.watermarkColor2_r,
        g: allValues.watermarkColor2_g,
        b: allValues.watermarkColor2_b,
        tolerance: allValues.watermarkColor2_tolerance,
      },
    };
    onSettingsChange?.(settings);
  };

  return (
    <Card title="水印设置" className={styles.settingsCard}>
      <Form
        form={form}
        initialValues={initialValues}
        onValuesChange={handleValuesChange}
        layout="vertical"
      >
        <div className={styles.settingsGroup}>
          <h4>页面区域设置</h4>
          <Space>
            <Form.Item label="页眉高度(%)" name="headerHeight">
              <InputNumber min={0} max={50} />
            </Form.Item>
            <Form.Item label="页脚高度(%)" name="footerHeight">
              <InputNumber min={0} max={50} />
            </Form.Item>
          </Space>
        </div>

        <Divider />

        <div className={styles.settingsGroup}>
          <h4>水印颜色1 (RGB)</h4>
          <Space>
            <Form.Item label="R" name="watermarkColor1_r">
              <InputNumber min={0} max={255} />
            </Form.Item>
            <Form.Item label="G" name="watermarkColor1_g">
              <InputNumber min={0} max={255} />
            </Form.Item>
            <Form.Item label="B" name="watermarkColor1_b">
              <InputNumber min={0} max={255} />
            </Form.Item>
            <Form.Item label="颜色容差" name="watermarkColor1_tolerance">
              <InputNumber min={0} max={255} />
            </Form.Item>
          </Space>
        </div>

        <Divider />

        <div className={styles.settingsGroup}>
          <h4>水印颜色2 (RGB)</h4>
          <Space>
            <Form.Item label="R" name="watermarkColor2_r">
              <InputNumber min={0} max={255} />
            </Form.Item>
            <Form.Item label="G" name="watermarkColor2_g">
              <InputNumber min={0} max={255} />
            </Form.Item>
            <Form.Item label="B" name="watermarkColor2_b">
              <InputNumber min={0} max={255} />
            </Form.Item>
            <Form.Item label="颜色容差" name="watermarkColor2_tolerance">
              <InputNumber min={0} max={255} />
            </Form.Item>
          </Space>
        </div>
      </Form>
    </Card>
  );
};

export default WatermarkSettings;
