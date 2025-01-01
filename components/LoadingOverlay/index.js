import { Spin } from "antd";
import styles from "./LoadingOverlay.module.css";

/**
 * 加载遮罩组件
 * @param {Object} props
 * @param {boolean} props.visible - 是否显示
 * @param {string} props.message - 加载提示信息
 */
const LoadingOverlay = ({ visible, message }) => {
  if (!visible) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.content}>
        <Spin size="large" />
        {message && <div className={styles.message}>{message}</div>}
      </div>
    </div>
  );
};

export default LoadingOverlay;
