# Style CSS Variable Injection

Style CSS Variable Injection，即 `<style>` 动态变量注入，根据 [SFC](https://github.com/vuejs/rfcs/pull/231 "SFC") 上尤大的总结，它主要有以下 5 点能力：

- 不需要明确声明某个属性被注入作为 CSS 变量（会根据 CSS 中的 `v-bind()` 推断）
- 响应式的变量
- 在 Scoped/Non-scoped 模式下具备不同的表现
- 不会污染子组件
- 普通的 CSS 变量的使用不会被影响

下面，我们来看一个简单使用 `<style>` 动态变量注入的例子：

```html
<template>
  <p class="word">{{ msg }}</p>
  <button @click="changeColor">click me</button>
</template>

<script setup>
  import { ref } from "vue";

  const msg = "Hello World!";
  let color = ref("red");
  const changeColor = () => {
    if (color.value === "black") {
      color.value = "red";
    } else {
      color.value = "black";
    }
  };
</script>

<style scoped>
  .word {
    background: v-bind(color);
  }
</style>
```

对应的渲染到页面上：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e63f43156beb4b84bd0471e4022ffb2d~tplv-k3u1fbpfcp-zoom-1.image)

从上面的代码片段，很容易得知当我们点击 `click me` 按钮，文字的背景色就会发生变化：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/4fee3319096d4b778a205f03fd815e63~tplv-k3u1fbpfcp-zoom-1.image)

而这就是 `<style>` 动态变量注入赋予我们的能力，让我们**很便捷地**通过 `<script>` 中的变量来操作 `<template>` 中的 HTML 元素**样式的动态改变**。

那么，这个过程又发生了什么？怎么实现的？有疑问是件好事，接着让我们来一步步揭开其幕后的实现原理。

## SFC 编译过程处理

SFC 在编译过程对 `<style>` 动态变量注入的处理实现，主要是基于的 **2 个关键点**。这里，我们以上面的例子作为示例分析：

