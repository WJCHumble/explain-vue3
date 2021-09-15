## 基本介绍

近期，Vue3 提了一个 [Ref Sugar 的 RFC](https://github.com/vuejs/rfcs/discussions/369)，即 `ref` 语法糖，目前还处理实验性的（Experimental）阶段。在 RFC 的动机（Motivation）中，Evan You 介绍到在 Composition API 引入后，一个主要未解决的问题是 `refs` 和 `reactive` 对象的使用。而到处使用 `.value` 可能会很麻烦，如果在没使用类型系统的情况下，也会很容易错过：

```javascript
let count = ref(1);

function add() {
  count.value++;
}
```

所以，一些用户会更倾向于只使用 `reactive`，这样就不用处理使用 `refs` 的 `.value` 问题。而 `ref` 语法糖的作用是让我们在使用 `ref` 创建响应式的变量时，可以直接获取和更改变量本身，而不是使用 `.value` 来获取和更改对应的值。简单的说，**站在使用层面**，我们可以告别使用 `refs` 时的 `.value` 问题：

```javascript
let count = $ref(1);

function add() {
  count++;
}
```

那么，`ref` 语法糖目前要怎么在项目中使用？它又是怎么实现的？这是我第一眼看到这个 RFC 建立的疑问，相信这也是很多同学持有的疑问。所以，下面让我们来一一揭晓。
