# 派发更新（trigger）

## set

分析完依赖收集的过程，那么派发更新的整个过程的分析也将会水到渠成。首先，对应派发更新，是指当某个主题发生变化时，在我们这个 `case` 是当 `count` 发生变化时，此时会触发 `data` 的 `set()`，即 `target` 为 `data`，`key` 为 `count`。

```javascript
function set(target, key, value, receiver) {
        ...
        const oldValue = target[key];
        if (!shallow) {
            value = toRaw(value);
            if (!isArray(target) && isRef(oldValue) && !isRef(value)) {
                oldValue.value = value;
                return true;
            }
        }
        const hadKey = hasOwn(target, key);
        const result = Reflect.set(target, key, value, receiver);
        // don't trigger if target is something up in the prototype chain of original
        if (target === toRaw(receiver)) {
            if (!hadKey) {
                trigger(target, "add" /* ADD */, key, value);
            }
            else if (hasChanged(value, oldValue)) {
                trigger(target, "set" /* SET */, key, value, oldValue);
            }
        }
        return result;
    };
```

可以看到，`oldValue` 为 `0`，而我们的 `shallow` 此时为 `false`，`value` 为 1。那么，我们看一下 `toRaw()` 函数的逻辑：

```javascript
function toRaw(observed) {
  return reactiveToRaw.get(observed) || readonlyToRaw.get(observed) || observed
}
```

`toRaw()` 中有两个 `WeakMap` 类型的变量 `reactiveToRaw` 和 `readonlyRaw`。前者是在初始化 `reactive` 的时候，将对应的 `Proxy` 对象存入 `reactiveToRaw` 这个 `Map` 中。后者，则是**存入和前者相反的键值对**。即：

```javascript
function createReactiveObject(target, toProxy, toRaw, baseHandlers, collectionHandlers) {
    ...
    observed = new Proxy(target, handlers);
    toProxy.set(target, observed);
    toRaw.set(observed, target);
    ...
}
```

很显然对于 `toRaw()` 方法而言，会返回 `observer` 即 1。所以，**回到** `set()` **的逻辑**，调用 `Reflect.set()` 方法将 `data` 上的 `count` 的值修改为 1。并且，接下来我们还会命中 `target === toRaw(receiver)` 的逻辑。

而 `target === toRaw(receiver)` 的逻辑会处理两个逻辑：

- 如果当前对象不存在该属性，触发 `triger()` 函数对应的 `add`。

- 或者该属性发生变化，触发 `triger()` 函数对应的 `set`

### trigger

首先，我们先看一下 `trigger()` 函数的定义：

```javascript
function trigger(target, type, key, newValue, oldValue, oldTarget) {
    const depsMap = targetMap.get(target);
    if (depsMap === void 0) {
        // never been tracked
        return;
    }
    const effects = new Set();
    const computedRunners = new Set();
    if (type === "clear" /* CLEAR */) {
        ...
    }
    else if (key === 'length' && isArray(target)) {
        ...
    }
    else {
        // schedule runs for SET | ADD | DELETE
        if (key !== void 0) {
            addRunners(effects, computedRunners, depsMap.get(key));
        }
        // also run for iteration key on ADD | DELETE | Map.SET
        if (type === "add" /* ADD */ ||
            (type === "delete" /* DELETE */ && !isArray(target)) ||
            (type === "set" /* SET */ && target instanceof Map)) {
            const iterationKey = isArray(target) ? 'length' : ITERATE_KEY;
            addRunners(effects, computedRunners, depsMap.get(iterationKey));
        }
    }
    const run = (effect) => {
        scheduleRun(effect, target, type, key, (process.env.NODE_ENV !== 'production')
            ? {
                newValue,
                oldValue,
                oldTarget
            }
            : undefined);
    };
    // Important: computed effects must be run first so that computed getters
    // can be invalidated before any normal effects that depend on them are run.
    computedRunners.forEach(run);
    effects.forEach(run);
}
```

> 并且，大家可以看到这里有一个细节，就是计算属性的派发更新要优先于普通属性。

在 `trigger()` 函数，首先获取当前 `targetMap` 中 `data` 对应的主题对象的 `depsMap`，而这个 `depsMap` 即我们在依赖收集时在 `track` 中定义的。

然后，初始化两个 `Set` 集合 `effects` 和 `computedRunners` ，用于记录普通属性或计算属性的 `effect`，这个过程是会在 `addRunners()` 中进行。

接下来，定义了一个 `run()` 函数，包裹了 `scheduleRun()` 函数，并对开发环境和生产环境进行不同参数的传递，这里由于我们处于开发环境，所以传入的是一个对象，即：

```javascript
{
    newValue: 1,
    oldValue: 0,
    oldTarget: undefined
}
```

然后遍历 `effects`，调用 `run()` 函数，而这个过程实际调用的是 `scheduleRun()`：

