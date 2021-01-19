# 依赖收集（track）

## get

前面，我们已经讲到了在组件渲染过程会安装渲染 `Effect`。然后，进入渲染组件的阶段，即 `renderComponentRoot()`，而此时会调用 `proxyToUse`，即会触发 `runtimeCompiledRenderProxyHandlers` 的 `get`，即：

```javascript
get(target, key) {
    ...
    else if (renderContext !== EMPTY_OBJ && hasOwn(renderContext, key)) {
        accessCache[key] = 1 /* CONTEXT */;
        return renderContext[key];
    }
    ...
}
```

可以看出，此时会命中 `accessCache[key] = 1` 和 `renderContext[key]` 。对于**前者**是做一个缓存的作用，**后者**是从当前的渲染上下文中获取 `key` 对应的值（（对于本文这个 `case`，`key` 对应的就是 `count`，它的值为 `0`）。

那么，我想这个时候大家会立即反应，此时会触发这个 `count` 对应 `Proxy` 的 `get`。但是，在我们这个 `case` 中，用了 `toRefs()` 将 `reactive` 包裹导出，所以这个触发 `get` 的过程会分为两个阶段：

> 两个阶段的不同点在于，第一阶段的 `target` 为一个 `object`（即上面所说的`toRefs`的对象结构），而第二阶段的 `target` 为`Proxy`对象 `{count: 0}`。具体细节可以看我[上篇文章](https://juejin.im/post/5e7707f0f265da57301c18b8)

`Proxy` 对象`toRefs()` 后得到对象的结构：

```javascript
{
    value: 0
    _isRef: true
    get: function() {}
    set: ƒunction(newVal) {}
}
```

我们先来看看 `get()` 的逻辑：

```javascript
function createGetter(isReadonly = false, shallow = false) {
    return function get(target, key, receiver) {
        ...
        const res = Reflect.get(target, key, receiver);
        if (isSymbol(key) && builtInSymbols.has(key)) {
            return res;
        }
        ...
        // ref unwrapping, only for Objects, not for Arrays.
        if (isRef(res) && !isArray(target)) {
            return res.value;
        }
        track(target, "get" /* GET */, key);
        return isObject(res)
            ? isReadonly
                ? // need to lazy access readonly and reactive here to avoid
                    // circular dependency
                    readonly(res)
                : reactive(res)
            : res;
    };
}
```

> 第一阶段：触发普通对象的 `get`

由于此时是第一阶段，所以我们会命中 `isRef()` 的逻辑，并返回 `res.value` 。此时就会触发 `reactive` 定义的 `Proxy` 对象的 `get`。并且需要**注意**的是 `toRefs()` 只能用于对象，否则我们即时触发了 `get` 也不能获取对应的值（这其实也是看源码的一些好处，深度理解 `API` 的使用）。

## track

> 第二阶段：触发 `Proxy` 对象的 `get`

此时属于第二阶段，所以我们会命中 `get` 的最后逻辑：

```javascript
track(target, "get" /* GET */, key)
return isObject(res)
  ? isReadonly
    ? // need to lazy access readonly and reactive here to avoid
      // circular dependency
      readonly(res)
    : reactive(res)
  : res
```

可以看到，首先会调用 `track()` 函数，进行**依赖收集**，而 `track()` 函数定义如下：

```javascript
function track(target, type, key) {
  if (!shouldTrack || activeEffect === undefined) {
    return
  }
  let depsMap = targetMap.get(target)
  if (depsMap === void 0) {
    targetMap.set(target, (depsMap = new Map()))
  }
  let dep = depsMap.get(key)
  if (dep === void 0) {
    depsMap.set(key, (dep = new Set()))
  }
  if (!dep.has(activeEffect)) {
    dep.add(activeEffect)
    activeEffect.deps.push(dep)
    if (process.env.NODE_ENV !== "production" && activeEffect.options.onTrack) {
      activeEffect.options.onTrack({
        effect: activeEffect,
        target,
        type,
        key,
      })
    }
  }
}
```

可以看到，第一个分支逻辑不会命中，因为我们在前面分析 `run()` 的时候，就已经定义 `ishouldTrack = true` 和 `activeEffect = effect`。然后，命中 `depsMap === void 0` 逻辑，往 `targetMap` 中添加一个键名为 `{count: 0}` 键值为一个空的 `Map`:

```javascript
if (depsMap === void 0) {
  targetMap.set(target, (depsMap = new Map()))
}
```

> 而此时，我们也可以对比`Vue 2.x`，这个 `{count: 0}` 其实就相当于 `data` 选项（以下统称为 `data`）。所以，这里也可以理解成先对 `data` 初始化一个 `Map`，显然这个 `Map` 中存的就是不同属性对应的 `dep`

然后，对 `count` 属性初始化一个 `Map` 插入到 `data` 选项中，即：

```javascript
let dep = depsMap.get(key)
if (dep === void 0) {
  depsMap.set(key, (dep = new Set()))
}
```

所以，此时的 `dep` 就是 `count` 属性对应的主题对象了。接下来，则判断是否当前 `activeEffect` 存在于 `count` 的主题中，如果不存在则往主题 `dep` 中添加 `activeEffect`，并且将当前主题 `dep` 添加到 `activeEffect` 的 `deps` 数组中。

```javascript
if (!dep.has(activeEffect)) {
  dep.add(activeEffect)
  activeEffect.deps.push(dep)
  // 最后的分支逻辑，我们这次并不会命中
}
```

最后，再回到 `get()`，会返回 `res` 的值，在我们这个 `case` 是 `res` 的值是 `0`。

```javascript
return isObject(res)
  ? isReadonly
    ? // need to lazy access readonly and reactive here to avoid
      // circular dependency
      readonly(res)
    : reactive(res)
  : res
```

## 总结

好了，整个 `reactive` 的依赖收集过程，已经分析完了。我们再来回忆其中几个关键点，首先在组件渲染过程，会给当前 `vm` 实例创建一个 `effect`，然后将当前的 `activeEffect` 赋值为 `effect`，并在 `effect` 上创建一些属性，例如非常重要的 `deps` 用于**保存依赖**。

接下来，当该组件使用了 `data` 中的变量时，会访问对应变量的 `get()`。第一次访问 `get()` 会创建 `data` 对应的 `depsMap`，即 `targetMap`。然后再往 `targetMap` 的 `depMap` 中添加对应属性的 `Map`，即 `depsMap`。

创建完属性的 `depsMap` 后，一方面会往该属性的 `depsMap` 中添加当前 `activeEffect`，即**收集订阅者**。另一方面，将该属性的 `depsMap` 添加到 `activeEffect` 的 `deps` 数组中，**即订阅主题**。从而，形成整个依赖收集过程。

> 整个 `get` 过程的流程图

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/596ab5f7d97a42528dbc6c9a8aad2d56~tplv-k3u1fbpfcp-zoom-1.image)