- 在对应 DOM 上绑定行内 `style`，通过 [`CSS var()`](<https://developer.mozilla.org/zh-CN/docs/Web/CSS/var( "`CSS var()`")>) 在 CSS 中使用在行内 `style` 上定义的**自定义属性**，对应的 HTML 部分：
  ![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/aa711b8dbf8d471a8b4207920b4f0886~tplv-k3u1fbpfcp-zoom-1.image)
  CSS 部分:
  ![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/f98267f2168e4316b5ad78add7d2d6d3~tplv-k3u1fbpfcp-zoom-1.image)
- 通过**动态更新** `color` 变量来实现行内 `style` 属性值的变化，进而改变使用了该 CSS 自定义属性的 HTML 元素样式

那么，显然要完成这一整个过程，不同于在没有 `<style>` 动态变量注入前的 SFC 编译，这里需要对 `<style>`、`<script>` 增加相应的**特殊处理**。下面，我们分 2 点来讲解：

**1.SFC 编译 `<style>` 相关处理**

大家都知道的是在 Vue SFC 的 `<style>` 部分编译主要是由 `postcss` 完成的。而这在 Vue 源码中对应着 `packages/compiler-sfc/sfc/compileStyle.ts` 中的 `doCompileStyle()` 方法。

这里，我们看一下其针对 `<style>` 动态变量注入的编译处理，对应的代码（伪代码）：

```typescript
// packages/compiler-sfc/sfc/compileStyle.ts
export function doCompileStyle(
  options: SFCAsyncStyleCompileOptions
): SFCStyleCompileResults | Promise<SFCStyleCompileResults> {
  const {
    ...
    id,
    ...
  } = options
  ...
  const plugins = (postcssPlugins || []).slice()
  plugins.unshift(cssVarsPlugin({ id: shortId, isProd }))
  ...
}
```

可以看到，在使用 `postcss` 编译 `<style>` 之前会加入 `cssVarsPlugin` 插件，并给 `cssVarsPlugin` 传入 `shortId`（即 `scopedId` 替换掉 `data-v` 后的结果）和 `isProd`（是否处于生产环境）。

`cssVarsPlugin` 则是使用了 `postcss` 插件提供的 [`Declaration` 方法](https://github.com/postcss/postcss/blob/main/docs/writing-a-plugin.md#step-3-find-nodes "`Declaration` 方法")，来访问 `<style>` 中声明的所有 CSS 属性的值，每次访问通过正则来匹配 `v-bind` 指令的内容，然后再使用 `replace()` 方法将该属性值替换为 `var(--xxxx-xx)`，表现在上面这个例子会是这样：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/c37482606930435bb5f9f8eee340c2a2~tplv-k3u1fbpfcp-zoom-1.image)

`cssVarsPlugin` 插件的定义：

```typescript
// packages/compiler-sfc/sfc/cssVars.ts
const cssVarRE = /\bv-bind\(\s*(?:'([^']+)'|"([^"]+)"|([^'"][^)]*))\s*\)/g;
const cssVarsPlugin: PluginCreator<CssVarsPluginOptions> = (opts) => {
  const { id, isProd } = opts!;
  return {
    postcssPlugin: "vue-sfc-vars",
    Declaration(decl) {
      // rewrite CSS variables
      if (cssVarRE.test(decl.value)) {
        decl.value = decl.value.replace(cssVarRE, (_, $1, $2, $3) => {
          return `var(--${genVarName(id, $1 || $2 || $3, isProd)})`;
        });
      }
    },
  };
};
```

这里 CSS `var()` 的变量名即 `--`（之后的内容）是由 `genVarName()` 方法生成，它会根据 `isProd` 为 `true` 或 `false` 生成不同的值：

```javascript
// packages/compiler-sfc/sfc/cssVars.ts
function genVarName(id: string, raw: string, isProd: boolean): string {
  if (isProd) {
    return hash(id + raw);
  } else {
    return `${id}-${raw.replace(/([^\w-])/g, "_")}`;
  }
}
```

**2.SFC 编译 `<script>` 相关处理**

如果，仅仅站在 `<script>` 的角度，显然是**无法感知**当前 SFC 是否使用了 `<style>` 动态变量注入。所以，需要从 SFC 出发来标识当前是否使用了 `<style>` 动态变量注入。

在 `packages/compiler-sfc/parse.ts` 中的 `parse` 方法中会对解析 SFC 得到的 `descriptor` 对象调用 `parseCssVars()` 方法来获取 `<style>` 中使用到 `v-bind` 的所有变量。

> `descriptor` 指的是解析 SFC 后得到的包含 `script`、`style`、`template` 属性的对象，每个属性包含了 SFC 中每个块（Block）的信息，例如 `<style>` 的属性 `scoped` 和内容等。

对应的 `parse()` 方法中部分代码（伪代码）：

```javascript
// packages/compiler-sfc/parse.ts
function parse(
  source: string,
  {
    sourceMap = true,
    filename = "anonymous.vue",
    sourceRoot = "",
    pad = false,
    compiler = CompilerDOM,
  }: SFCParseOptions = {}
): SFCParseResult {
  //...
  descriptor.cssVars = parseCssVars(descriptor);
  if (descriptor.cssVars.length) {
    warnExperimental(`v-bind() CSS variable injection`, 231);
  }
  //...
}
```

可以看到，这里会将 `parseCssVars()` 方法返回的结果（数组）赋值给 `descriptor.cssVars`。然后，在编译 `script` 的时候，根据 `descriptor.cssVars.length` 判断是否注入 `<style>` 动态变量注入相关的代码。

而编译 `script` 是由 `package/compile-sfc/src/compileScript.ts` 中的 `compileScript` 方法完成，这里我们看一下其针对 `<style>` 动态变量注入的处理：

```javascript
// package/compile-sfc/src/compileScript.ts
export function compileScript(
  sfc: SFCDescriptor,
  options: SFCScriptCompileOptions
): SFCScriptBlock {
  //...
  const cssVars = sfc.cssVars;
  //...
  const needRewrite = cssVars.length || hasInheritAttrsFlag;
  let content = script.content;
  if (needRewrite) {
    //...
    if (cssVars.length) {
      content += genNormalScriptCssVarsCode(
        cssVars,
        bindings,
        scopeId,
        !!options.isProd
      );
    }
  }
  //...
}
```

对于前面我们举的例子（使用了 `<style>` 动态变量注入），显然 `cssVars.length` 是存在的，所以这里会调用 `genNormalScriptCssVarsCode()` 方法来生成对应的代码。

`genNormalScriptCssVarsCode()` 的定义：

```javascript
// package/compile-sfc/src/cssVars.ts
const CSS_VARS_HELPER = `useCssVars`;
function genNormalScriptCssVarsCode(
  cssVars: string[],
  bindings: BindingMetadata,
  id: string,
  isProd: boolean
): string {
  return (
    `\nimport { ${CSS_VARS_HELPER} as _${CSS_VARS_HELPER} } from 'vue'\n` +
    `const __injectCSSVars__ = () => {\n${genCssVarsCode(
      cssVars,
      bindings,
      id,
      isProd
    )}}\n` +
    `const __setup__ = __default__.setup\n` +
    `__default__.setup = __setup__\n` +
    `  ? (props, ctx) => { __injectCSSVars__();return __setup__(props, ctx) }\n` +
    `  : __injectCSSVars__\n`
  );
}
```

`genNormalScriptCssVarsCode()` 方法主要做了这 3 件事：

- 引入 `useCssVars()` 方法，其主要是监听 `watchEffect` 动态注入的变量，然后再更新对应的 CSS `Vars()` 的值
- 定义 `__injectCSSVars__` 方法，其主要是调用了 `genCssVarsCode()` 方法来生成 `<style>` 动态样式相关的代码
- 兼容非 `<script setup>` 情况下的组合 API 使用（对应这里 `__setup__`），如果它存在则重写 `__default__.setup` 为 `(props, ctx) => { __injectCSSVars__();return __setup__(props, ctx) }`

那么，到这里我们就已经大致分析完 SFC 编译对 `<style>` 动态变量注入的处理，其中部分逻辑并没有过多展开讲解（避免陷入套娃的情况），有兴趣的同学可以自行了解。下面，我们就针对前面这个例子，看一下 SFC 编译结果会是什么？

## SFC 编译结果分析

这里，我们直接通过 Vue 官方的 [SFC Playground](https://sfc.vuejs.org/#eyJBcHAudnVlIjoiPHRlbXBsYXRlPlxuICA8aDE+e3sgbXNnIH19PC9oMT5cbjwvdGVtcGxhdGU+XG5cbjxzY3JpcHQgc2V0dXA+XG5jb25zdCBtc2cgPSAnSGVsbG8gV29ybGQhJ1xuPC9zY3JpcHQ+In0= "SFC Playground") 来查看上面这个例子经过 **SFC 编译**后输出的代码：

```javascript
import { useCssVars as _useCssVars, unref as _unref } from "vue";
import {
  toDisplayString as _toDisplayString,
  createVNode as _createVNode,
  Fragment as _Fragment,
  openBlock as _openBlock,
  createBlock as _createBlock,
  withScopeId as _withScopeId,
} from "vue";
const _withId = /*#__PURE__*/ _withScopeId("data-v-f13b4d11");

import { ref } from "vue";

const __sfc__ = {
  expose: [],
  setup(__props) {
    _useCssVars((_ctx) => ({
      "f13b4d11-color": _unref(color),
    }));

    const msg = "Hello World!";
    let color = ref("red");
    const changeColor = () => {
      if (color.value === "black") {
        color.value = "red";
      } else {
        color.value = "black";
      }
    };

    return (_ctx, _cache) => {
      return (
        _openBlock(),
        _createBlock(
          _Fragment,
          null,
          [
            _createVNode("p", { class: "word" }, _toDisplayString(msg)),
            _createVNode("button", { onClick: changeColor }, " click me "),
          ],
          64 /* STABLE_FRAGMENT */
        )
      );
    };
  },
};
__sfc__.__scopeId = "data-v-f13b4d11";
__sfc__.__file = "App.vue";
export default __sfc__;
```

可以看到 SFC 编译的结果，输出了单文件对象 `__sfc__`、`render` 函数、`<style>` 动态变量注入等相关的代码。那么抛开前两者，我们直接看 `<style>` 动态变量注入相关的代码：

```javascript
_useCssVars((_ctx) => ({
  "f13b4d11-color": _unref(color),
}));
```

这里调用了 `_useCssVars()` 方法，即在源码中指的是 `useCssVars()` 方法，然后传入了一个函数，该函数会返回一个对象 `{ "f13b4d11-color": (_unref(color)) }`。那么，下面我们来看一下 `useCssVars()` 方法。

### useCssVars

`useCssVars()` 方法是定义在 `runtime-dom/src/helpers/useCssVars.ts` 中：

```javascript
// runtime-dom/src/helpers/useCssVars.ts
function useCssVars(getter: (ctx: any) => Record<string, string>) {
  if (!__BROWSER__ && !__TEST__) return

  const instance = getCurrentInstance()
  if (!instance) {
    __DEV__ &&
      warn(`useCssVars is called without current active component instance.`)
    return
  }

  const setVars = () =>
    setVarsOnVNode(instance.subTree, getter(instance.proxy!))
  onMounted(() => watchEffect(setVars, { flush: 'post' }))
  onUpdated(setVars)
}
```

`useCssVars` 主要做了这 4 件事：

- 获取当前组件实例 `instance`，用于后续操作组件实例的 VNode Tree，即 `instance.subTree`
- 定义 `setVars()` 方法，它会调用 `setVarsOnVNode()` 方法，并将 `instance.subTree`、接收到的 `getter()` 方法传入
- 在 `onMounted()` 生命周期中添加 `watchEffect`，每次挂载组件的时候都会调用 `setVars()` 方法
- 在 `onUpdated()` 生命周期中添加 `setVars()` 方法，每次组件更新的时候都会调用 `setVars()` 方法

可以看到，无论是 `onMounted()` 或者 `onUpdated()` 生命周期，它们都会调用 `setVars()` 方法，本质上也就是 `setVarsOnVNode()` 方法，我们先来看一下它的定义：

```javascript
// packages/runtime-dom/src/helpers/useCssVars.ts
function setVarsOnVNode(vnode: VNode, vars: Record<string, string>) {
  if (__FEATURE_SUSPENSE__ && vnode.shapeFlag & ShapeFlags.SUSPENSE) {
    const suspense = vnode.suspense!
    vnode = suspense.activeBranch!
    if (suspense.pendingBranch && !suspense.isHydrating) {
      suspense.effects.push(() => {
        setVarsOnVNode(suspense.activeBranch!, vars)
      })
    }
  }

  while (vnode.component) {
    vnode = vnode.component.subTree
  }

  if (vnode.shapeFlag & ShapeFlags.ELEMENT && vnode.el) {
    const style = vnode.el.style
    for (const key in vars) {
      style.setProperty(`--${key}`, vars[key])
    }
  } else if (vnode.type === Fragment) {
    ;(vnode.children as VNode[]).forEach(c => setVarsOnVNode(c, vars))
  }
}
```

对于前面我们这个例子，由于初始传入的是 `instance.subtree`，它的 `type` 为 `Fragment`。所以，在 `setVarsOnVNode()` 方法中会命中 `vnode.type === Fragment` 的逻辑，然后遍历 `vnode.children` 递归调用 `setVarsOnVNode()` 方法。

> 这里不对 `__FEATURE_SUSPENSE__` 和 `vnode.component` 情况做展开分析，有兴趣的同学可以自行了解

而在后续的 `setVarsOnVNode()` 方法的执行，如果满足 `vnode.shapeFlag & ShapeFlags.ELEMENT && vnode.el` 的逻辑，则会调用 `style.setProperty()` 方法来给每个 VNode 对应的 DOM（`vnode.el`）添加行内的 `style`，其中 `key` 是先前处理 `<style>` 时 `CSS var()` 的值，`value` 则对应着 `<script>` 中定义的变量的值。

这样一来，就完成了整个从 `<script>` 中的变量变化到 `<style>` 中样式变化的联动。这里我们用一张图简单回顾一下这个过程：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/d35a4dba22e74eb3a00d69385b49bd4c~tplv-k3u1fbpfcp-zoom-1.image)

## 总结

如果，简单地概括 `<style>` 动态变量注入的话，可能几句话就可以表达。但是，其在源码层面又是怎么做的？这是很值得深入了解的，通过这我们可以懂得如何编写 `postcss` 插件、CSS `vars()` 是什么等技术点。

并且，原本打算留有一个小节用于介绍如何手写一个 Vite 插件 [vite-plugin-vue2-css-vars](https://www.npmjs.com/package/vite-plugin-vue2-css-vars "vite-plugin-vue2-css-vars")，让 Vue 2.x 也可以支持 `<style>` 动态变量注入。但是，考虑到文章篇幅太长可能会给大家造成阅读上的障碍。所以，这会在下一篇文章中介绍，不过目前这个插件已经发到 NPM 上了，有兴趣的同学也可以自行了解。
