# Global Arabica Coffee Quality Explorer

这是作业 3 的静态交互式可视化网页原型。项目使用 D3.js 实现，不需要后端服务器，可以直接部署到 GitHub Pages。

## 文件结构

```text
coffee_quality_interactive_site/
├── index.html
├── style.css
├── main.js
├── df_arabica_viz_clean.csv
└── README.md
```

## 三个视图

1. **Global Coffee Origin Map**  
   世界地图 + 国家气泡。气泡颜色表示当前地图指标，气泡大小表示样本数量。点击国家后联动雷达图和散点图。

2. **Flavor Radar Comparison**  
   雷达图展示 Aroma、Flavor、Aftertaste、Acidity、Body、Balance、Overall。雷达图使用截断尺度，默认 6.5-9.0，不从 0 开始，以放大风味评分之间的细微差异。灰色虚线表示全局平均水平，鼠标悬停节点显示具体数值。

3. **Altitude vs Score Explorer**  
   散点图展示 Altitude_final 与 Total Cup Points 的关系。点颜色表示处理法。可以框选散点区域，被框选样本会联动更新地图和雷达图。

## 本地预览

不要直接双击打开 `index.html`，因为浏览器可能阻止本地 CSV 加载。请在项目文件夹里运行：

```bash
python -m http.server 8000
```

然后打开：

```text
http://localhost:8000
```

## GitHub Pages 部署简要步骤

1. 新建一个 GitHub repository。
2. 把本文件夹里的所有文件上传到 repository 根目录。
3. 进入 repository 的 Settings → Pages。
4. 在 Build and deployment 里选择 Source: Deploy from a branch。
5. Branch 选择 `main`，folder 选择 `/root`，保存。
6. 等待 GitHub Pages 构建完成后访问页面链接。

## 可继续优化的方向

- 为小国家增加 inset 放大视图。
- 加入趋势线或局部回归线，但报告中应说明这是 visual trend，不是因果结论。
- 如果选中国家超过 5 个，可提示用户减少选择，避免雷达图重叠。
