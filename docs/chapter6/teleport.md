# teleport 组件

## 什么是 teleport 组件

> 当然，如果已经懂得怎么使用 `teleport` 组件的同学可以跳过这个小节。

我们从使用性的角度思考，很现实的一点，就是 `teleport` 组件**能带给我们什么价值**？

**最经典的回答**就是开发中使用 `Modal` 模态框的场景。通常，我们会在中后台的业务开发中频繁地使用到模态框。可能对于中台还好，它们会搞一些 `low code` 来**减少开发成本**，但这也是一般大公司或者技术较强的公司才能实现的。

而实际情况下，我们传统的后台开发，就是会存在频繁地**手动使用** `Modal` 的情况，它看起来会是这样：
```javascript
<div class="page">
  <div class="header">我希望点击我出现弹窗</div>
  <!--假设此处有 100 行代码-->
  ....
  <Modal>
    <div>
      我是 header 希望出的弹窗
    </div>
  </Modal>
</div>
```
这样的代码，凸显出来的问题，就是**脱离了所见即所得**的理念，即我头部希望出现的弹窗，**由于样式的问题**，我需要将 `Modal` 写在最下面。

而 `teleport` 组件的出现，**首当其冲**的就是解决这个问题，仍然还是上面那个栗子，通过 `teleport` 组件我们可以这么写：
```javascript
<div class="page">
  <div class="header">我希望点击我出现弹窗</div>
  <!--弹窗内容-->
  <teleport to="#modal-header">
    <div>
      我是 header 希望出的弹窗
    </div>
  </teleport>
  <!--假设此处有 100 行代码-->
  ....
  <Modal id="modal-header">
  </Modal>
</div>
```
结合 `teleport` 组件使用 `modal`，一方面，我们的弹窗内容，就可以符合我们的正常的思考逻辑。并且，另一方面，也可以充分地提高 `Modal` 组件的**可复用性**，即页面中一个 `Modal` 负责展示不同内容。


## 从源码角度认识 teleport 组件


假设，此时我们有一个这样的栗子：
```javascript
<div id="my-heart">
  i love you 
</div>
<teleport to="#my-heart" >
  honey
</teleport>
```
通过上面的介绍，我们很容易就知道，它最终渲染到页面上的 DOM 会是这样：
```javascript
<div id="my-heart">
  i love you honey
</div>
```


那么，这个时候我们就会想，`teleport` 组件中的内容，究竟是如何**走进了我的心**？这，说来话长，长话短说，**我们直接上图**：

![](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/a5b53f0591a041a4b50b9577192e54ca~tplv-k3u1fbpfcp-zoom-1.image)

通过流程图，我们可以知道整体 `teleport` 的工作流并不复杂。那么，接下来，我们再从**源码设计**的角度认识 `teleport` 组件的运行机制。

>这里，我们仍然会分为 `compile` 和 `runtime` 两个阶段去介绍。

### compile 编译生成的 render 函数

仍然是我们上面的那个栗子，它经过 `compile` 编译处理后生成的**可执行代码**会是这样：
```javascript
const _Vue = Vue
const { createVNode: _createVNode, createTextVNode: _createTextVNode } = _Vue

const _hoisted_1 = _createVNode("div", { id: "my-heart" }, "i love you ", -1 /* HOISTED */)
const _hoisted_2 = _createTextVNode("honey")

return function render(_ctx, _cache) {
  with (_ctx) {
    const { createVNode: _createVNode, createTextVNode: _createTextVNode, Teleport: _Teleport, openBlock: _openBlock, createBlock: _createBlock, Fragment: _Fragment } = _Vue

    return (_openBlock(), _createBlock(_Fragment, null, [
      _hoisted_1,
      (_openBlock(), _createBlock(_Teleport, { to: "#my-heart" }, [
        _hoisted_2
      ]))
  ], 64))
}
```
由于，`teleport` 组件并不属于静态节点需要提升的范围，所以它会在 `render` 函数内部创建，即这一部分：
```javascript
_createBlock(_Teleport, { to: "#my-heart" }, [
  _hoisted_2
]))
```
> 需要注意的是，此时 `teleport` 的内容 `honey` 是属于静态节点，所以它会被提升。

并且，这里有一处细节，`teleport` 组件的内部元素永远是**以数组的形式**处理，这在之后的 `patch` 处理中也会提及。

### runtime 运行时的 patch 处理

相比较 `compile` 编译时生成 `teleport` 组件的可执行代码，`runtime` 运行时的 `patch` 处理可以说是整个 `teleport` 组件**实现的核心**。

