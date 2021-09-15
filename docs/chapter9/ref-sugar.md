## Ref 语法糖在项目中的使用

由于 `ref` 语法糖目前还处于实验性的（Experimental）阶段，所以在 Vue3 中不会默认支持 `ref` 语法糖。那么，这里我们以使用 Vite + Vue3 项目开发为例，看一下如何开启对 `ref` 语法糖的支持。

在使用 Vite + Vue3 项目开发时，是由 `@vitejs/plugin-vue` 插件来实现对 `.vue` 文件的代码转换（Transform）、热更新（HMR）等。所以，我们需要在 `vite.config.js` 中给 `@vitejs/plugin-vue` 插件的选项（Options）传入 `refTransform: true`：

```javascript
// vite.config.js
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [
    vue({
      refTransform: true,
    }),
  ],
});
```

那么，这样一来 `@vitejs/plugin-vue` 插件内部会根据传入的选项中 `refTransform` 的值判断是否需要对 `ref` 语法糖进行特定的代码转换。由于，这里我们设置的是 `true`，显然它是会对 `ref` 语法糖执行特定的代码转换。

接着，我们就可以在 `.vue` 文件中使用 `ref` 语法糖，这里我们看一个简单的例子：

```html
<template>
  <div>{{count}}</div>
  <button @click="add">click me</button>
</template>

<script setup>
  let count = $ref(1);

  function add() {
    count++;
  }
</script>
```

对应渲染到页面上：

