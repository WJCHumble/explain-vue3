## 基本介绍

## 采用 Monorepo 的方式管理项目

在「Vue3.0」，它采用了「Monorepo」的方式来管理项目的代码。那么，什么是「Monorepo」？我们先来看看维基百科上对「Monorepo」的介绍：

**———— In revision control systems, a monorepo is a software development strategy where code for many projects is stored in the same repository.**

简单理解，「Monorepo」**指一种将多个项目放到一个仓库的一种管理项目的策略**。当然，这只是概念上的理解。而对于实际开发中的场景，「Monorepo」的使用通常是通过 `yarn` 的 `workspaces` 工作空间，又或者是 `lerna` 这种高度封装的第三方工具库来实现。使用「Monorepo」的方式来管理项目会给我们带来以下这些好处：

- 只需要一个仓库，就可以便捷地管理多个项目
- 可以管理不同项目中的相同第三方依赖，做到依赖的同步更新
- 可以使用其他项目中的代码，清晰地建立起项目间的依赖关系

而「Vue3.0」正是采用的 `yarn` 的 `workspaces` 工作空间的方式管理整个项目，而 `workspaces` 的特点就是在 `package.json` 中会有这么两句不同于普通项目的声明：

```javascript
{
    "private": true,
    "workspaces": [
        "packages/*"
    ]
}
```

其中 `"private": true` 的作用是保证了工作区的安全，避免被其他引用， `"workspaces"` 则是用来声明工作区所包含的项目的位置，很显然它可以声明多个，而 `packages/*` 指的是 `packages` 文件夹下的所有项目。并且，「Vue3.0」中对工作区的声明也是 `pacakges/*`，所以它的目录结构会是这样：

```javascript
...
|—— packages
    |———— compiler-core
    |———— compiler-dom
    |———— compiler-sfc
    |———— compiler-ssr
    |———— reactivity
    |———— runime-core
    |———— runime-dom
    |———— runime-test
    |———— server-renderer
    |———— shared
    |———— size-check
    |———— template-explorer
    |———— vue
    global.dt.s
package.json
```

> 这里我只展示了 `packages` 文件目录和 `package.json`，至于其他目录有兴趣的同学可以自行了解。

可以看到，`packages` 文件目录下根据「Vue3.0」实现所需要的能力划分了不同的项目，例如 `reactivity` 文件目录下就是和 `reactivity` API 相关的代码，并且它的内部的结构会是这样：

```javascript
|—— __tests__               ## 测试用例
|—— src                     ## reactive API 实现相关代码
api.extractor.json
index.js
LICENSE
package.json                ## reactive API 实现相关代码
README.md
```

在 `reactivity` 项目文件的内部也同样有 `package.json` 文件，也就是如我们上面所说的，`packages` 文件目录下的文件都各自对应着每一个单独的项目。所以，每一个项目中的 `package.json` 就对应着改项目对应的依赖、入口、打包的一些配置等等。

而「Vue3.0」使用「Monorepo」的方式管理项目的好处就是我们可以单独使用它的一些 API 的能力，而不是只能在「Vue」项目中使用它。很典型的例子就是，我们可以通过 `npm i @vue/reactivity` 单独安装 `reactivity` API 对应的 `npm` 包，从而在其他地方使用 `reactivity` API 来实现观察者模式。

> 当然，使用「Monorepo」还需要思考诸多其他问题，例如增量编译、多任务编译等等，有兴趣同学可以自行去了解。

## 总结

那么，在简单介绍完「Vue3.0」是以「Monorepo」的方式管理项目后。我想，大家心中都已明了，如果我们要去了解「Vue3.0」怎么去实现模板编译、runtime + compiler 的巧妙结合、Virtual DOM 的实现等等原理，我们就可以从 `packages` 文件目录下的各个文件开始着手来研究它们的实现。