在上一篇文章 [深度解读 Vue 3 源码 | compile 和 runtime 结合的 patch 过程](https://juejin.im/post/6875900681161572365) 中，我们说了 `patch` 会根据不同的 `shapeFlag` 处理不同的逻辑，而 `teleport` 则会命中 `shapeFlag` 为 `TELEPORT` 的逻辑：
```javascript
function patch(...) {
  ...
  switch(type) {
    ...
    default:
      if (shapeFlag & ShapeFlags.TELEPORT) {
        ;(type as typeof TeleportImpl).process(
          n1 as TeleportVNode,
          n2 as TeleportVNode,
          container,
          anchor,
          parentComponent,
          parentSuspense,
          isSVG,
          optimized,
          internals
        )
      }
  }
}
```
这里会调用 `TeleportImpl` 上的 `process` 方法来实现 `teleport` 的 `patch` 过程，并且它也是 `teleport` 组件实现的**核心代码**。而 `TeleportImpl.process` 函数的逻辑可以分为这四个步骤：

#### 创建并挂载注释节点

首先，创建两个注释 `VNode`，插入此时 `teleport` 组件在页面中的对应位置，即插入到 `teleport` 的父节点 `container` 中：
```javascript
// 创建注释节点
const placeholder = (n2.el = __DEV__
        ? createComment('teleport start')
        : createText(''))
const mainAnchor = (n2.anchor = __DEV__
  ? createComment('teleport end')
  : createText(''))
// 插入注释节点
insert(placeholder, container, anchor)
insert(mainAnchor, container, anchor)
```

#### 挂载 target 节点和占位节点

其次，判断 `teleport` 组件对应 `target` 的 `DOM` 节点是否存在，存在则插入一个**空的文本节点**，也可以称为**占位节点**：
```javascript
const target = (n2.target = resolveTarget(n2.props, querySelector))
const targetAnchor = (n2.targetAnchor = createText(''))
if (target) {
  insert(targetAnchor, target)
} else if (__DEV__) {
  warn('Invalid Teleport target on mount:', target, `(${typeof target})`)
}
```

#### 定义挂载函数 mount

然后，定义 `mount` 方法来为 `teleport` 组件进行特定的挂载操作，它的本质是基于 `mountChildren` 挂载子元素方法的封装：
```javascript
const mount = (container: RendererElement, anchor: RendererNode) => {
  if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
    mountChildren(
      children as VNodeArrayChildren,
      container,
      anchor,
      parentComponent,
      parentSuspense,
      isSVG,
      optimized
    )
  }
}
```
可以看到，这里也对是否 `ShpeFlags` 为 `ARRAY_CHILDREN`，**即数组**，进行了判断，因为 `teleport` 的**子元素必须为数组**。并且，`mount` 方法的两个形参的意义分别是：

- `container` 代表要挂载的父节点。
- `anchor` 调用 `insertBefore` 插入时的 `referenceNode`，即占位 `VNode`。

#### 根据 disabled 处理不同逻辑

由于，`teleport` 组件提供了一个 `props` 属性 `disabled` 来控制是否将内容显示在目标 `target` 中。所以，最后会根据 `disabled` 来进行不同逻辑的处理：

- `disabled` 为 `true` 时，`mainAnchor` 作为 `referenceNode`，即**注释节点**，挂载到此时 `teleport` 的父级节点中。
- `disabled` 为 `false` 时，`targetAnchor` 作为 `refereneceNode`，即 `target` 中的空文本节点，挂载到此时 `teleport` 的 `target` 节点中。

```javascript
if (disabled) {
  mount(container, mainAnchor)
} else if (target) {
  mount(target, targetAnchor)
}
```
而 `mount` 方法最终会调用原始的 `DOM API` `insertBefore` 来实现 `teleport` 内容的挂载。我们来回忆一下 `insertBefore` 的语法：
```javascript
var insertedNode = parentNode.insertBefore(newNode, referenceNode);
```
由于 `insertBefore` 的第二个参数 `referenceNode` 是必选的，**如果不提供节点或者传入无效值，在不同的浏览器中会有不同的表现（摘自 MDN）**。所以，当 `disabled` 为 `false` 时，我们的 `referenceNode` 就是一个已插入 `target` 中的**空文本节点**，从而确保在不同浏览器上都能**表现一致**。

## 总结

今天介绍的是属于 `teleport` 组件创建的逻辑。同样地，`teleport` 组件也有自己特殊的 `patch` 逻辑，这里有兴趣的同学可以自行去了解。虽说，`teleport` 组件的实现并不复杂，但是，其中的**细节处理仍然是值得学习一番**，例如注释节点来标记 `teleport` 组件位置、空文本节点作为占位节点确保 `insertBefore` 在不同浏览器上表现一致等。
