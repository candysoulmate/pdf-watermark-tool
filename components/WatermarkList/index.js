import { Card, Button, Image, Checkbox } from "antd";
import { SelectOutlined } from "@ant-design/icons";
import styles from "./WatermarkList.module.css";

/**
 * 水印列表组件
 * @param {Object} props
 * @param {Array} props.watermarks - 水印列表
 * @param {Array} props.selectedWatermarks - 已选中的水印
 * @param {Function} props.onWatermarkSelect - 水印选择回调
 * @param {Function} props.onToggleAll - 全选/取消全选回调
 */
const WatermarkList = ({
  watermarks,
  selectedWatermarks,
  onWatermarkSelect,
  onToggleAll,
}) => {
  const allSelected =
    watermarks.length > 0 && selectedWatermarks.length === watermarks.length;

  return (
    <Card
      className={styles.watermarkCard}
      title={
        <div className={styles.watermarkCardHeader}>
          <span>检测到的水印</span>
          <Button
            type="primary"
            icon={<SelectOutlined />}
            onClick={onToggleAll}
          >
            {allSelected ? "取消全选" : "全选"}
          </Button>
        </div>
      }
    >
      <div className={styles.watermarkList}>
        {watermarks.map((watermark, index) => (
          <div key={index} className={styles.watermarkItem}>
            <Checkbox
              checked={selectedWatermarks.includes(index)}
              onChange={(e) => onWatermarkSelect(index, e.target.checked)}
            />
            <div className={styles.watermarkContent}>
              <Image
                className={styles.watermarkImage}
                src={watermark.previewImage}
                alt={`水印 ${index + 1}`}
                preview={{
                  mask: <div>点击预览</div>,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default WatermarkList;
