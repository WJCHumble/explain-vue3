# transform 优化 AST

熟悉 Vue 2.x 版本源码的同学应该都知道它的 `compile` 阶段是没有 `transform` 过程的处理。而 `transform` 恰恰是整个 Vue 3 提高 `VNode` 更新性能实现的基础。因为，在这个阶段，会对 `baseCompiler` 后生成的 AST Element 打上优化标识 `patchFlag`，以及 `isBlock` 的判断。

> 实际上 Vue 3 的 `transfrom` 并不是无米之炊，它本质上是 Vue 2.x `compiler` 阶段的 `optimize` 的升级版。

这里我们将对 AST Elment 的 `transform` 分为两类：

- 静态节点 `transform` 应用，即节点不含有插值、指令、props、动态样式的绑定等。
- 动态节点 `transform` 应用，即节点含有插值、指令、props、动态样式的绑定等。

## 静态节点 transform 应用

那么，首先是静态节点 `transform` 应用。对于上面我们说到的这个栗子，静态节点就是 `<div>hi vue3</div>`这部分。而它在没有进行 `transformText` 之前，它对应的 AST 会是这样：

```javascript
{
  children: [{
    content: "hi vue3"
    loc: {start: {…}, end: {…}, source: "hi vue3"}
    type: 2
  }]
  codegenNode: undefined
  isSelfClosing: false
  loc: {start: {…}, end: {…}, source: "<div>hi vue3</div>"}
  ns: 0
  props: []
  tag: "div"
  tagType: 0
  type: 1
}
```

可以看出，此时它的 `codegenNode` 是 `undefined`。而在 `transform` 阶段则会根据 AST 递归应用对应的 `plugin`，然后，创建对应 AST Element 的 `codegen` 对象。所以，此时我们会命中 `transformElement` 和 `transformText` 的逻辑。

**transformText**

`transformText` 顾名思义，它和**文本**相关。很显然，我们此时 AST Element 所属的类型就是 Text。那么，我们先来看一下 `transformText` 函数对应的伪代码：

```javascript
export const transformText: NodeTransform = (node, context) => {
  if (
    node.type === NodeTypes.ROOT ||
    node.type === NodeTypes.ELEMENT ||
    node.type === NodeTypes.FOR ||
    node.type === NodeTypes.IF_BRANCH
  ) {
    return () => {
      const children = node.children
      let currentContainer: CompoundExpressionNode | undefined = undefined
      let hasText = false

      for (let i = 0; i < children.length; i++) { // {1}
        const child = children[i]
        if (isText(child)) {
          hasText = true
          ...
        }
      }
      if (
        !hasText ||
        (children.length === 1 &&
          (node.type === NodeTypes.ROOT ||
            (node.type === NodeTypes.ELEMENT &&
              node.tagType === ElementTypes.ELEMENT)))
      ) { // {2}
        return
      }
      ...
    }
  }
}
```

可以看到，这里我们会命中 {2} 逻辑，即如果对于节点含有单一文本 `transformText` 并不需要进行额外的处理。该节点仍然和 Vue 2.x 版本一样，会交给 `runtime` 时的 `render` 函数处理。

> 至于 `transfromText` 真正发挥作用的场景是当存在 `<div>ab {a} {b}</div>` 情况时，它需要将两者放在一个单独的 AST Element（Compound Expression） 下。

**transformElement**

`transformElement` 是一个所有 AST Element 都会被执行的一个 `plugin`，它的核心是为 AST Element 生成最基础的 `codegen`属性。例如标识出对应 `patchFlag`，从而为生成 `VNode` 提供依据，即 `dynamicChildren`。

而对于静态节点，同样只是起到一个初始化它的 `codegenNode` 属性的作用。并且，从上面介绍的 `patchFlag` 的类型，我们可以知道它的 `patchFlag` 为默认值 `0`。所以，它的 `codegenNode` 属性值看起来会是这样：

```javascript
{
  children: {
    content: "hi vue3"
    loc: {start: {…}, end: {…}, source: "hi vue3"}
    type: 2
  }
  directives: undefined
  disableTracking: false
  dynamicProps: undefined
  isBlock: false
  loc: {start: {…}, end: {…}, source: "<div>hi vue3</div>"}
  patchFlag: undefined
  props: undefined
  tag: ""div""
  type: 13
}
```

## 动态节点 transform 应用

接下来是动态节点 `transform` 应用。这里，我们的动态节点是 `<div>{{msg}}</div>`。它在 `baseParse` 后对应的 AST 会是这样：

```javascript
{
  children: [
    {
      content: {type: 4, isStatic: false, isConstant: false, content: "msg", loc: {…}}
      loc: {start: {…}, end: {…}, source: "{{msg}}"}
      type: 5
    }
  ],
  codegenNode: undefined,
  isSelfClosing: false,
  loc: {start: {…}, end: {…}, source: "<div>{{msg}}</div>"},
  ns: 0,
  props: [],
  tag: "div",
  tagType: 0,
  type: 1
}
```

很显然 `{{msg}}` 也是文本，所以也会命中和 `hi vue3` 一样的 `transformText` 函数的逻辑。

> 这里就不对 `transformText` 做展开，因为表现和 `hi vue3` 一样。

**transformElements**

此时，对于插值文本，`transfromElements` 的价值就会体现出来了。而针对存在单一节点的插值文本，它会两件事：

- 标识 `patchFlag` 为 `1 /* TEXT */`，即动态的文本内容。
- 将插值文本对应的 AST Element 赋值给 `VNodeChildren`。

具体在源码中的表现会是这样（伪代码）：

```javascript
    ...
    if (node.children.length === 1 && vnodeTag !== TELEPORT) {
        const child = node.children[0]
        const type = child.type
        // check for dynamic text children
        const hasDynamicTextChild =
          type === NodeTypes.INTERPOLATION ||
          type === NodeTypes.COMPOUND_EXPRESSION
        if (hasDynamicTextChild && !getStaticType(child)) {
          patchFlag |= PatchFlags.TEXT
        }
        if (hasDynamicTextChild || type === 2 /* TEXT */) {
            vnodeChildren = child;
        }
    }
    if (patchFlag !== 0) {
      if (__DEV__) {
        ...
        // bitwise flags
        const flagNames = Object.keys(PatchFlagNames)
          .map(Number)
          .filter(n => n > 0 && patchFlag & n)
          .map(n => PatchFlagNames[n])
          .join(`, `)
        vnodePatchFlag = patchFlag + ` /* ${flagNames} */`
        ...
    }
    ...
    node.codegenNode = createVNodeCall(
      context,
      vnodeTag,
      vnodeProps,
      vnodeChildren,
      vnodePatchFlag,
      vnodeDynamicProps,
      vnodeDirectives,
      !!shouldUseBlock,
      false /* disableTracking */,
      node.loc
    )
```

可以看到，处理后的 `vnodePatchFlag` 和 `vnodeChildren` 是作为参数传入 `createVNodeCall`，而 `createVNode` 最终会将这些参数转化为 AST Element 上属性的值，例如 `children`、`patchFlag`。所以，`transformElement` 处理后，其生成对应的 `codegenNode` 属性值会是这样：

```javascript
{
  children: {
    type: 4,
    isStatic: false,
    isConstant: false,
    content: "msg",
    loc: {…}
  },
  directives: undefined,
  dynamicProps: undefined,
  isBlock: false,
  isForBlock: false,
  loc: {
    start: {…},
    end: {…},
    source: "<div>{{msg}}</div>"
  },
  patchFlag: "1 /* TEXT */",
  props: undefined,
  tag: ""div"",
  type: 13
}
```