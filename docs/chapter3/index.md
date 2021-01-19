# 基本介绍

在「Vue3」中，创建一个组件实例由 `createApp` 「API」完成。创建完一个组件实例，我们需要调用 `mount()` 方法将组件实例挂载到页面中：

```javascript
createApp({
    ...
}).mount("#app");
```

在源码中整个组件的创建过程:
![](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/bad79ad4e3104fb3a54ae81ce6473125~tplv-k3u1fbpfcp-zoom-1.image)

`mountComponent()` 实现的核心是 `setupComponent()`，它可以分为**两个过程**：

- 开始安装，它会初始化 `props`、`slots`、调用 `setup()`、验证组件和指令的合理性。
- 结束安装，它会初始化 `computed`、`data`、`watch`、`mixin` 和生命周期等等。

![](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/6fb6aae2fb364c9295c308ec73d5c154~tplv-k3u1fbpfcp-zoom-1.image)

那么，接下来我们来详细地分析一下这两个过程。