![](https://wuzhiwei.oss-cn-beijing.aliyuncs.com/Blog/vue3/%E6%88%AA%E5%B1%8F2021-09-11%20%E4%B8%8B%E5%8D%886.28.50.png)

可以看到，我们可以使用 `ref` 语法糖的方式创建响应式的变量，而不用思考使用的时候要加 `.value` 的问题。此外，`ref` 语法糖还支持其他的写法，个人比较推荐的是这里介绍的 `$ref` 的方式，有兴趣的同学可以去 RFC 上了解其他的写法。

那么，在了解完 `ref` 语法糖在项目中的使用后，我们算是解答了第一个疑问（怎么在项目中使用）。下面，我们来解答第二个疑问，它又是怎么实现的，也就是在源码中做了哪些处理？

## Ref 语法糖的实现

首先，我们通过 [Vue Playground](https://sfc.vuejs.org/#eyJBcHAudnVlIjoiXG48dGVtcGxhdGU+XG5cdDxkaXY+e3tjb3VudH19PC9kaXY+XG5cdDxidXR0b24gQGNsaWNrPVwiYWRkXCI+Y2xpY2sgbWU8L2J1dHRvbj5cbjwvdGVtcGxhdGU+XG5cbjxzY3JpcHQgc2V0dXA+XG5sZXQgY291bnQgPSAkcmVmKDEpXG5cbmZ1bmN0aW9uIGFkZCgpIHtcblx0Y291bnQrK1xufVxuPC9zY3JpcHQ+In0=) 来直观地感受一下，前面使用 `ref` 语法糖的例子中的 `<script setup>` 块（Block）在编译后的结果：

```javascript
import { ref as _ref } from 'vue'

const __sfc__ = {
  setup(__props) {
  let count = _ref(1)

  function add() {
    count.value++
  }
}
```

可以看到，虽然我们在使用 `ref` 语法糖的时候不需要处理 `.value`，但是它经过编译后**仍然是使用的 `.value`**。那么，这个过程肯定不难免要做很多**编译相关**的代码转换处理。因为，我们需要找到使用 `$ref` 的声明语句和变量，给前者重写为 `_ref`，给后者添加 `.value`。

而在前面，我们也提及 `@vitejs/plugin-vue` 插件会对 `.vue` 文件进行代码的转换，这个过程则是使用的 Vue3 提供的 `@vue/compiler-sfc` 包（Package），它分别提供了对 `<script>`、`<template>`、`<style>` 等块的编译相关的函数。

那么，显然这里我们需要关注的是 `<script>` 块编译相关的函数，这对应的是 `@vue/compiler-sfc` 中的 `compileScript()` 函数。

### compileScript() 函数

`compileScript()` 函数定义在 `vue-next` 的 `packages/compiler-sfc/src/compileScript.ts` 文件中，它主要负责对 `<script>` 或 `<script setup>` 块内容的编译处理，它会接收 2 个参数：

- `sfc` 包含 `.vue` 文件的代码被解析后的内容，包含 `script`、`scriptSetup`、`source` 等属性
- `options` 包含一些可选和必须的属性，例如组件对应的 `scopeId` 会作为 `options.id`、前面提及的 `refTransform` 等

`compileScript()` 函数的定义（伪代码）：

```javascript
// packages/compiler-sfc/src/compileScript.ts
export function compileScript(
  sfc: SFCDescriptor,
  options: SFCScriptCompileOptions
): SFCScriptBlock {
  // ...
  return {
    ...script,
    content,
    map,
    bindings,
    scriptAst: scriptAst.body,
  };
}
```

对于 `ref` 语法糖而言，`compileScript()` 函数首先会获取选项（Option）中 `refTransform` 的值，并赋值给 `enableRefTransform`：

```javascript
const enableRefTransform = !!options.refTransform;
```

`enableRefTransform` 则会用于之后判断是否要调用 `ref` 语法糖相关的转换函数。那么，前面我们也提及要使用 `ref` 语法糖，需要先给 `@vite/plugin-vue` 插件选项的 `refTransform` 属性设置为 `true`，它会被传入 `compileScript()` 函数的 `options`，也就是这里的 `options.refTransform`。

接着，会从 `sfc` 中解构出 `scriptSetup`、`source`、`filename` 等属性。其中，会先用源文件的代码字符串 `source` 创建一个 `MagicString` 实例 `s`，它主要会用于后续代码转换时**对源代码字符串进行替换、添加等操作**，然后会调用 `parse()` 函数来解析 `<script setup>` 的内容，即 `scriptSetup.content`，从而生成对应的抽象语法树 `scriptSetupAst`：

```javascript
let { script, scriptSetup, source, filename } = sfc;
const s = new MagicString(source);
const startOffset = scriptSetup.loc.start.offset;
const scriptSetupAst = parse(
  scriptSetup.content,
  {
    plugins: [...plugins, "topLevelAwait"],
    sourceType: "module",
  },
  startOffset
);
```

而 `parse()` 函数内部则是使用的 `@babel/parser` 提供的 `parser` 方法进行代码的解析并生成对应的 AST。对于上面我们这个例子，生成的 AST 会是这样：

```javascript
{
  body: [ {...}, {...} ],
  directives: [],
  end: 50,
  interpreter: null,
  loc: {
    start: {...},
    end: {...},
    filename: undefined,
    identifierName: undefined
  },
  sourceType: 'module',
  start: 0,
  type: 'Program'
}
```

> 注意，这里省略了 `body`、`start`、`end` 中的内容

然后，会根据前面定义的 `enableRefTransform` 和调用 `shouldTransformRef()` 函数的返回值（`true` 或 `false`）来判断是否进行 `ref` 语法糖的代码转换。如果，需要进行相应的转换，则会调用 `transformRefAST()` 函数来根据 AST 来进行相应的代码转换操作：

```javascript
if (enableRefTransform && shouldTransformRef(scriptSetup.content)) {
  const { rootVars, importedHelpers } = transformRefAST(
    scriptSetupAst,
    s,
    startOffset,
    refBindings
  );
}
```

在前面，我们已经介绍过了 `enableRefTransform`。这里我们来看一下 `shouldTransformRef()` 函数，它主要是通过正则匹配代码内容 `scriptSetup.content` 来判断是否使用了 `ref` 语法糖：

```javascript
// packages/ref-transform/src/refTransform.ts
const transformCheckRE = /[^\w]\$(?:\$|ref|computed|shallowRef)?\(/;

export function shouldTransform(src: string): boolean {
  return transformCheckRE.test(src);
}
```

所以，当你指定了 `refTransform` 为 `true`，但是你代码中实际并没有使用到 `ref` 语法糖，则在编译 `<script>` 或 `<script setup>` 的过程中也**不会执行**和 `ref` 语法糖相关的代码转换操作，这也是 Vue3 考虑比较细致的地方，避免了不必要的代码转换操作带来性能上的开销。

那么，对于我们这个例子而言（使用了 `ref` 语法糖），则会命中上面的 `transformRefAST()` 函数。而 `transformRefAST()` 函数则对应的是 `packages/ref-transform/src/refTransform.ts` 中的 `transformAST()` 函数。

所以，下面我们来看一下 `transformAST()` 函数是如何根据 AST 来对 `ref` 语法糖相关代码进行转换操作的。

### transformAST() 函数

在 `transformAST()` 函数中主要是会遍历传入的原代码对应的 AST，然后通过操作源代码字符串生成的 `MagicString` 实例 `s` 来对源代码进行特定的转换，例如重写 `$ref` 为 `_ref`、添加 `.value` 等。

`transformAST()` 函数的定义（伪代码）：

```javascript
// packages/ref-transform/src/refTransform.ts
export function transformAST(
  ast: Program,
  s: MagicString,
  offset: number = 0,
  knownRootVars?: string[]
): {
  // ...
  walkScope(ast)
  (walk as any)(ast, {
    enter(node: Node, parent?: Node) {
      if (
        node.type === 'Identifier' &&
        isReferencedIdentifier(node, parent!, parentStack) &&
        !excludedIds.has(node)
      ) {
        let i = scopeStack.length
        while (i--) {
          if (checkRefId(scopeStack[i], node, parent!, parentStack)) {
            return
          }
        }
      }
    }
  })

  return {
    rootVars: Object.keys(rootScope).filter(key => rootScope[key]),
    importedHelpers: [...importedHelpers]
  }
}
```

可以看到 `transformAST()` 会先调用 `walkScope()` 来处理根作用域（`root scope`），然后调用 `walk()` 函数逐层地处理 AST 节点，而这里的 `walk()` 函数则是使用的 Rich Haris 写的 `estree-walker`。

下面，我们来分别看一下 `walkScope()` 和 `walk()` 函数做了什么。

#### walkScope() 函数

首先，这里我们先来看一下前面使用 `ref` 语法糖的声明语句 `let count = $ref(1)` 对应的 AST 结构：

<img src="https://wuzhiwei.oss-cn-beijing.aliyuncs.com/Blog/vue3/%E6%88%AA%E5%B1%8F2021-09-11%20%E4%B8%8A%E5%8D%8810.14.15.png" height="500" />

可以看到 `let` 的 AST 节点类型 `type` 会是 `VariableDeclaration`，其余的代码部分对应的 AST 节点则会被放在 `declarations` 中。其中，变量 `count` 的 AST 节点会被作为 `declarations.id` ，而 `$ref(1)` 的 AST 节点会被作为 `declarations.init`。

那么，回到 `walkScope()` 函数，它会根据 AST 节点的类型 `type` 进行特定的处理，对于我们这个例子 `let` 对应的 AST 节点 `type` 为 `VariableDeclaration` 会命中这样的逻辑：

```javascript
function walkScope(node: Program | BlockStatement) {
  for (const stmt of node.body) {
    if (stmt.type === 'VariableDeclaration') {
      for (const decl of stmt.declarations) {
        let toVarCall
        if (
          decl.init &&
          decl.init.type === 'CallExpression' &&
          decl.init.callee.type === 'Identifier' &&
          (toVarCall = isToVarCall(decl.init.callee.name))
        ) {
          processRefDeclaration(
            toVarCall,
            decl.init as CallExpression,
            decl.id,
            stmt
          )
        }
      }
    }
  }
}
```

这里的 `stmt` 则是 `let` 对应的 AST 节点，然后会遍历 `stmt.declarations`，其中 `decl.init.callee.name` 指的是 `$ref`，接着是调用 `isToVarCall()` 函数并赋值给 `toVarCall`。

`isToVarCall()` 函数的定义：

```javascript
// packages/ref-transform/src/refTransform.ts
const TO_VAR_SYMBOL = "$";
const shorthands = ["ref", "computed", "shallowRef"];
function isToVarCall(callee: string): string | false {
  if (callee === TO_VAR_SYMBOL) {
    return TO_VAR_SYMBOL;
  }
  if (callee[0] === TO_VAR_SYMBOL && shorthands.includes(callee.slice(1))) {
    return callee;
  }
  return false;
}
```

在前面我们也提及 `ref` 语法糖可以支持其他写法，由于我们使用的是 `$ref` 的方式，所以这里会命中 `callee[0] === TO_VAR_SYMBOL && shorthands.includes(callee.slice(1))` 的逻辑，即 `toVarCall` 会被赋值为 `$ref`。

然后，会调用 `processRefDeclaration()` 函数，它会根据传入的 `decl.init` **提供的位置信息**来对源代码对应的 `MagicString` 实例 `s` 进行操作，即将 `$ref` 重写为 `ref`：

```javascript
// packages/ref-transform/src/refTransform.ts
function processRefDeclaration(
    method: string,
    call: CallExpression,
    id: VariableDeclarator['id'],
    statement: VariableDeclaration
) {
  // ...
  if (id.type === 'Identifier') {
    registerRefBinding(id)
    s.overwrite(
      call.start! + offset,
      call.start! + method.length + offset,
      helper(method.slice(1))
    )
  }
  // ...
}
```

> 位置信息指的是该 AST 节点在源代码中的位置，通常会用 `start`、`end` 表示，例如这里的 `let count = $ref(1)`，那么 `count` 对应的 AST 节点的 `start` 会是 4、`end` 会是 9。

因为，此时传入的 `id` 对应的是 `count` 的 AST 节点，它会是这样：

```javascript
{
  type: "Identifier",
  start: 4,
  end: 9,
  name: "count"
}
```

所以，这会命中上面的 `id.type === 'Identifier'` 的逻辑。首先，会调用 `registerRefBinding()` 函数，它实际上是调用的是 `registerBinding()`，而 `registerBinding` 会在**当前作用域** `currentScope` 上绑定该变量 `id.name` 并设置为 `true` ，它表示这是一个用 `ref` 语法糖创建的变量，这会用于后续判断是否给某个变量添加 `.value`：

```javascript
const registerRefBinding = (id: Identifier) => registerBinding(id, true);
function registerBinding(id: Identifier, isRef = false) {
  excludedIds.add(id);
  if (currentScope) {
    currentScope[id.name] = isRef;
  } else {
    error(
      "registerBinding called without active scope, something is wrong.",
      id
    );
  }
}
```

可以看到，在 `registerBinding()` 中还会给 `excludedIds` 中添加该 AST 节点，而 `excludeIds` 它是一个 `WeekMap`，它会用于后续跳过不需要进行 `ref` 语法糖处理的类型为 `Identifier` 的 AST 节点。

然后，会调用 `s.overwrite()` 函数来将 `$ref` 重写为 `_ref`，它会接收 3 个参数，分别是重写的起始位置、结束位置以及要重写为的字符串。而 `call` 则对应着 `$ref(1)` 的 AST 节点，它会是这样：

```javascript
{
  type: "Identifier",
  start: 12,
  end: 19,
  callee: {...}
  arguments: {...},
  optional: false
}
```

并且，我想大家应该注意到了在计算重写的起始位置的时候用到了 `offset`，它代表着此时操作的字符串在源字符串中的**偏移位置**，例如该字符串在源字符串中的开始，那么偏移量则会是 `0`。

而 `helper()` 函数则会返回字符串 `_ref`，并且在这个过程会将 `ref` 添加到 `importedHelpers` 中，这会在 `compileScript()` 时用于生成对应的 `import` 语句：

```javascript
function helper(msg: string) {
  importedHelpers.add(msg);
  return `_${msg}`;
}
```

那么，到这里就完成了对 `$ref` 到 `_ref` 的重写，也就是此时我们代码的会是这样：

```javascript
let count = _ref(1);

function add() {
  count++;
}
```

接着，则是通过 `walk()` 函数来将 `count++` 转换成 `count.value++`。下面，我们来看一下 `walk()` 函数。

#### walk() 函数

前面，我们提及 `walk()` 函数使用的是 Rich Haris 写的 [estree-walker](https://github.com/Rich-Harris/estree-walker)，它是一个用于遍历符合 [ESTree](https://hexdocs.pm/estree/ESTree.html) 规范的 AST 包（Package）。

`walk()` 函数使用起来会是这样：

```javascript
import { walk } from "estree-walker";

walk(ast, {
  enter(node, parent, prop, index) {
    // ...
  },
  leave(node, parent, prop, index) {
    // ...
  },
});
```

可以看到，`walk()` 函数中可以传入 `options`，其中 `enter()` 在每次访问 AST 节点的时候会被调用，`leave()` 则是在离开 AST 节点的时候被调用。

那么，回到前面提到的这个例子，`walk()` 函数主要做了这 2 件事：

**1.维护 scopeStack、parentStack 和 currentScope**

`scopeStack` 用于存放此时 AST 节点所处的作用域链，初始情况下栈顶为根作用域 `rootScope`；`parentStack` 用于存放遍历 AST 节点过程中的祖先 AST 节点（栈顶的 AST 节点是当前 AST 节点的父亲 AST 节点）；`currentScope` 指向当前的作用域，初始情况下等于根作用域 `rootScope`：

```javascript
const scopeStack: Scope[] = [rootScope];
const parentStack: Node[] = [];
let currentScope: Scope = rootScope;
```

所以，在 `enter()` 的阶段会判断此时 AST 节点类型是否为函数、块，是则**入栈** `scopeStack`：

```javascript
parent && parentStack.push(parent)
if (isFunctionType(node)) {
  scopeStack.push((currentScope = {}))
  // ...
  return
}
if (node.type === 'BlockStatement' && !isFunctionType(parent!)) {
  scopeStack.push((currentScope = {}))
  // ...
  return
}
```

然后，在 `leave()` 的阶段判断此时 AST 节点类型是否为函数、块，是则**出栈** `scopeStack`，并且更新 `currentScope` 为出栈后的 `scopeStack` 的栈顶元素：

```javascript
parent && parentStack.pop()
if (
  (node.type === 'BlockStatement' && !isFunctionType(parent!)) ||
  isFunctionType(node)
) {
  scopeStack.pop()
  currentScope = scopeStack[scopeStack.length - 1] || null
}
```

**2.处理 Identifier 类型的 AST 节点**

由于，在我们的例子中 `ref` 语法糖创建 `count` 变量的 AST 节点类型是 `Identifier`，所以这会在 `enter()` 阶段命中这样的逻辑：

```javascript
if (
    node.type === 'Identifier' &&
    isReferencedIdentifier(node, parent!, parentStack) &&
    !excludedIds.has(node)
  ) {
    let i = scopeStack.length
    while (i--) {
      if (checkRefId(scopeStack[i], node, parent!, parentStack)) {
        return
      }
    }
  }
```

在 `if` 的判断中，对于 `excludedIds` 我们在前面已经介绍过了，而 `isReferencedIdentifier()` 则是通过 `parenStack` 来判断当前类型为 `Identifier` 的 AST 节点 `node` 是否是一个引用了这之前的某个 AST 节点。

然后，再通过访问 `scopeStack` 来沿着作用域链来判断是否某个作用域中有 `id.name`（变量名 `count`）属性以及属性值为 `true`，这代表它是一个使用 `ref` 语法糖创建的变量，最后则会通过操作 `s`（`s.appendLeft`）来给该变量添加 `.value`：

```javascript
function checkRefId(
    scope: Scope,
    id: Identifier,
    parent: Node,
    parentStack: Node[]
): boolean {
  if (id.name in scope) {
    if (scope[id.name]) {
      // ...
      s.appendLeft(id.end! + offset, '.value')
    }
    return true
  }
  return false
}
```

## 总结

通过了解 `ref` 语法糖的实现，我想大家应该会对语法糖这个术语会有不一样的理解，它的本质是在编译阶段通过遍历 AST 来操作特定的代码转换操作。并且，这个实现过程的一些工具包（Package）的配合使用也是非常巧妙的，例如 `MagicString` 操作源代码字符串、`estree-walker` 遍历 AST 节点和作用域相关处理等。

最后，如果文中存在表达不当或错误的地方，欢迎各位同学提 Issue ～
