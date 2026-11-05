# 高清素材保护

每个需要保护的作品或游戏墙条目使用两份素材：

- `imageMediaId`（游戏墙可另设 `thumbnailMediaId`）：公开的低分辨率预览。
- `sourceMediaId`：PSD、高清 PNG 或其他原文件。它仍会附着到条目，但发布后由 Worker 强制保持为 R2 私有对象。

公开 `/api/content/*` 响应只会给前端 `previewOnly` 与水印文字，不会返回 `sourceMediaId`。访客访问 `/api/media/:sourceId` 会得到 404；源文件仅可从已经登录的管理员会话以 `/api/admin/media/:sourceId/file?download=1` 下载，响应不缓存并以附件下载。

公开预览层自动显示重复的 `PHRNONO / PREVIEW ONLY` 水印。这个方案不建立额外的 R2 副本，也不使用 Cloudflare Images 的付费图像转换。若以后需要将水印真正烘焙进位图或让系统自动从原图生成缩略图，可另行开启 Cloudflare Images 绑定；目前仍建议先自行导出一张适合网页展示的低分辨率预览。
