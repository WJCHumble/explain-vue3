# finishComponentSetup

`finishComponentSetup()` 定义（伪代码）：

```javascript
// packages/runtime-core/src/component.ts
function finishComponentSetup(
  instance: ComponentInternalInstance,
  isSSR: boolean
) {
  const Component = instance.type as ComponentOptions
  ...
  if (!instance.render) { // {A}
    if (compile && Component.template && !Component.render) {
      ...
      Component.render = compile(Component.template, {
        isCustomElement: instance.appContext.config.isCustomElement || NO,
        delimiters: Component.delimiters
      })
      ...
    }

    instance.render = (Component.render || NOOP) as InternalRenderFunction // {B}
    if (instance.render._rc) {
      instance.withProxy = new Proxy(
        instance.ctx,
        RuntimeCompiledPublicInstanceProxyHandlers
      )
    }
  }

  if (__FEATURE_OPTIONS_API__) { // {C}
    currentInstance = instance
    applyOptions(instance, Component)
    currentInstance = null
  }
  ...
}
```

整体上 `finishComponentSetup()` 可以分为三个核心逻辑：

- 绑定 `render` 函数到当前实例 `instance` 上（行 A），这会两种情况，一是手写 `render` 函数，二是模板 `template` 写法，它会调用 `compile` 编译模板生成 `render` 函数。
- 为模板 `template` 生成的 `render` 函数（行 B），单独使用一个不同的 `has` 陷阱。因为，编译生成的 `render` 函数是会存在 `withBlock` 之类的优化，以及它会有一个全局的白名单来实现避免进入 `has` 陷阱。
- 应用 `options`（行 C），即对应的 `computed`、`watch`、`lifecycle` 等等。

## applyOptions

`applyOptions()` 定义：

```javascript
// packages/runtime-core/src/componentOptions.ts
function applyOptions(
  instance: ComponentInternalInstance,
  options: ComponentOptions,
  deferredData: DataFn[] = [],
  deferredWatch: ComponentWatchOptions[] = [],
  asMixin: boolean = false
) {
  ...
}
```

由于， `applyOptions()` 涉及的代码较多，我们先不看代码，看一下整体的流程：
![](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/a0075fcccf644b17a44055ff45d5dc2e~tplv-k3u1fbpfcp-zoom-1.image)

`applyOptions()` 的流程并不复杂，但是从流程中我们总结出**两点**平常开发中忌讳的点：

- 不要在 `beforeCreate` 中访问 `mixin` 相关变量。
- 由于本地 `mixin` 后于全局 `mixin` 执行，所以在一些变量命名重复的场景，我们需要确认要使用的是全局 `mixin` 的这个变量还是本地的 `mixin`。

> 对于 `mixin` 重名时选择本地还是全局的处理，有兴趣的同学可以去官方文档了解。

我们再从代码层面看整个流程，这里分析几点常关注的属性是怎么初始化的：

## 注册事件（methods）

```javascript
if (methods) {
  for (const key in methods) {
    const methodHandler = (methods as MethodOptions)[key]
    if (isFunction(methodHandler)) {
      ctx[key] = methodHandler.bind(publicThis) // {A}
      if (__DEV__) {
        checkDuplicateProperties!(OptionTypes.METHODS, key)
      }
    } else if (__DEV__) {
      warn(
        `Method "${key}" has type "${typeof methodHandler}" in the component definition. ` +
          `Did you reference the function correctly?`
      )
    }
  }
}
```

事件的注册，主要就是遍历已经处理好的 `methods` 属性，然后在当前上下文 `ctx` 中绑定对应事件名的属性 `key` 的事件 `methodHandler`（行 A）。并且，**在开发环境下**会对当前上下文属性的唯一性进行判断。

## 绑定计算属性（computed）

```javascript
if (computedOptions) {
    for (const key in computedOptions) {
      const opt = (computedOptions as ComputedOptions)[key]
      const get = isFunction(opt)
        ? opt.bind(publicThis, publicThis)
        : isFunction(opt.get)
          ? opt.get.bind(publicThis, publicThis)
          : NOOP // {A}
      if (__DEV__ && get === NOOP) {
        warn(`Computed property "${key}" has no getter.`)
      }
      const set =
        !isFunction(opt) && isFunction(opt.set)
          ? opt.set.bind(publicThis)
          : __DEV__
            ? () => {
                warn(
                  `Write operation failed: computed property "${key}" is readonly.`
                )
              }
            : NOOP // {B}
      const c = computed({
        get,
        set
      }) // {C}
      Object.defineProperty(ctx, key, {
        enumerable: true,
        configurable: true,
        get: () => c.value,
        set: v => (c.value = v)
      }) {D}
      if (__DEV__) {
        checkDuplicateProperties!(OptionTypes.COMPUTED, key)
      }
    }
  }
```

绑定计算属性主要是遍历构建好的 `computedOptions`，然后提取每一个计算属性 `key` 对应的 `get` 和 `set`（行 A），也是我们熟悉的对于 `get` 是**强校验**，即计算属性**必须要有 `get`**，**可以没有 `set`**，如果没有 `set`（行 B），此时它的 `set` 为：

```javascript
() => {
  warn(`Write operation failed: computed property "${key}" is readonly.`);
};
```

> 所以，这也是为什么我们修改一个没有定义 `set` 的计算属性时会提示这样的错误。

然后，在 C 行会调用 `computed` 注册该计算属性，即 `effect` 的注册。最后，将该计算属性通过 `Object.defineProperty` 代理到当前上下文 `ctx` 中（行 D），保证通过 `this.computedAttrName` 可以获取到该计算属性。

## 生命周期处理

生命周期的处理比较特殊的是 `beforeCreate`，它是优于 `mixin`、`data`、`watch`、`computed` 先处理：

```javascript
if (!asMixin) {
  callSyncHook("beforeCreate", options, publicThis, globalMixins);
  applyMixins(instance, globalMixins, deferredData, deferredWatch);
}
```

至于其余的生命周期是在最后处理，即它们可以正常地访问实例上的属性（伪代码）：

```javascript
if (lifecycle) {
  onBeforeMount(lifecycle.bind(publicThis));
}
```

## 总结

结束安装过程，主要是初始化我们常见的组件上的选项，只不过我们可以不用 `options` 式的写法，但是实际上源码中仍然是转化成 `options` 处理，主要也是为了兼容 `options` 写法。并且，结束安装的过程比较重要的一点就是调用各个生命周期，而熟悉每个生命周期的执行时机，也可以便于我们平常的开发不犯错。
