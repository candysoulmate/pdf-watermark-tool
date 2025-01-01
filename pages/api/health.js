/**
 * 健康检查接口
 * 用于监控服务状态
 */
export default function handler(req, res) {
  try {
    // 检查服务状态
    const status = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };

    res.status(200).json(status);
  } catch (error) {
    res.status(500).json({
      status: "unhealthy",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}
