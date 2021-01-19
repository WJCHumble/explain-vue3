# v-show

同样地，对于 `v-show` 指令，我们在 Vue 3 在线模版编译平台输入这样一个栗子：

```javascript
<div v-show="visible"></div>
```

那么，由它编译生成的 `render` 函数：

```javascript
render(_ctx, _cache, $props, $setup, $data, $options) {
  return _withDirectives((_openBlock(), _createBlock("div", null, null, 512 /* NEED_PATCH */)), 
  [
    [_vShow, _ctx.visible]
  ])
}
```
此时，这个栗子在 `visible` 为 `false` 时，渲染到页面上的 HTML：
<div align="center">
	<img width="400" src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/b69bbf36d8f5469a84336b0dd0344502~tplv-k3u1fbpfcp-zoom-1.image"/>
</div>

从上面的 `render` 函数可以看出，不同于 `v-if` 的三目运算符表达式，`v-show` 的 `render` 函数返回的是 `_withDirectives()` 函数的执行。

前面，我们已经简单介绍了 `_openBlock()` 和 `_createBlock()` 函数。那么，除开这两者，接下来我们逐点分析一下这个 `render` 函数，首当其冲的是 `vShow` ～

## vShow 在生命周期中改变 display 属性

`_vShow` 在源码中则对应着 `vShow`，它被定义在 `packages/runtime-dom/src/directives/vShow`。它的职责是对 `v-show` 指令进行**特殊处理**，主要表现在 `beforeMount`、`mounted`、`updated`、`beforeUnMount` 这四个生命周期中：
```javascript
// packages/runtime-dom/src/directives/vShow.ts
export const vShow: ObjectDirective<VShowElement> = {
  beforeMount(el, { value }, { transition }) {
    el._vod = el.style.display === 'none' ? '' : el.style.display
    if (transition && value) {
      // 处理 tansition 逻辑
      ...
    } else {
      setDisplay(el, value)
    }
  },
  mounted(el, { value }, { transition }) {
    if (transition && value) {
      // 处理 tansition 逻辑
      ...
    }
  },
  updated(el, { value, oldValue }, { transition }) {
    if (!value === !oldValue) return
    if (transition) {
      // 处理 tansition 逻辑
      ...
    } else {
      setDisplay(el, value)
    }
  },
  beforeUnmount(el, { value }) {
    setDisplay(el, value)
  }
}
```
对于 `v-show` 指令会处理两个逻辑：普通 `v-show` 或 `transition` 时的 `v-show` 情况。通常情况下我们只是使用 `v-show` 指令，**命中的就是前者**。

>这里我们只对普通 `v-show` 情况展开分析。

普通 `v-show` 情况，都是调用的 `setDisplay()` 函数，以及会传入两个变量：

- `el` 当前使用 `v-show` 指令的**真实元素**
- `v-show` 指令对应的 `value` 的值

接着，我们来看一下 `setDisplay()` 函数的定义：
```javascript
function setDisplay(el: VShowElement, value: unknown): void {
  el.style.display = value ? el._vod : 'none'
}
```

`setDisplay()` 函数正如它本身**命名的语意**一样，是通过改变该元素的 CSS 属性 `display` 的值来动态的控制 `v-show` 绑定的元素的**显示**或隐藏。

并且，我想大家可能注意到了，当 `value` 为 `true` 的时候，`display` 是等于的 `el.vod`，而 `el.vod` 则等于这个真实元素的 CSS `display` 属性（默认情况下为空）。所以，当 `v-show` 对应的 `value` 为 `true` 的时候，**元素显示与否是取决于它本身**的 CSS `display` 属性。

>其实，到这里 `v-show` 指令的本质在源码中的体现已经出来了。但是，仍然会留有一些疑问，例如 `withDirectives` 做了什么？`vShow` 在生命周期中对 `v-show` 指令的处理又是如何运用的？


## withDirectives 在 VNode 上增加 dir 属性

`withDirectives()` 顾名思义和指令相关，即在 Vue 3 中和指令相关的元素，最后生成的 `render` 函数都会调用 `withDirectives()` 处理指令相关的逻辑，**将 `vShow` 的逻辑作为 `dir` 属性添加**到 `VNode` 上。

`withDirectives()` 函数的定义：
```javascript
// packages/runtime-core/src/directives.ts
export function withDirectives<T extends VNode>(
  vnode: T,
  directives: DirectiveArguments
): T {
  const internalInstance = currentRenderingInstance
  if (internalInstance === null) {
    __DEV__ && warn(`withDirectives can only be used inside render functions.`)
    return vnode
  }
  const instance = internalInstance.proxy
  const bindings: DirectiveBinding[] = vnode.dirs || (vnode.dirs = [])
  for (let i = 0; i < directives.length; i++) {
    let [dir, value, arg, modifiers = EMPTY_OBJ] = directives[i]
    if (isFunction(dir)) {
      ...
    }
    bindings.push({
      dir,
      instance,
      value,
      oldValue: void 0,
      arg,
      modifiers
    })
  }
  return vnode
}
```

首先，`withDirectives()` 会获取当前渲染实例处理**边缘条件**，即如果在 `render` 函数外面使用 `withDirectives()` 则会抛出异常：


>"withDirectives can only be used inside render functions."


然后，在 `vnode` 上绑定 `dirs` 属性，并且遍历传入的 `directives` 数组，而对于我们这个栗子 `directives` 就是：

```javascript
[
  [_vShow, _ctx.visible]
]
```
显然此时只会**迭代一次**（数组长度为 1）。并且从 `render` 传入的 参数可以知道，从 `directives` 上解构出的 `dir` 指的是 `_vShow`，即我们上面介绍的 `vShow`。由于 `vShow` 是一个对象，所以会重新构造（`bindings.push()`）一个 `dir` 给 `VNode.dir`。

