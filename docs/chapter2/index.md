## 基本介绍

在 Vue3 中编译是由 `compiler-core` 这个 `package` 完成的，其顾名思义即核心的编译，它会做这么三件事：

- **baseParse**，对组件 `template` 进行词法分析，生成对应的抽象语法树 AST。
- **transfrom**（转化）AST，针对每一个 AST Element，进行不同的 transform 处理，例如 `v-on`、`slot`、`v-if`、纯文本元素等等。
- **generate**，根据转化后的 AST 来生成对应的可执行函数。

![](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/1c07934c57a14ff18e5139b0316936f1~tplv-k3u1fbpfcp-zoom-1.image)

而这三个过程主要是由 `baseCompiler` 负责来完成，它对应的伪代码会是这样：

**baseCompiler 函数**

```javascript
export function baseCompile(
  template: string | RootNode,
  options: CompilerOptions = {}
): CodegenResult {
  ...
  const ast = isString(template) ? baseParse(template, options) : template
  ...
  transform(
    ast,
    extend({}, options, {....})
  )

  return generate(
    ast,
    extend({}, options, {
      prefixIdentifiers
    })
  )
}
```

假设，我们此时有这么一个栗子，它的 `template` 会是这样：

```html
<div>
  <div>hi vue3</div>
  <div>{{msg}}</div>
</div>
```

其中 `msg` 是一个插值，对应的值为 `hello vue3`。而在 `compiler-core` 时，它的核心方法是 `baseCompiler`，它会通过调用 `baseParse` 函数来将这个 `template` 解析成 AST。

那么，我们这个栗子，它经过 `baseParse` 处理后生成对应的 AST 会是这样：

```javascript
{
  cached: 0
  children: [{…}]
  codegenNode: undefined
  components: []
  directives: []
  helpers: []
  hoists: []
  imports: []
  loc: {start: {…}, end: {…}, source: "<div><div>hi vue3</div><div>{{msg}}</div></div>"}
  temps: 0
  type: 0
}
```

> 这里先不展开 children 中的 AST Element，后面会一一涉及。

如果，了解过「Vue 2.x」编译过程的同学应该对于上面这颗 AST 的大部分属性不会陌生。 AST 的本质是通过用对象来描述 DSL（特殊领域语言），例如：

- `children` 中存放的就是最外层 `div` 的子代。
- `loc` 则用来描述这个 AST Element 在整个字符串（template）中的位置信息。
- `type` 则是用于描述这个元素的类型（例如 5 为插值、2 为文本）等等。

我想大家可能会有疑问的就是 `codegenNode`、`hoists` 这两个属性。而这两个属性也是「Vue 3」针对**更新性能**问题所添加的两个属性。对于前者 `codegenNode` 是用于描述该节点在 `generate` 的一些表现。对于后者 `hoists` 是用于**存储需要静态提升的节点**。

那么，对于 `codegenNode` 它又是怎么来的？从上面的 AST，可以看到它的 `codegenNode` 是 `undefined`，也就是在 `parse` 阶段，并不会处理生成 `codegen`。

而真正处理生成 AST Element 对应的 `codegenNode` 是在 `transform` 阶段完成。在这个阶段，它会执行很多 `transform` 函数，对于我们这个栗子，会命中两个比较特殊的 `transform` 函数，它分别是：`transformText`、`transformElement`。