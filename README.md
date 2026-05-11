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
   右侧雷达图展示 Aroma、Flavor、Aftertaste、Acidity、Body、Balance 六个风味维度，左侧条形图区单独展示 Overall。雷达图使用截断尺度，默认 6.5-9.0，不从 0 开始，以放大风味评分之间的细微差异。灰色虚线表示全局平均水平，鼠标悬停节点显示具体数值。

3. **Altitude vs Score Explorer**  
   散点图展示 Altitude_final 与 Total Cup Points 的关系。点颜色表示处理法。可以框选散点区域，被框选样本会联动更新地图和雷达图。