`VNode.dir` 的作用体现在 `vShow` 在生命周期改变元素的 CSS `display` 属性，而这些**生命周期会作为派发更新的结束回调被调用**。

>接下来，我们一起来看看其中的调用细节～

## 派发更新时 patch，注册 `postRenderEffect` 事件

相信大家应该都知道 Vue 3 提出了 `patchFlag` 的概念，其用来针对不同的场景来执行对应的 `patch` 逻辑。那么，对于上面这个栗子，我们会命中 `patchElement` 的逻辑。

而对于 `v-show` 之类的指令来说，由于 `Vnode.dir` 上绑定了处理元素 CSS `display` 属性的相关逻辑（ `vShow` 定义好的生命周期处理）。所以，此时 `patchElement()` 中会为注册一个 `postRenderEffect` 事件。


```javascript
// packages/runtime-core/src/renderer.ts
const patchElement = (
    n1: VNode,
    n2: VNode,
    parentComponent: ComponentInternalInstance | null,
    parentSuspense: SuspenseBoundary | null,
    isSVG: boolean,
    optimized: boolean
  ) => {
    ...
    // 此时 dirs 是存在的
    if ((vnodeHook = newProps.onVnodeUpdated) || dirs) {
      // 注册 postRenderEffect 事件
      queuePostRenderEffect(() => {
        vnodeHook && invokeVNodeHook(vnodeHook, parentComponent, n2, n1)
        dirs && invokeDirectiveHook(n2, n1, parentComponent, 'updated')
      }, parentSuspense)
    }
    ...
  }
```


这里我们简单分析一下 `queuePostRenderEffect()` 和 `invokeDirectiveHook()` 函数：

- `queuePostRenderEffect()`，`postRenderEffect` 事件注册是通过 `queuePostRenderEffect()` 函数完成的，因为 `effect` 都是维护在一个队列中（为了保持 `effect` 的有序），这里是 `pendingPostFlushCbs`，所以对于 `postRenderEffect` 也是一样的会被**进队**

- `invokeDirectiveHook()`，由于 `vShow` 封装了对元素 CSS `display` 属性的处理，所以 `invokeDirective()` 的本职是调用指令相关的生命周期处理。并且，需要注意的是此时是**更新逻辑**，所以**只会调用 `vShow` 中定义好的 `update` 生命周期**

## flushJobs 的结束（finally）调用 `postRenderEffect`

到这里，我们已经围绕 `v-Show` 介绍完了 `vShow`、`withDirectives`、`postRenderEffect` 等概念。但是，万事具备只欠东风，还缺少一个**调用 `postRenderEffect` 事件的时机**，即处理 `pendingPostFlushCbs` 队列的时机。

在 Vue 3 中 `effect` 相当于 Vue 2.x 的 `watch`。虽然变了个命名，但是仍然保持着一样的调用方式，都是调用的 `run()` 函数，然后由 `flushJobs()` 执行 `effect` 队列。而调用 `postRenderEffect` 事件的时机**则是在执行队列的结束**。

`flushJobs()` 函数的定义：
```javascript
// packages/runtime-core/src/scheduler.ts
function flushJobs(seen?: CountMap) {
  isFlushPending = false
  isFlushing = true
  if (__DEV__) {
    seen = seen || new Map()
  }
  flushPreFlushCbs(seen)
  // 对 effect 进行排序
  queue.sort((a, b) => getId(a!) - getId(b!))
  try {
    for (flushIndex = 0; flushIndex < queue.length; flushIndex++) {
      // 执行渲染 effect
      const job = queue[flushIndex]
      if (job) {
        ...
      }
    }
  } finally {
    ...
    // postRenderEffect 事件的执行时机
    flushPostFlushCbs(seen)
    ...
  }
}
```
在 `flushJobs()` 函数中会执行三种 `effect` 队列，分别是 `preRenderEffect`、`renderEffect`、`postRenderEffect`，它们各自对应 `flushPreFlushCbs()`、`queue`、`flushPostFlushCbs`。

那么，显然 `postRenderEffect` 事件的**调用时机**是在 `flushPostFlushCbs()`。而 `flushPostFlushCbs()` 内部则会遍历 `pendingPostFlushCbs` 队列，即执行之前在 `patchElement` 时注册的 `postRenderEffect` 事件，**本质上就是执行**：

```javascript
updated(el, { value, oldValue }, { transition }) {
  if (!value === !oldValue) return
  if (transition) {
    ...
  } else {
    // 改变元素的 CSS display 属性
    setDisplay(el, value)
  }
},
```

## 总结

相比较 `v-if` 简单干脆地通过 `patch` 直接更新元素，`v-show` 的处理就略显复杂。这里我们重新梳理一下整个过程：

- 首先，由 `widthDirectives` 来生成最终的 `VNode`。它会给 `VNode` 上绑定 `dir` 属性，即 `vShow` 定义的在生命周期中对元素 CSS `display` 属性的处理
- 其次，在 `patchElement` 的阶段，会注册 `postRenderEffect` 事件，用于调用 `vShow` 定义的 `update` 生命周期处理 CSS `display` 属性的逻辑
- 最后，在派发更新的结束，调用 `postRenderEffect` 事件，即执行 `vShow` 定义的 `update` 生命周期，更改元素的 CSS `display` 属性

<div align="center">
  <img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/a2179d0b950e4de7b319372fb87c52b0~tplv-k3u1fbpfcp-zoom-1.image" />
</div>