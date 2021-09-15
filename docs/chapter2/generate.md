# generate

`generate` 是 `compile` 阶段的最后一步，它的作用是将 `transform` 转换后的 AST 生成对应的**可执行代码**，从而在之后 Runtime 的 Render 阶段时，就可以通过可执行代码生成对应的 VNode Tree，然后最终映射为真实的 DOM Tree 在页面上。

同样地，这一阶段在「Vue2.x」也是由 `generate` 函数完成，它会生成是诸如 `_l`、`_c` 之类的函数，这本质上是对 `_createElement` 函数的封装。而相比较「Vue2.x」版本的 `generate`，「Vue3」改变了很多，其 `generate` 函数对于的伪代码会是这样：

```javascript
export function generate(
  ast: RootNode,
  options: CodegenOptions & {
    onContextCreated?: (context: CodegenContext) => void
  } = {}
): CodegenResult {
  const context = createCodegenContext(ast, options)
  if (options.onContextCreated) options.onContextCreated(context)
  const {
    mode,
    push,
    prefixIdentifiers,
    indent,
    deindent,
    newline,
    scopeId,
    ssr
  } = context
  ...
  genFunctionPreamble(ast, context)
  ...

  if (!ssr) {
    ...
    push(`function render(_ctx, _cache${optimizeSources}) {`)
  }
  ....

  return {
    ast,
    code: context.code,
    // SourceMapGenerator does have toJSON() method but it's not in the types
    map: context.map ? (context.map as any).toJSON() : undefined
  }
}
```

所以，接下来，我们就来**一睹**带有静态节点对应的 AST 生成的可执行代码的过程会是怎样。

## CodegenContext

从上面 `generate` 函数的伪代码可以看到，在函数的开始调用了 `createCodegenContext` 为当前 AST 生成了一个 `context`。在整个 `generate` 函数的执行过程**都依托**于一个 `CodegenContext` **生成代码上下文**（对象）的能力，它是通过 `createCodegenContext` 函数生成。而 `CodegenContext` 的接口定义会是这样：

```javascript
interface CodegenContext
  extends Omit<Required<CodegenOptions>, 'bindingMetadata'> {
  source: string
  code: string
  line: number
  column: number
  offset: number
  indentLevel: number
  pure: boolean
  map?: SourceMapGenerator
  helper(key: symbol): string
  push(code: string, node?: CodegenNode): void
  indent(): void
  deindent(withoutNewLine?: boolean): void
  newline(): void
}
```

可以看到 `CodegenContext` 对象中有诸如 `push`、`indent`、`newline` 之类的方法。而它们的作用是在根据 AST 来生成代码时用来**实现换行**、**添加代码**、**缩进**等功能。从而，最终形成一个个可执行代码，即我们所认知的 `render` 函数，并且，它会作为 `CodegenContext` 的 `code` 属性的值返回。

下面，我们就来看下静态节点的可执行代码生成的核心，它被称为 `Preamble` 前导。

## genFunctionPreamble

整个静态提升的可执行代码生成就是在 `genFunctionPreamble` 函数部分完成的。并且，大家仔细**斟酌**一番静态提升的字眼，静态二字我们可以不看，但是**提升二字**，直抒本意地表达出它（静态节点）被**提高了**。

为什么说是提高了？因为在源码中的体现，确实是被提高了。在前面的 `generate` 函数，我们可以看到 `genFunctionPreamble` 是先于 `render` 函数加入 `context.code` 中，所以，在 Runtime 阶段的 Render，它会先于 `render` 函数执行。

`geneFunctionPreamble` 函数（伪代码）：

```javascript
function genFunctionPreamble(ast: RootNode, context: CodegenContext) {
  const {
    ssr,
    prefixIdentifiers,
    push,
    newline,
    runtimeModuleName,
    runtimeGlobalName
  } = context
  ...
  const aliasHelper = (s: symbol) => `${helperNameMap[s]}: _${helperNameMap[s]}`
  if (ast.helpers.length > 0) {
    ...
    if (ast.hoists.length) {
      const staticHelpers = [
        CREATE_VNODE,
        CREATE_COMMENT,
        CREATE_TEXT,
        CREATE_STATIC
       ]
        .filter(helper => ast.helpers.includes(helper))
        .map(aliasHelper)
        .join(', ')
      push(`const { ${staticHelpers} } = _Vue\n`)
    }
  }
  ...
  genHoists(ast.hoists, context)
  newline()
  push(`return `)
}
```

可以看到，这里会对前面我们在 `transform` 函数提及的 `hoists` 属性的长度进行判断。显然，对于前面说的这个栗子，它的 `ast.hoists.length` 长度是大于 0 的。所以，这里就会根据 `hoists` 中的 AST 生成对应的可执行代码。因此，到这里，生成的可执行代码会是这样：

```javascript
const _Vue = Vue;
const { createVNode: _createVNode } = _Vue;
// 静态提升部分
const _hoisted_1 = _createVNode("div", null, "hi vue3", -1 /* HOISTED */);
// render 函数会在这下面
export function render() => render(_ctx, _cache, $props, $setup, $data, $options) {
	return (_openBlock(), _createElementBlock(_Fragment, null, [
    _hoisted_1,
    _createElementVNode("div", null, _toDisplayString(msg))
  ], 64 /* STABLE_FRAGMENT */)
	)
}
```

## 总结
