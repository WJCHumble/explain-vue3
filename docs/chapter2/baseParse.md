# baseParse

`baseParse` 顾名思义起着**解析**的作用，它的表现和「Vue2.x」的 `parse` 相同，都是解析模板 `tempalte` 生成**原始 AST**。

假设，此时我们有一个这样的模板 `template`：

```javascript
<div>
  <div>hi vue3</div>
  <div>{{ msg }}</div>
</div>
```

那么，它在经过 `baseParse` 处理后生成的 AST 看起来会是这样：

```javascript
{
  cached: 0,
  children: [{…}],
  codegenNode: undefined,
  components: [],
  directives: [],
  helpers: [],
  hoists: [],
  imports: [],
  loc: {start: {…}, end: {…}, source: "<div><div>hi vue3</div><div>{{msg}}</div></div>"},
  temps: 0,
  type: 0
}
```

如果，了解过「Vue2.x」编译过程的同学应该对于上面这颗 `AST` 的大部分属性不会陌生。`AST` 的本质是通过用对象来描述「DSL」（特殊领域语言），例如：

- `children` 中存放的就是最外层 `div` 的后代。
- `loc` 则用来描述这个 AST Element 在整个字符串（`template`）中的位置信息。
- `type` 则是用于描述这个元素的类型（例如 5 为插值、2 为文本）等等。

并且，可以看到的是不同于「Vue2.x」的 AST，这里我们多了诸如 `helpers`、`codegenNode`、`hoists` 等属性。而，这些属性会在 `transform` 阶段进行相应地赋值，进而帮助 `generate` 阶段生成**更优的**可执行代码。
