# setupComponent

`setupComponent()` 的定义：

```javascript
// packages/runtime-core/src/component.ts
function setupComponent(instance: ComponentInternalInstance, isSSR = false) {
  isInSSRComponentSetup = isSSR;

  const { props, children, shapeFlag } = instance.vnode;
  const isStateful = shapeFlag & ShapeFlags.STATEFUL_COMPONENT; // {A}
  initProps(instance, props, isStateful, isSSR); // {B}
  initSlots(instance, children); // {C}

  const setupResult = isStateful
    ? setupStatefulComponent(instance, isSSR)
    : undefined; // {D}
  isInSSRComponentSetup = false;
  return setupResult;
}
```

抛开 `SSR` 的逻辑，B 行和 C 行会先初始化组件的 `props` 和 `slots`。然后，在 A 行判断 `shapeFlag` 为 `true` 时，调用 `setupStatefulComponent()`。

> 这里又用到了 `shapeFlag`，所以需要强调的是 `shapeFlag` 和 `patchFlag` 具有一样的地位（重要性）。

而 `setupStatefulComponent()` 则会处理组合 `Composition API`，即调用 `setup()`。

## setupStatefulComponent

`setupStatefulComponent()` 定义（伪代码）：

```javascript
// packages/runtime-core/src/component.ts
setupStatefulComponent(
  instance: ComponentInternalInstance,
  isSSR: boolean
) {
  const Component = instance.type as ComponentOptions
  // {A} 验证逻辑
  ...
  instance.proxy = new Proxy(instance.ctx, PublicInstanceProxyHandlers)
  ...
  const { setup } = Component
  if (setup) {
    const setupContext = (instance.setupContext =
      setup.length > 1 ? createSetupContext(instance) : null)

    currentInstance = instance // {B}
    pauseTracking() // {C}
    const setupResult = callWithErrorHandling(
      setup,
      instance,
      ErrorCodes.SETUP_FUNCTION,
      [__DEV__ ? shallowReadonly(instance.props) : instance.props, setupContext]
    ) // {D}
    resetTracking() // {E}
    currentInstance = null

    if (isPromise(setupResult)) {
      ...
    } else {
      handleSetupResult(instance, setupResult, isSSR) // {F}
    }
  } else {
    finishComponentSetup(instance, isSSR)
  }
}
```

首先，在 B 行会给当前实例 `currentInstance` 赋值为此时的组件实例 `instance`，在回收 `currentInstance` 之前，我们会做两个操作**暂停依赖收集**、**恢复依赖收集**：

暂停依赖收集 `pauseTracking()`：

```javascript
// packages/reactivity/src/effect.ts
function pauseTracking() {
  trackStack.push(shouldTrack);
  shouldTrack = false;
}
```

恢复依赖收集 `resetTracking()`：

```javascript
// packages/reactivity/src/effect.ts
resetTracking() {
  const last = trackStack.pop()
  shouldTrack = last === undefined ? true : last
}
```

本质上这两个步骤是通过改变 `shouldTrack` 的值为 `true` 或 `false` 来控制此时是否进行依赖收集。之所以，`shouldTrack` 可以控制是否进行依赖收集，是因为在 `track` 的执行开始有这么一段代码：

```javascript
// packages/reactivity/src/effect.ts
function track(target: object, type: TrackOpTypes, key: unknown) {
  if (!shouldTrack || activeEffect === undefined) {
    return
  }
  ...
}
```

那么，我们就会提出疑问为什么这个时候需要**暂停依赖收**？这里，我们回到 D 行：

```javascript
const setupResult = callWithErrorHandling(
  setup,
  instance,
  ErrorCodes.SETUP_FUNCTION,
  [__DEV__ ? shallowReadonly(instance.props) : instance.props, setupContext]
); // {D}
```

在 `DEV` 环境下，我们需要通过 `shallowReadonly(instance.props)` 创建一个基于组件 `props` 的拷贝对象 `Proxy`，而 `props` 本质上是**响应式地**，这个时候会触发它的 `track` 逻辑，即依赖收集，明显这并**不是开发中实际需要**的订阅对象，所以，此时要暂停 `props` 的依赖收集，**过滤不必要的订阅**。

> 相比较，「Vue2.x」泛滥的订阅关系而言，这里不得不给「Vue3」对订阅关系处理的严谨思维点赞！

通常，我们 `setup()` 返回的是一个 `Object`，所以会命中 F 行的逻辑：

```javascript
handleSetupResult(instance, setupResult, isSSR);
```

## handleSetupResult

`handleSetupResult()` 定义：

```javascript
// packages/runtime-core/src/component.ts
function handleSetupResult(
  instance: ComponentInternalInstance,
  setupResult: unknown,
  isSSR: boolean
) {
  if (isFunction(setupResult)) {
    instance.render = setupResult as InternalRenderFunction
  } else if (isObject(setupResult)) {
    if (__DEV__ && isVNode(setupResult)) {
      warn(
        `setup() should not return VNodes directly - ` +
          `return a render function instead.`
      )
    }
    instance.setupState = proxyRefs(setupResult)
    if (__DEV__) {
      exposeSetupStateOnRenderContext(instance)
    }
  } else if (__DEV__ && setupResult !== undefined) {
    warn(
      `setup() should return an object. Received: ${
        setupResult === null ? 'null' : typeof setupResult
      }`
    )
  }
  finishComponentSetup(instance, isSSR)
}
```

`handleSetupResult()` 的分支逻辑较为简单，主要是验证 `setup()` 返回的结果，以下两种情况都是**不合法的**：

- `setup()` 返回的值是 `render()` 的执行结果，即 `VNode`。
- `setup()` 返回的值是 `null`、`undefined`或者其他非对象类型。

## 总结

到此，组件的开始安装过程就结束了。我们再来回顾一下这个过程会做的几件事，初始化 `props`、`slot`以及处理 `setup()` 返回的结果，期间还涉及到一个暂停依赖收集的微妙处理。

需要注意的是，此时组件并**没有开始创建**，因此我们称之为这个过程为**安装**。并且，这也是为什么官方文档会这么介绍 `setup()`：

> 一个组件选项，**在创建组件之前执行**，一旦 props 被解析，并作为组合 API 的入口点
