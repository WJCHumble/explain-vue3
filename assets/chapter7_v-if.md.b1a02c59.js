import{l as n,f as s,G as e}from"./framework.5c8a4622.js";const a='{"title":"v-if","description":"","frontmatter":{},"headers":[{"level":2,"title":"派发更新时 patch，更新节点","slug":"派发更新时-patch，更新节点"},{"level":2,"title":"总结","slug":"总结"}],"relativePath":"chapter7/v-if.md","lastUpdated":1628927998786}',o={},t=e('<h1 id="v-if"><a class="header-anchor" href="#v-if" aria-hidden="true">#</a> v-if</h1><p>在之前模版编译一节中，我给大家介绍了 Vue 3 的编译过程，即一个模版会经历 <code>baseParse</code>、<code>transform</code>、<code>generate</code> 这三个过程，最后由 <code>generate</code> 生成可以执行的代码（<code>render</code> 函数）。</p><blockquote><p>这里，我们就不从编译过程开始讲解 <code>v-if</code> 指令的 <code>render</code> 函数生成过程了，有兴趣了解这个过程的同学，可以看我之前的模版编译一节</p></blockquote><p>我们可以直接在 <a href="https://vue-next-template-explorer.netlify.app/" target="_blank" rel="noopener noreferrer">Vue3 Template Explore</a> 输入一个使用 <code>v-if</code> 指令的栗子：</p><div class="language-javascript"><pre><code><span class="token operator">&lt;</span>div v<span class="token operator">-</span><span class="token keyword">if</span><span class="token operator">=</span><span class="token string">&quot;visible&quot;</span><span class="token operator">&gt;</span><span class="token operator">&lt;</span><span class="token operator">/</span>div<span class="token operator">&gt;</span>\n</code></pre></div><p>然后，由它编译生成的 <code>render</code> 函数会是这样：</p><div class="language-javascript"><pre><code><span class="token function">render</span><span class="token punctuation">(</span><span class="token parameter">_ctx<span class="token punctuation">,</span> _cache<span class="token punctuation">,</span> $props<span class="token punctuation">,</span> $setup<span class="token punctuation">,</span> $data<span class="token punctuation">,</span> $options</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>\n  <span class="token keyword">return</span> <span class="token punctuation">(</span>_ctx<span class="token punctuation">.</span>visible<span class="token punctuation">)</span>\n    <span class="token operator">?</span> <span class="token punctuation">(</span><span class="token function">_openBlock</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">,</span> <span class="token function">_createBlock</span><span class="token punctuation">(</span><span class="token string">&quot;div&quot;</span><span class="token punctuation">,</span> <span class="token punctuation">{</span> key<span class="token operator">:</span> <span class="token number">0</span> <span class="token punctuation">}</span><span class="token punctuation">)</span><span class="token punctuation">)</span>\n    <span class="token operator">:</span> <span class="token function">_createCommentVNode</span><span class="token punctuation">(</span><span class="token string">&quot;v-if&quot;</span><span class="token punctuation">,</span> <span class="token boolean">true</span><span class="token punctuation">)</span>\n<span class="token punctuation">}</span>\n</code></pre></div><p>可以看到，一个简单的使用 <code>v-if</code> 指令的模版编译生成的 <code>render</code> 函数最终会返回一个<strong>三目运算表达式</strong>。首先，让我们先来认识一下其中几个变量和函数的意义：</p><ul><li><code>_ctx</code> 当前组件实例的上下文，即 <code>this</code></li><li><code>_openBlock()</code> 和 <code>_createBlock()</code> 用于构造 <code>Block Tree</code> 和 <code>Block VNode</code>，它们主要用于靶向更新过程</li><li><code>_createCommentVNode()</code> 创建注释节点的函数，通常用于占位</li></ul><p>显然，如果当 <code>visible</code> 为 <code>false</code> 的时候，会在当前模版中创建一个<strong>注释节点</strong>（也可称为占位节点），反之则创建一个真实节点（即它自己）。例如当 <code>visible</code> 为 <code>false</code> 时渲染到页面上会是这样：</p><div align="center"><img width="400" src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/fa3d336210f34fff8f68d1b8cab83443~tplv-k3u1fbpfcp-zoom-1.image"></div><blockquote><p>在 Vue 中很多地方都运用了注释节点来作为<strong>占位节点</strong>，其目的是在不展示该元素的时候，标识其<strong>在页面中的位置</strong>，以便在 <code>patch</code> 的时候将该元素放回该位置。</p></blockquote><p>那么，这个时候我想大家就会抛出一个疑问：当 <code>visible</code> 动态切换 <code>true</code> 或 <code>false</code> 的这个过程（派发更新）究竟发生了什么？</p><h2 id="派发更新时-patch，更新节点"><a class="header-anchor" href="#派发更新时-patch，更新节点" aria-hidden="true">#</a> 派发更新时 patch，更新节点</h2><blockquote><p>如果不了解 Vue 3 派发更新和依赖收集过程的同学，可以看我之前的文章<a href="https://juejin.cn/post/6844904106415357959/" target="_blank" rel="noopener noreferrer">4k+ 字分析 Vue 3.0 响应式原理（依赖收集和派发更新）</a></p></blockquote><p>在 Vue 3 中总共有四种指令：<code>v-on</code>、<code>v-model</code>、<code>v-show</code> 和 <code>v-if</code>。但是，实际上在源码中，只针对前面三者<strong>进行了特殊处理</strong>，这可以在 <code>packages/runtime-dom/src/directives</code> 目录下的文件看出：</p><div class="language-javascript"><pre><code><span class="token comment">// packages/runtime-dom/src/directives</span>\n<span class="token operator">|</span><span class="token operator">--</span> driectives\n    <span class="token operator">|</span><span class="token operator">--</span> vModel<span class="token punctuation">.</span>ts       ## v<span class="token operator">-</span>model 指令相关\n    <span class="token operator">|</span><span class="token operator">--</span> vOn<span class="token punctuation">.</span>ts          ## v<span class="token operator">-</span>on 指令相关\n    <span class="token operator">|</span><span class="token operator">--</span> vShow<span class="token punctuation">.</span>ts        ## v<span class="token operator">-</span>show 指令相关\n</code></pre></div><p>而针对 <code>v-if</code> 指令是直接走派发更新过程时 <code>patch</code> 的逻辑。由于 <code>v-if</code> 指令订阅了 <code>visible</code> 变量，所以当 <code>visible</code> 变化的时候，则会触发<strong>派发更新</strong>，即 <code>Proxy</code> 对象的 <code>set</code> 逻辑，最后会命中 <code>componentEffect</code> 的逻辑。</p><blockquote><p>当然，我们也可以称这个过程为组件的更新过程</p></blockquote><p>这里，我们来看一下 <code>componentEffect</code> 的定义（伪代码）：</p><div class="language-javascript"><pre><code><span class="token comment">// packages/runtime-core/src/renderer.ts</span>\n<span class="token keyword">function</span> <span class="token function">componentEffect</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>\n    <span class="token keyword">if</span> <span class="token punctuation">(</span><span class="token operator">!</span>instance<span class="token punctuation">.</span>isMounted<span class="token punctuation">)</span> <span class="token punctuation">{</span>\n    \t<span class="token operator">...</span><span class="token punctuation">.</span>\n    <span class="token punctuation">}</span> <span class="token keyword">else</span> <span class="token punctuation">{</span>\n      \t<span class="token operator">...</span>\n        <span class="token keyword">const</span> nextTree <span class="token operator">=</span> <span class="token function">renderComponentRoot</span><span class="token punctuation">(</span>instance<span class="token punctuation">)</span>\n        <span class="token keyword">const</span> prevTree <span class="token operator">=</span> instance<span class="token punctuation">.</span>subTree\n        instance<span class="token punctuation">.</span>subTree <span class="token operator">=</span> nextTree\n        <span class="token function">patch</span><span class="token punctuation">(</span>\n          prevTree<span class="token punctuation">,</span>\n          nextTree<span class="token punctuation">,</span>\n          <span class="token function">hostParentNode</span><span class="token punctuation">(</span>prevTree<span class="token punctuation">.</span>el<span class="token operator">!</span><span class="token punctuation">)</span><span class="token operator">!</span><span class="token punctuation">,</span>\n          <span class="token function">getNextHostNode</span><span class="token punctuation">(</span>prevTree<span class="token punctuation">)</span><span class="token punctuation">,</span>\n          instance<span class="token punctuation">,</span>\n          parentSuspense<span class="token punctuation">,</span>\n          isSVG\n        <span class="token punctuation">)</span>\n        <span class="token operator">...</span>\n      <span class="token punctuation">}</span>\n  <span class="token punctuation">}</span>\n<span class="token punctuation">}</span>\n</code></pre></div><p>可以看到，当<strong>组件还没挂载时</strong>，即第一次触发派发更新会命中 <code>!instance.isMounted</code> 的逻辑。而对于我们这个栗子，则会命中 <code>else</code> 的逻辑，即组件更新，主要会做三件事：</p><ul><li>获取当前组件对应的组件树 <code>nextTree</code> 和之前的组件树 <code>prevTree</code></li><li>更新当前组件实例 <code>instance</code> 的组件树 <code>subTree</code> 为 <code>nextTree</code></li><li><code>patch</code> 新旧组件树 <code>prevTree</code> 和 <code>nextTree</code>，如果存在 <code>dynamicChildren</code>，即 <code>Block Tree</code>，则会命中靶向更新的逻辑，显然我们此时满足条件</li></ul><blockquote><p>注：组件树则指的是该组件对应的 VNode Tree。</p></blockquote><h2 id="总结"><a class="header-anchor" href="#总结" aria-hidden="true">#</a> 总结</h2><p>总体来看，<code>v-if</code> 指令的实现较为简单，基于<strong>数据驱动</strong>的理念，当 <code>v-if</code> 指令对应的 <code>value</code> 为 <code>false</code> 的时候会<strong>预先创建一个注释节</strong>点在该位置，然后在 <code>value</code> 发生变化时，命中派发更新的逻辑，对新旧组件树进行 <code>patch</code>，从而完成使用 <code>v-if</code> 指令元素的动态显示隐藏。</p><div align="center"><img width="700" src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/fd36f8e0870340eeb0d2fbcf56fec40a~tplv-k3u1fbpfcp-zoom-1.image"></div><blockquote><p>那么，下一节，我们来看一下 <code>v-show</code> 指令的实现～</p></blockquote>',28);o.render=function(e,a,o,p,c,r){return n(),s("div",null,[t])};export default o;export{a as __pageData};