```javascript
function scheduleRun(effect, target, type, key, extraInfo) {
  if (process.env.NODE_ENV !== "production" && effect.options.onTrigger) {
    const event = {
      effect,
      target,
      key,
      type,
    }
    effect.options.onTrigger(extraInfo ? extend(event, extraInfo) : event)
  }
  if (effect.options.scheduler !== void 0) {
    effect.options.scheduler(effect)
  } else {
    effect()
  }
}
```

此时，我们会命中 `effect.options.scheduler !== void 0` 的逻辑。然后，调用 `effect.options.scheduler()` 函数，即调用 `queueJob()` 函数：

> `scheduler` 这个属性是在 `setupRenderEffect` 调用 `effect` 函数时创建的。

```javascript
function queueJob(job) {
  if (!queue.includes(job)) {
    queue.push(job)
    queueFlush()
  }
}
```

> 这里使用了一个队列维护所有 `effect()` 函数，其实也和 `Vue 2x` 相似，因为我们 `effect()` 相当于 `watcher`，而 `Vue 2x` 中对 `watcher` 的调用也是通过队列的方式维护。队列的存在具体是为了保持 `watcher` 触发的次序，例如先父 `watcher` 后子 `watcher`。

可以看到 我们会先将 `effect()` 函数添加到队列 `queue` 中，然后调用 `queueFlush()` 清空和调用 `queue`：

```javascript
function queueFlush() {
  if (!isFlushing && !isFlushPending) {
    isFlushPending = true
    nextTick(flushJobs)
  }
}
```

熟悉 `Vue 2x` 源码的同学，应该知道 `Vue 2x` 中的 `watcher` 也是在下一个 `tick` 中执行，而 `Vue 3.0` 也是一样。而 `flushJobs` 中就会对 `queue` 队列中的 `effect()` 进行执行：

```javascript
function flushJobs(seen) {
  isFlushPending = false
  isFlushing = true
  let job
  if (process.env.NODE_ENV !== "production") {
    seen = seen || new Map()
  }
  while ((job = queue.shift()) !== undefined) {
    if (job === null) {
      continue
    }
    if (process.env.NODE_ENV !== "production") {
      checkRecursiveUpdates(seen, job)
    }
    callWithErrorHandling(job, null, 12 /* SCHEDULER */)
  }
  flushPostFlushCbs(seen)
  isFlushing = false
  if (queue.length || postFlushCbs.length) {
    flushJobs(seen)
  }
}
```

`flushJob()` 主要会做几件事：

- 首先初始化一个 `Map` 集合 `seen`，然后在递归 `queue` 队列的过程，调用 `checkRecursiveUpdates()` 记录该 `job` 即 `effect()` 触发的次数。如果超过 `100` 次会抛出错误。
- 然后调用 `callWithErrorHandling()`，执行 `job` 即 `effect()`，而我们都知道的是这个 `effect` 是在 `createReactiveEffect()` 时创建的 `reactiveEffect()`，所以，最终会执行 `run()` 方法，即执行最初在 `setupRenderEffectect` 定义的 `effect()`：

```javascript
    const setupRenderEffectect = (instance, initialVNode, container, anchor, parentSuspense, isSVG) => {
        // create reactive effect for rendering
        instance.update = effect(function componentEffect() {
            if (!instance.isMounted) {
                ...
            }
            else {
                ...
                const nextTree = renderComponentRoot(instance);
                const prevTree = instance.subTree;
                instance.subTree = nextTree;
                if (instance.bu !== null) {
                    invokeHooks(instance.bu);
                }
                if (instance.refs !== EMPTY_OBJ) {
                    instance.refs = {};
                }
                patch(prevTree, nextTree,
                hostParentNode(prevTree.el),
                getNextHostNode(prevTree), instance, parentSuspense, isSVG);
                instance.vnode.el = nextTree.el;
                if (next === null) {
                    updateHOCHostEl(instance, nextTree.el);
                }
                if (instance.u !== null) {
                    queuePostRenderEffect(instance.u, parentSuspense);
                }
                if ((process.env.NODE_ENV !== 'production')) {
                    popWarningContext();
                }
            }
        }, (process.env.NODE_ENV !== 'production') ? createDevEffectOptions(instance) : prodEffectOptions);
    };
```

即此时就是派发更新的最后阶段了，会先 `renderComponentRoot()` 创建组件 `VNode`，然后 `patch()` ，即走一遍组件渲染的过程（当然此时称为更新更为贴切）。从而，完成视图的更新。

## 总结

同样地，我们也来回忆派发更新过程的几个关键点。首先，触发依赖的 `set()`，它会调用 `Reflect.set()` 修改依赖对应属性的值。然后，调用 `trigger()` 函数，获取 `targetMap` 中对应属性的主题，即 `depsMap()`，并且将 `depsMap` 中的 `effect()` 存进 `effect` 集合中。接下来，就将 `effect` 进队，在下一个 `tick` 中清空和执行所有 `effect`。最后，和在初始化的时候提及的一样，走组件的更新过程，即 `renderComponent()`、`patch()` 等等。

> 整个 `set` 过程的流程图

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/09959c0d138041d1a9d2039804c013d5~tplv-k3u1fbpfcp-zoom-1.image)
