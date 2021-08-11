## 基本介绍

> 值得一提的是在 `Vue 3.0` 中没有了`watcher` 的概念，取而代之的是 `effect` ，所以接下来会接触很多和 `effect` 相关的函数

在文章的开始前，我们先准备这样一个简单的 `case`，以便后续分析具体逻辑：

**main.js 项目入口**

```javascript
import { createApp } from "vue";
import App from "./App.vue";

createApp(App).mount("#app");
```

**App.vue 组件**

```javascript
<template>
  <button @click="inc">Clicked {{ count }} times.</button>
</template>

<script>
import { reactive, toRefs } from 'vue'

export default {
  setup() {
    const state = reactive({
      count: 0,
    })
    const inc = () => {
      state.count++
    }

    return {
      inc,
      ...toRefs(state)
    }
  }
}
</script>
```

## 安装渲染 Effect

首先，我们大家都知道在通常情况下，我们的页面会使用当前实例的一些属性、计算属性、方法等等。所以，在组件渲染的过程就会发生依赖收集的这个过程。也因此，我们先从组件的渲染过程开始分析。

在组件的渲染过程中，会安装（创建）一个渲染 `effect`，即 `Vue 3.0` 在编译 `template` 的时候，对是否有订阅数据做出相应的判断，创建对应的渲染 `effect`，它的定义如下：

```javascript
const setupRenderEffect = (instance, initialVNode, container, anchor, parentSuspense, isSVG) => {
    // create reactive effect for rendering
    instance.update = effect(function componentEffect() {
            ....
            instance.isMounted = true;
        }
        else {
            ...
        }
    }, (process.env.NODE_ENV !== 'production') ? createDevEffectOptions(instance) : prodEffectOptions);
};
```

我们来大致分析一下 `setupRenderEffect()`。它传入几个参数，它们分别为：

- `instance` 当前 `vm` 实例
- `initialVNode` 可以是组件 `VNode` 或者普通 `VNode`
- `container` 挂载的模板，例如 `div#app` 对应的节点
- `anchor`, `parentSuspense`, `isSVG` 普通情况下都为 `null`

然后在当前实例 `instance` 上创建属性 `update` 赋值为 `effect()` 函数的执行结果，`effect()` 函数传入两个参数：

- `componentEffect()` 函数，它会在具体逻辑之后提到，这里我们先不讲
- `createDevEffectOptions(instance)` 用于后续的派发更新，它会返回一个对象：

```javascript
{
    scheduler: queueJob(job) {
                    if (!queue.includes(job)) {
                        queue.push(job);
                        queueFlush();
                    }
                },
    onTrack: instance.rtc ? e => invokeHooks(instance.rtc, e) : void 0,
    onTrigger: instance.rtg ? e => invokeHooks(instance.rtg, e) : void 0
}
```

然后，我们再来看看`effect()` 函数定义：

```javascript
function effect(fn, options = EMPTY_OBJ) {
  if (isEffect(fn)) {
    fn = fn.raw;
  }
  const effect = createReactiveEffect(fn, options);
  if (!options.lazy) {
    effect();
  }
  return effect;
}
```

`effect()` 函数的逻辑较为简单，首先判断是否已经为 `effect`，是则取出之前定义的。不是则通过 `ceateReactiveEffect()` 创建一个 `effect`，而 `creatReactiveEffect()` 的逻辑会是这样：

```javascript
function createReactiveEffect(fn, options) {
  const effect = function reactiveEffect(...args) {
    return run(effect, fn, args);
  };
  effect._isEffect = true;
  effect.active = true;
  effect.raw = fn;
  effect.deps = [];
  effect.options = options;
  return effect;
}
```

可以看到在 `createReactiveEffect()` 中先定义了一个 `reactiveEffect()` 函数赋值给 `effect`，它又调用了 `run()`方法。而 `run()` 方法中传入三个参数，分别为：

- `effect`，即 `reactiveEffect()` 函数本身
- `fn`，即在刚开始 `instance.update` 是调用 `effect` 函数时，传入的函数 `componentEffect()`
- `args` 为一个空数组

并且，对 `effect` 进行了一些初始化，例如我们**最熟悉**的 `Vue 2x` 中的 `deps` 就出现在 `effect` 这个对象上。

然后，我们分析一下 `run()` 函数的逻辑：

```javascript
function run(effect, fn, args) {
  if (!effect.active) {
    return fn(...args);
  }
  if (!effectStack.includes(effect)) {
    cleanup(effect);
    try {
      enableTracking();
      effectStack.push(effect);
      activeEffect = effect;
      return fn(...args);
    } finally {
      effectStack.pop();
      resetTracking();
      activeEffect = effectStack[effectStack.length - 1];
    }
  }
}
```

在这里，初次创建 `effect`，我们会命中第二个分支逻辑，即当前 `effectStack` 栈中不包含这个 `effect`。那么，首先会执行 `cleanup(effect)`，即遍历`effect.deps`，清空之前的依赖。

> `cleanup()` 的逻辑其实在`Vue 2x`的源码中也有的，避免依赖的重复收集。并且，对比 `Vue 2x`，`Vue 3.0` 中的 `track` 其实相当于 `watcher`，在 `track` 中会进行依赖的收集，后面我们会讲 `track` 的具体实现

然后，执行`enableTracking()`和`effectStack.push(effect)`，前者的逻辑很简单，即可以追踪，用于后续触发 `track` 的判断：

```javascript
function enableTracking() {
  trackStack.push(shouldTrack);
  shouldTrack = true;
}
```

而后者，即将当前的 `effect` 添加到 `effectStack` 栈中。最后，执行 `fn()` ，即我们一开始定义的 `instance.update = effect()` 时候传入的 `componentEffect()`：

```javascript
instance.update = effect(function componentEffect() {
    if (!instance.isMounted) {
        const subTree = (instance.subTree = renderComponentRoot(instance));
        // beforeMount hook
        if (instance.bm !== null) {
            invokeHooks(instance.bm);
        }
        if (initialVNode.el && hydrateNode) {
            // vnode has adopted host node - perform hydration instead of mount.
            hydrateNode(initialVNode.el, subTree, instance, parentSuspense);
        }
        else {
            patch(null, subTree, container, anchor, instance, parentSuspense, isSVG);
            initialVNode.el = subTree.el;
        }
        // mounted hook
        if (instance.m !== null) {
            queuePostRenderEffect(instance.m, parentSuspense);
        }
        // activated hook for keep-alive roots.
        if (instance.a !== null &&
            instance.vnode.shapeFlag & 256 /* COMPONENT_SHOULD_KEEP_ALIVE */) {
            queuePostRenderEffect(instance.a, parentSuspense);
        }
        instance.isMounted = true;
    }
    else {
        ...
    }
}, (process.env.NODE_ENV !== 'production') ? createDevEffectOptions(instance) : prodEffectOptions);
```

> 而接下来就会进入组件的渲染过程，其中涉及 `renderComponnetRoot`、`patch` 等等，这次我们并不会分析组件渲染具体细节。

安装渲染 `Effect`，是为后续的依赖收集做一个前期的准备。因为在后面会用到 `setupRenderEffect` 中定义的 `effect()` 函数，以及会调用 `run()` 函数。所以，接下来，我们就正式进入依赖收集部分的分析。
