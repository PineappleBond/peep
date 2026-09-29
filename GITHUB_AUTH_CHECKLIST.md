# GitHub 登录功能测试清单

## 测试场景

### 1. 未登录状态

- [ ] 访问应用，显示 LoginPage
- [ ] LoginPage 显示 GitHub 登录按钮
- [ ] 切换亮色/暗色主题，LoginPage 正确显示
- [ ] 切换中英文，LoginPage 正确显示

### 2. 登录流程

- [ ] 点击"使用 GitHub 登录"按钮
- [ ] 打开 popup 窗口，显示 GitHub 授权页
- [ ] 完成授权后，popup 关闭
- [ ] 跳转到主应用页面

### 3. 已登录状态

- [ ] Header 右上角显示退出登录按钮
- [ ] 悬停显示"退出登录"提示
- [ ] 点击退出登录，跳转回 LoginPage

### 4. 错误处理

- [ ] 登录失败时显示错误提示
- [ ] Token 过期时自动刷新
- [ ] 刷新失败时跳转登录页

### 5. 响应式布局

- [ ] 移动端（< 768px）LoginPage 单列布局
- [ ] 桌面端（>= 768px）LoginPage 双列布局

## 已知问题

- 生产构建存在预先存在的错误（rtc-agent/web-components 解析错误）
