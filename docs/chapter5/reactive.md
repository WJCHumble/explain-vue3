# reactive API

```reactive API``` 的定义为传入一个对象并返回一个基于原对象的响应式代理，即返回一个 ```Proxy```，相当于 ```Vue2x``` 版本中的 ```Vue.observer```。

首先，我们需要知道在 ```Vue3.0``` 中彻底废掉了原先的 ```Options API```，而改用 ``` Composition API```，简易版的 ```Composition API``` 看起来会是这样的：
```javascript
  setup() {
    const state = reactive({
      count: 0,
      double: computed(() => state.count * 2)
    })

    function increment() {
      state.count++
    }

    return {
      state,
      increment
    }
  }
```
可以看到，没有了我们熟悉的```data```、```computed```、```methods```等等。看起来，似乎有点 ```React```风格，这个提出确实当时社区中引发了很多讨论，说```Vue```越来越像```React```....很多人并不是很能接受，具体细节大家可以去阅读 [RFC 的介绍](https://vue-composition-api-rfc.netlify.com/#basic-example)。

## 优点

回到本篇文章所关注的，很明显 ```reactive API``` 是**对标** ```data``` 选项，那么相比较 ```data``` 选项有哪些优点？

首先，在 ```Vue 2x``` 中数据的响应式处理是基于 ```Object.defineProperty()``` 的，但是它只会侦听对象的属性，并不能侦听对象。所以，在添加对象属性的时候，通常需要这样：
```javascript
    // vue2x添加属性
    Vue.$set(object, 'name', wjc)
```

```reactive API``` 是基于 ```ES2015 Proxy``` 实现对**数据对象**的响应式处理，即在  ```Vue3.0``` 可以往对象中添加属性，并且这个属性也会具有响应式的效果，例如：
```javascript
    // vue3.0中添加属性
    object.name = 'wjc'
```


## 注意点

使用 ```reactive API``` 需要注意的是，当你在 ```setup```  中返回的时候，需要通过对象的形式，例如：
```javascript
    export default {
      setup() {
          const pos = reactive({
            x: 0,
            y: 0
          })

          return {
             pos: useMousePosition()
          }
      }
    }
```
或者，借助 ```toRefs API``` 包裹一下导出，这种情况下我们就可以使用展开运算符或解构，例如：
```javascript
    export default {
      setup() {
          let state = reactive({
            x: 0,
            y: 0
          })
        
          state = toRefs(state)
          return {
             ...state
          }
      }
    } 
```

> toRefs() 具体做了什么，接下来会和 reactive 一起讲解

## 源码实现

首先，相信大家都有所耳闻，```Vue3.0``` 用 ```TypeScript``` 重构了。所以，大家可能会以为这次会看到一堆 ```TypeScript``` 的类型之类的。出于各种考虑，本次我只是讲解编译后，转为 JS 的源码实现（没啥子门槛，大家放心 hh）。

### reactive

1.先来看看 ```reactive``` 函数的实现：
```javascript
function reactive(target) {
    // if trying to observe a readonly proxy, return the readonly version.
    if (readonlyToRaw.has(target)) {
        return target;
    }
    // target is explicitly marked as readonly by user
    if (readonlyValues.has(target)) {
        return readonly(target);
    }
    if (isRef(target)) {
        return target;
    }
    return createReactiveObject(target, rawToReactive, reactiveToRaw, mutableHandlers, mutableCollectionHandlers);
}
```
可以，看到先有 3 个逻辑判断，对 ```readonly```、```readonlyValues```、```isRef``` 分别进行了判断。我们先不看这些逻辑，通常我们定义 ```reactive``` 会直接传入一个对象。所以会命中最后的逻辑 ```createReactiveObject()```。

2.那我们转到 ```createReactiveObject()``` 的定义：
```javascript
function createReactiveObject(target, toProxy, toRaw, baseHandlers, collectionHandlers) {
    if (!isObject(target)) {
        if ((process.env.NODE_ENV !== 'production')) {
            console.warn(`value cannot be made reactive: ${String(target)}`);
        }
        return target;
    }
    // target already has corresponding Proxy
    let observed = toProxy.get(target);
    if (observed !== void 0) {
        return observed;
    }
    // target is already a Proxy
    if (toRaw.has(target)) {
        return target;
    }
    // only a whitelist of value types can be observed.
    if (!canObserve(target)) {
        return target;
    }
    const handlers = collectionTypes.has(target.constructor)
        ? collectionHandlers
        : baseHandlers;
    observed = new Proxy(target, handlers);
    toProxy.set(target, observed);
    toRaw.set(observed, target);
    return observed;
}
```
```createReactiveObject()``` 传入了四个参数，它们分别扮演的角色：
- ```target``` 是我们定义 ```reactive``` 时传入的对象
- ```toProxy``` 是一个空的 ```WeakSet```。
- ```toProxy``` 是一个空的 ```WeakSet```。
- ```baseHandlers``` 是一个已经定义好 ```get``` 和 ```set``` 的对象，它看起来会是这样：
```javascript
    const baseHandlers = {
        get(target, key, receiver) {},
        set(target, key, value, receiver) {},
        deleteProxy: (target, key) {},
        has: (target, key) {},
        ownKey: (target) {}
    };
```

- ```collectionHandlers``` 是一个只包含 get 的对象。

然后，进入 ```createReactiveObject()```， 同样地，一些分支逻辑我们这次不会去分析。

> 看源码时需要保持的一个平常心，先看主逻辑

所以，我们会命中最后的逻辑，即：
```javascript
    const handlers = collectionTypes.has(target.constructor)
        ? collectionHandlers
        : baseHandlers;
    observed = new Proxy(target, handlers);
    toProxy.set(target, observed);
    toRaw.set(observed, target);
```
它首先判断 ```collectionTypes``` 中是否会包含我们传入的 ```target``` 的构造函数，而 ```collectionTypes``` 是一个 ```Set``` 集合，主要包含 ```Set```, ```Map```, ```WeakMap```, ```WeakSet``` 等四种集合的构造函数。

如果 ```collectionTypes``` 包含它的构造函数，那么将 ```handlers``` 赋值为只有 ```get``` 的 ```collectionHandlers``` 对象，否则，赋值为 ```baseHandlers``` 对象。

>这两者的区别就在于前者只有 get，很显然这个是留给不需要派发更新的变量定义的，例如我们熟悉的 props 它就只实现了 get。

然后，将 ```target``` 和 ```handlers``` 传入 ```Proxy```，作为参数实例化一个 ```Proxy``` 对象。这也是我们看到一些文章常谈的 ```Vue3.0``` 用 ```ES2015 Proxy``` 取代了 ```Object.defineProperty```。

最后的两个逻辑，也是非常重要，```toProxy()``` 将已经定义好 ```Proxy``` 对象的 ```target``` 和 对应的 ```observed``` 作为键值对塞进 ```toProxy``` 这个 ```WeakMap``` 中，用于下次如果存在相同引用的 target 需要 reactive，会命中前面的分支逻辑，返回定义之前定义好的 ```observed```，即：
```javascript
    // target already has corresponding Proxy target 是已经有相关的 Proxy 对象
    let observed = toProxy.get(target);
    if (observed !== void 0) {
        return observed;
    }
```

而 ```toRaw()``` 则是和 ```toProxy``` 相反的键值对存入，用于下次如果传进的 ```target``` 已经是一个 ```Proxy``` 对象时，返回这个 ```target```，即：
```javascript
    // target is already a Proxy target 已经是一个 Proxy 对象
    if (toRaw.has(target)) {
        return target;
    }
```

### toRefs

前面讲了使用 ```reactive``` 需要关注的点，提及 ```toRefs``` 可以让我们方便地使用解构和展开运算符，其实是最近 ```Vue3.0 issue``` 也有大神讲解过这方面的东西。有兴趣的同学可以移步 [When it's really needed to use `toRefs` in order to retain reactivity of `reactive` value](https://github.com/vuejs/rfcs/issues/145#issuecomment-602171029)了解。

我当时也凑了一下热闹，如下图：

![](https://user-gold-cdn.xitu.io/2020/3/23/171056493a9e69ae?w=941&h=764&f=png&s=63212)

可以看到，```toRefs``` 是在原有 ```Proxy``` 对象的基础上，返回了一个普通的带有 ```get``` 和 ```set``` 的对象。这样就解决了 ```Proxy``` 对象遇到解构和展开运算符后，失去引用的情况的问题。

## 总语

好了，对于 ```reactive API``` 的定义和大致的源码实现就如上面文章中描述的。而分支的逻辑，大家可以自行走不同的 ```case``` 去阅读。当然，需要说的是这次的源码只是**尝鲜版的**，不排除之后正式的会做诸多优化，但是主体肯定是保持不变的。