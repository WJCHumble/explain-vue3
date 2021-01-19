# v-if

在之前模版编译一节中，我给大家介绍了 Vue 3 的编译过程，即一个模版会经历 `baseParse`、`transform`、`generate` 这三个过程，最后由 `generate` 生成可以执行的代码（`render` 函数）。


>这里，我们就不从编译过程开始讲解 `v-if` 指令的 `render` 函数生成过程了，有兴趣了解这个过程的同学，可以看我之前的模版编译一节

我们可以直接在 [Vue3 Template Explore](https://vue-next-template-explorer.netlify.app/) 输入一个使用 `v-if` 指令的栗子：
```javascript
<div v-if="visible"></div>
```
然后，由它编译生成的 `render` 函数会是这样：
```javascript
render(_ctx, _cache, $props, $setup, $data, $options) {
  return (_ctx.visible)
    ? (_openBlock(), _createBlock("div", { key: 0 }))
    : _createCommentVNode("v-if", true)
}
```
可以看到，一个简单的使用 `v-if` 指令的模版编译生成的 `render` 函数最终会返回一个**三目运算表达式**。首先，让我们先来认识一下其中几个变量和函数的意义：

- `_ctx` 当前组件实例的上下文，即 `this`
- `_openBlock()` 和 `_createBlock()` 用于构造 `Block Tree` 和 `Block VNode`，它们主要用于靶向更新过程
- `_createCommentVNode()` 创建注释节点的函数，通常用于占位

显然，如果当 `visible` 为 `false` 的时候，会在当前模版中创建一个**注释节点**（也可称为占位节点），反之则创建一个真实节点（即它自己）。例如当 `visible` 为 `false` 时渲染到页面上会是这样：

<div align="center">
	<img width="400" src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/fa3d336210f34fff8f68d1b8cab83443~tplv-k3u1fbpfcp-zoom-1.image"/>
</div>

>在 Vue 中很多地方都运用了注释节点来作为**占位节点**，其目的是在不展示该元素的时候，标识其**在页面中的位置**，以便在 `patch` 的时候将该元素放回该位置。

那么，这个时候我想大家就会抛出一个疑问：当 `visible` 动态切换 `true` 或 `false` 的这个过程（派发更新）究竟发生了什么？

## 派发更新时 patch，更新节点

>如果不了解 Vue 3 派发更新和依赖收集过程的同学，可以看我之前的文章[4k+ 字分析 Vue 3.0 响应式原理（依赖收集和派发更新）](https://juejin.cn/post/6844904106415357959/)


在 Vue 3 中总共有四种指令：`v-on`、`v-model`、`v-show` 和 `v-if`。但是，实际上在源码中，只针对前面三者**进行了特殊处理**，这可以在 `packages/runtime-dom/src/directives` 目录下的文件看出：

```javascript
// packages/runtime-dom/src/directives
|-- driectives
    |-- vModel.ts       ## v-model 指令相关
    |-- vOn.ts          ## v-on 指令相关
    |-- vShow.ts        ## v-show 指令相关
```
而针对 `v-if` 指令是直接走派发更新过程时 `patch` 的逻辑。由于 `v-if` 指令订阅了 `visible` 变量，所以当 `visible` 变化的时候，则会触发**派发更新**，即 `Proxy` 对象的 `set` 逻辑，最后会命中 `componentEffect` 的逻辑。

>当然，我们也可以称这个过程为组件的更新过程

这里，我们来看一下 `componentEffect` 的定义（伪代码）：
```javascript
// packages/runtime-core/src/renderer.ts
function componentEffect() {
    if (!instance.isMounted) {
    	....
    } else {
      	...
        const nextTree = renderComponentRoot(instance)
        const prevTree = instance.subTree
        instance.subTree = nextTree
        patch(
          prevTree,
          nextTree,
          hostParentNode(prevTree.el!)!,
          getNextHostNode(prevTree),
          instance,
          parentSuspense,
          isSVG
        )
        ...
      }
  }
}
```

可以看到，当**组件还没挂载时**，即第一次触发派发更新会命中 `!instance.isMounted` 的逻辑。而对于我们这个栗子，则会命中 `else` 的逻辑，即组件更新，主要会做三件事：

- 获取当前组件对应的组件树 `nextTree` 和之前的组件树 `prevTree`
- 更新当前组件实例 `instance` 的组件树 `subTree` 为 `nextTree`
- `patch` 新旧组件树 `prevTree` 和 `nextTree`，如果存在 `dynamicChildren`，即 `Block Tree`，则会命中靶向更新的逻辑，显然我们此时满足条件

>注：组件树则指的是该组件对应的 VNode Tree。

## 总结

总体来看，`v-if` 指令的实现较为简单，基于**数据驱动**的理念，当 `v-if` 指令对应的 `value` 为 `false` 的时候会**预先创建一个注释节**点在该位置，然后在 `value` 发生变化时，命中派发更新的逻辑，对新旧组件树进行 `patch`，从而完成使用 `v-if` 指令元素的动态显示隐藏。

<div align="center">
	<img width="700" src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/fd36f8e0870340eeb0d2fbcf56fec40a~tplv-k3u1fbpfcp-zoom-1.image"/>
</div>

>那么，下一节，我们来看一下 `v-show` 指令的实现～