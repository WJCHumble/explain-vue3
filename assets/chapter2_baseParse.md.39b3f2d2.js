import{l as n,f as s,G as a}from"./framework.5c8a4622.js";const t='{"title":"baseParse","description":"","frontmatter":{},"relativePath":"chapter2/baseParse.md","lastUpdated":1628927998783}',p={},o=a('<h1 id="baseparse"><a class="header-anchor" href="#baseparse" aria-hidden="true">#</a> baseParse</h1><p><code>baseParse</code> 顾名思义起着<strong>解析</strong>的作用，它的表现和「Vue2.x」的 <code>parse</code> 相同，都是解析模板 <code>tempalte</code> 生成<strong>原始 AST</strong>。</p><p>假设，此时我们有一个这样的模板 <code>template</code>：</p><div class="language-javascript"><pre><code><span class="token operator">&lt;</span>div<span class="token operator">&gt;</span>\n  <span class="token operator">&lt;</span>div<span class="token operator">&gt;</span>hi vue3<span class="token operator">&lt;</span><span class="token operator">/</span>div<span class="token operator">&gt;</span>\n  <span class="token operator">&lt;</span>div<span class="token operator">&gt;</span><span class="token punctuation">{</span><span class="token punctuation">{</span> msg <span class="token punctuation">}</span><span class="token punctuation">}</span><span class="token operator">&lt;</span><span class="token operator">/</span>div<span class="token operator">&gt;</span>\n<span class="token operator">&lt;</span><span class="token operator">/</span>div<span class="token operator">&gt;</span>\n</code></pre></div><p>那么，它在经过 <code>baseParse</code> 处理后生成的 AST 看起来会是这样：</p><div class="language-javascript"><pre><code><span class="token punctuation">{</span>\n  cached<span class="token operator">:</span> <span class="token number">0</span><span class="token punctuation">,</span>\n  children<span class="token operator">:</span> <span class="token punctuation">[</span><span class="token punctuation">{</span>…<span class="token punctuation">}</span><span class="token punctuation">]</span><span class="token punctuation">,</span>\n  codegenNode<span class="token operator">:</span> <span class="token keyword">undefined</span><span class="token punctuation">,</span>\n  components<span class="token operator">:</span> <span class="token punctuation">[</span><span class="token punctuation">]</span><span class="token punctuation">,</span>\n  directives<span class="token operator">:</span> <span class="token punctuation">[</span><span class="token punctuation">]</span><span class="token punctuation">,</span>\n  helpers<span class="token operator">:</span> <span class="token punctuation">[</span><span class="token punctuation">]</span><span class="token punctuation">,</span>\n  hoists<span class="token operator">:</span> <span class="token punctuation">[</span><span class="token punctuation">]</span><span class="token punctuation">,</span>\n  imports<span class="token operator">:</span> <span class="token punctuation">[</span><span class="token punctuation">]</span><span class="token punctuation">,</span>\n  loc<span class="token operator">:</span> <span class="token punctuation">{</span>start<span class="token operator">:</span> <span class="token punctuation">{</span>…<span class="token punctuation">}</span><span class="token punctuation">,</span> end<span class="token operator">:</span> <span class="token punctuation">{</span>…<span class="token punctuation">}</span><span class="token punctuation">,</span> source<span class="token operator">:</span> <span class="token string">&quot;&lt;div&gt;&lt;div&gt;hi vue3&lt;/div&gt;&lt;div&gt;{{msg}}&lt;/div&gt;&lt;/div&gt;&quot;</span><span class="token punctuation">}</span><span class="token punctuation">,</span>\n  temps<span class="token operator">:</span> <span class="token number">0</span><span class="token punctuation">,</span>\n  type<span class="token operator">:</span> <span class="token number">0</span>\n<span class="token punctuation">}</span>\n</code></pre></div><p>如果，了解过「Vue2.x」编译过程的同学应该对于上面这颗 <code>AST</code> 的大部分属性不会陌生。<code>AST</code> 的本质是通过用对象来描述「DSL」（特殊领域语言），例如：</p><ul><li><code>children</code> 中存放的就是最外层 <code>div</code> 的后代。</li><li><code>loc</code> 则用来描述这个 AST Element 在整个字符串（<code>template</code>）中的位置信息。</li><li><code>type</code> 则是用于描述这个元素的类型（例如 5 为插值、2 为文本）等等。</li></ul><p>并且，可以看到的是不同于「Vue2.x」的 AST，这里我们多了诸如 <code>helpers</code>、<code>codegenNode</code>、<code>hoists</code> 等属性。而，这些属性会在 <code>transform</code> 阶段进行相应地赋值，进而帮助 <code>generate</code> 阶段生成<strong>更优的</strong>可执行代码。</p>',9);p.render=function(a,t,p,e,c,l){return n(),s("div",null,[o])};export default p;export{t as __pageData};
